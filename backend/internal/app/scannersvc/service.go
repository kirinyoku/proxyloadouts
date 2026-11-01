// Package scannersvc implements the showcase scanning use case: fetch a ZZZ
// profile by UID, respect the upstream TTL via the local in-memory cache,
// coalesce concurrent scans for the same UID with singleflight, and map
// the result to a frontend-ready DTO.
package scannersvc

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	fairy "github.com/kirinyoku/fairy"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// SourceStatus tells the frontend whether the payload came from the network
// or from the local TTL cache.
type SourceStatus string

const (
	SourceFresh  SourceStatus = "fresh"
	SourceCached SourceStatus = "cached"
)

// defaultProfileTTL is used when the upstream payload carries no TTL.
const defaultProfileTTL = time.Minute

// defaultNegativeTTL is used to cache negative responses (NotFound) to shield
// upstream APIs from repeated scans of non-existent UIDs.
const defaultNegativeTTL = 60 * time.Second

// Fetcher abstracts the external ZZZ profile provider: fetching raw profiles
// and enriching them in memory in any supported language.
type Fetcher interface {
	FetchRawProfile(ctx context.Context, uid string) (raw *zzz.Profile, ttl time.Duration, err error)
	EnrichProfile(raw *zzz.Profile, lang fairy.Language) (*fairy.Profile, error)
	EnrichAgent(raw *zzz.AvatarData, lang fairy.Language) (*fairy.Agent, error)
}

// Cache abstracts the TTL caching and request coalescing mechanism for raw profiles.
type Cache interface {
	GetOrFetch(
		ctx context.Context,
		key string,
		ttl time.Duration,
		fetchFn func(ctx context.Context) (*zzz.Profile, time.Duration, error),
	) (raw *zzz.Profile, fromCache bool, remainingTTL time.Duration, err error)
	Set(key string, value *zzz.Profile, ttl time.Duration)
}

// CacheUpdater abstracts the ability to forcibly write a raw profile to the cache.
type CacheUpdater interface {
	Set(key string, value *zzz.Profile, ttl time.Duration)
}

// NegativeCache abstracts short-term caching of missing entries (negative caching).
type NegativeCache interface {
	Set(key string, ttl time.Duration)
	Has(key string) bool
	Delete(key string)
}

type memoryNegativeCache struct {
	mu    sync.RWMutex
	items map[string]time.Time
}

func newMemoryNegativeCache() *memoryNegativeCache {
	return &memoryNegativeCache{items: make(map[string]time.Time)}
}

const defaultMaxNegativeCacheItems = 5000

func (m *memoryNegativeCache) Set(key string, ttl time.Duration) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if len(m.items) >= defaultMaxNegativeCacheItems {
		now := time.Now()
		for k, exp := range m.items {
			if now.After(exp) {
				delete(m.items, k)
			}
		}
		if len(m.items) >= defaultMaxNegativeCacheItems {
			for k := range m.items {
				delete(m.items, k)
				break
			}
		}
	}

	m.items[key] = time.Now().Add(ttl)
}

func (m *memoryNegativeCache) Has(key string) bool {
	m.mu.RLock()
	expiresAt, found := m.items[key]
	m.mu.RUnlock()
	if !found {
		return false
	}
	if time.Now().After(expiresAt) {
		m.mu.Lock()
		delete(m.items, key)
		m.mu.Unlock()
		return false
	}
	return true
}

func (m *memoryNegativeCache) Delete(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.items, key)
}

// Options holds optional scanner settings.
type Options struct {
	// FallbackTTL overrides defaultProfileTTL (useful in tests).
	FallbackTTL time.Duration
	// NegativeTTL is how long domain.ErrNotFound is cached. Defaults to 60s.
	// Set to -1 to disable negative caching.
	NegativeTTL time.Duration
	// NegativeCache stores negative lookup results. If nil, negative caching uses an in-memory fallback.
	NegativeCache NegativeCache
}

// Service scans showcases by UID.
type Service struct {
	fetcher     Fetcher
	cache       Cache
	negCache    NegativeCache
	fallbackTTL time.Duration
	negativeTTL time.Duration
}

// New creates a scanner service.
func New(fetcher Fetcher, cache Cache, opts ...Options) *Service {
	svc := &Service{
		fetcher:     fetcher,
		cache:       cache,
		fallbackTTL: defaultProfileTTL,
		negativeTTL: defaultNegativeTTL,
	}
	if len(opts) > 0 {
		opt := opts[0]
		if opt.FallbackTTL > 0 {
			svc.fallbackTTL = opt.FallbackTTL
		}
		if opt.NegativeTTL < 0 {
			svc.negativeTTL = 0
		} else if opt.NegativeTTL > 0 {
			svc.negativeTTL = opt.NegativeTTL
		}
		if opt.NegativeCache != nil {
			svc.negCache = opt.NegativeCache
		}
	}
	if svc.negativeTTL > 0 && svc.negCache == nil {
		svc.negCache = newMemoryNegativeCache()
	}
	return svc
}

type parsedLang struct {
	lang fairy.Language
	q    float64
}

func matchFairyLanguage(tag string) (fairy.Language, bool) {
	tag = strings.ToLower(strings.TrimSpace(tag))
	if tag == "" || tag == "*" {
		return "", false
	}
	if fairy.Language(tag).IsValid() {
		return fairy.Language(tag), true
	}
	if idx := strings.IndexByte(tag, '-'); idx > 0 {
		base := tag[:idx]
		if fairy.Language(base).IsValid() {
			return fairy.Language(base), true
		}
	}
	return "", false
}

// NormalizeLanguage converts an input language string (such as a ?lang= query
// parameter or an Accept-Language header) to a recognized fairy.Language.
// Defaults to Russian (fairy.LangRU) when omitted or unsupported.
func NormalizeLanguage(raw string) fairy.Language {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return fairy.LangRU
	}

	parts := strings.Split(raw, ",")
	var candidates []parsedLang

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		tokens := strings.Split(part, ";")
		tag := strings.TrimSpace(tokens[0])
		q := 1.0

		for _, param := range tokens[1:] {
			param = strings.TrimSpace(param)
			lower := strings.ToLower(param)
			if strings.HasPrefix(lower, "q=") {
				valStr := strings.TrimPrefix(lower, "q=")
				if val, err := strconv.ParseFloat(valStr, 64); err == nil {
					q = val
				}
			}
		}

		if q <= 0 {
			continue
		}

		if lang, ok := matchFairyLanguage(tag); ok {
			candidates = append(candidates, parsedLang{
				lang: lang,
				q:    q,
			})
		}
	}

	if len(candidates) == 0 {
		return fairy.LangRU
	}

	sort.SliceStable(candidates, func(i, j int) bool {
		return candidates[i].q > candidates[j].q
	})

	return candidates[0].lang
}

// ShowcaseResponse is the API payload for a UID scan: player metadata plus
// the full enriched agents list (stats, W-Engines, Drive Discs) as produced
// by the fairy SDK, wrapped with cache freshness info.
type ShowcaseResponse struct {
	UID            string        `json:"uid"`
	Nickname       string        `json:"nickname"`
	Region         string        `json:"region"`
	InterknotLevel int           `json:"interknot_level"`
	AvatarURL      string        `json:"avatar_url,omitempty"`
	Source         SourceStatus  `json:"source"`
	TTLSeconds     int           `json:"ttl_seconds"`
	FetchedAt      time.Time     `json:"fetched_at"`
	AgentCount     int           `json:"agent_count"`
	Agents         []fairy.Agent `json:"agents"`
}

// FreshVerificationProfile holds canonical player metadata and social signature
// fetched freshly from upstream to verify account ownership.
type FreshVerificationProfile struct {
	UID       string       `json:"uid"`
	Nickname  string       `json:"nickname"`
	AvatarURL string       `json:"avatar_url,omitempty"`
	Signature string       `json:"signature"`
	Raw       *zzz.Profile `json:"-"`
}

// ScanByUID returns the current showcase for the given UID localized in the
// requested language. The raw profile is cached in-memory and coalesced via
// singleflight, so subsequent requests in different languages are enriched
// instantly in-memory without repeating upstream network requests to Enka.
func (s *Service) ScanByUID(ctx context.Context, uid string, lang ...string) (*ShowcaseResponse, error) {
	if err := domain.ValidateUID(uid); err != nil {
		return nil, fmt.Errorf("%w: %w", domain.ErrInvalidInput, err)
	}

	cacheKey := scanCacheKey(uid)
	if s.negativeTTL > 0 && s.negCache != nil && s.negCache.Has(cacheKey) {
		return nil, fmt.Errorf("%w: showcase profile not found", domain.ErrNotFound)
	}

	selectedLang := ""
	if len(lang) > 0 {
		selectedLang = lang[0]
	}
	targetLang := NormalizeLanguage(selectedLang)

	raw, fromCache, remTTL, err := s.cache.GetOrFetch(ctx, cacheKey, s.fallbackTTL,
		func(ctx context.Context) (*zzz.Profile, time.Duration, error) {
			p, ttl, fetchErr := s.fetcher.FetchRawProfile(ctx, uid)
			if fetchErr != nil {
				if s.negativeTTL > 0 && s.negCache != nil && errors.Is(fetchErr, domain.ErrNotFound) {
					s.negCache.Set(cacheKey, s.negativeTTL)
				}
				return nil, 0, fetchErr
			}
			return p, ttl, nil
		})
	if err != nil {
		return nil, err
	}

	profile, err := s.fetcher.EnrichProfile(raw, targetLang)
	if err != nil {
		return nil, fmt.Errorf("failed to enrich profile: %w", err)
	}

	status := SourceFresh
	if fromCache {
		status = SourceCached
	}
	return buildShowcaseResponse(profile, status, remTTL), nil
}

// FetchFreshProfile delegates to FetchFreshRawProfile for verification callers.
func (s *Service) FetchFreshProfile(ctx context.Context, uid string) (*FreshVerificationProfile, error) {
	return s.FetchFreshRawProfile(ctx, uid)
}

// FetchFreshRawProfile bypasses local caches (both TTL cache and negative cache)
// to fetch the latest upstream profile directly from the provider.
// On success, it enriches the profile in fairy.LangRU to obtain canonical Nickname
// and AvatarURL, extracts the player's bio/signature from SocialDetail.Desc,
// overwrites the local TTL cache with the fresh raw payload, and removes any
// stale negative cache entry for the UID.
func (s *Service) FetchFreshRawProfile(ctx context.Context, uid string) (*FreshVerificationProfile, error) {
	if err := domain.ValidateUID(uid); err != nil {
		return nil, fmt.Errorf("%w: %w", domain.ErrInvalidInput, err)
	}

	raw, ttl, err := s.fetcher.FetchRawProfile(ctx, uid)
	if err != nil {
		return nil, err
	}
	if raw == nil {
		return nil, fmt.Errorf("%w: received empty profile from upstream", domain.ErrNotFound)
	}

	enriched, err := s.fetcher.EnrichProfile(raw, fairy.LangRU)
	if err != nil {
		return nil, fmt.Errorf("failed to enrich profile: %w", err)
	}

	var nickname string
	var avatarURL string
	if enriched != nil {
		nickname = enriched.Nickname
		if enriched.Avatar != nil {
			avatarURL = enriched.Avatar.URL
		}
	}
	if nickname == "" && raw.PlayerInfo.SocialDetail != nil && raw.PlayerInfo.SocialDetail.ProfileDetail != nil {
		nickname = raw.PlayerInfo.SocialDetail.ProfileDetail.Nickname
	}

	var signature string
	if raw.PlayerInfo.SocialDetail != nil {
		signature = raw.PlayerInfo.SocialDetail.Desc
	}

	cacheKey := scanCacheKey(uid)
	effectiveTTL := s.fallbackTTL
	if ttl > 0 {
		effectiveTTL = ttl
	}

	if effectiveTTL > 0 && s.cache != nil {
		s.cache.Set(cacheKey, raw, effectiveTTL)
	}
	if s.negCache != nil {
		s.negCache.Delete(cacheKey)
	}

	return &FreshVerificationProfile{
		UID:       uid,
		Nickname:  nickname,
		AvatarURL: avatarURL,
		Signature: signature,
		Raw:       raw,
	}, nil
}

// GetRawAvatar retrieves the raw avatar data for a specific agent from the
// cached or freshly fetched profile of the given UID.
func (s *Service) GetRawAvatar(ctx context.Context, uid string, agentID int) (*zzz.AvatarData, error) {
	if err := domain.ValidateUID(uid); err != nil {
		return nil, fmt.Errorf("%w: %w", domain.ErrInvalidInput, err)
	}

	cacheKey := scanCacheKey(uid)
	if s.negativeTTL > 0 && s.negCache != nil && s.negCache.Has(cacheKey) {
		return nil, fmt.Errorf("%w: showcase profile not found", domain.ErrNotFound)
	}

	raw, _, _, err := s.cache.GetOrFetch(ctx, cacheKey, s.fallbackTTL,
		func(ctx context.Context) (*zzz.Profile, time.Duration, error) {
			p, ttl, fetchErr := s.fetcher.FetchRawProfile(ctx, uid)
			if fetchErr != nil {
				if s.negativeTTL > 0 && s.negCache != nil && errors.Is(fetchErr, domain.ErrNotFound) {
					s.negCache.Set(cacheKey, s.negativeTTL)
				}
				return nil, 0, fetchErr
			}
			return p, ttl, nil
		})
	if err != nil {
		return nil, err
	}

	if raw.PlayerInfo.ShowcaseDetail == nil || len(raw.PlayerInfo.ShowcaseDetail.AvatarList) == 0 {
		return nil, fmt.Errorf("%w: no agents showcased for UID %s", domain.ErrNotFound, uid)
	}

	for _, avatar := range raw.PlayerInfo.ShowcaseDetail.AvatarList {
		if avatar.ID == agentID {
			cp := avatar
			return &cp, nil
		}
	}

	return nil, fmt.Errorf("%w: agent %d not found in showcase for UID %s", domain.ErrNotFound, agentID, uid)
}

// EnrichAgent delegates to the fetcher to enrich a single raw avatar data payload in the given language.
func (s *Service) EnrichAgent(raw *zzz.AvatarData, lang fairy.Language) (*fairy.Agent, error) {
	return s.fetcher.EnrichAgent(raw, lang)
}

func scanCacheKey(uid string) string {
	return "showcase:uid:" + uid
}

func buildShowcaseResponse(p *fairy.Profile, status SourceStatus, ttl time.Duration) *ShowcaseResponse {
	resp := &ShowcaseResponse{
		UID:            p.UID,
		Nickname:       p.Nickname,
		Region:         string(p.Region),
		InterknotLevel: p.InterknotLevel,
		Source:         status,
		TTLSeconds:     int(ttl.Seconds()),
		FetchedAt:      time.Now().UTC(),
		AgentCount:     len(p.Agents),
		Agents:         p.Agents,
	}
	if p.Avatar != nil {
		resp.AvatarURL = p.Avatar.URL
	}
	return resp
}
