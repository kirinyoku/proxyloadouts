// Package buildenrich memoizes the localization of persisted raw avatar
// payloads into the enriched build projections returned to clients.
//
// Localizing a build is a pure function of (stored raw payload, language), but
// it is expensive: the fairy SDK rebuilds the full agent — skills, W-Engine,
// every Drive Disc and its sub-stats, formatted stat tables — from the bundled
// game catalog on every call. Without memoization every list endpoint repeats
// that work for every build it returns, and teamsvc pays it for every member of
// every team.
//
// The cache key is the SHA-256 of the raw payload plus the normalized language,
// so an edited build is a different key automatically and no explicit
// invalidation is needed. Because raw_data is immutable once persisted (only
// name/description are mutable, and neither appears in the enriched projection),
// a cached entry can never go stale relative to the database.
package buildenrich

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	fairy "github.com/kirinyoku/fairy"
)

// Localized is the enriched, client-ready projection of a saved build.
type Localized struct {
	// Data is the marshalled fairy agent payload. Treat it as immutable: the
	// same slice may be shared by every concurrent request served from cache.
	Data json.RawMessage
	// AgentName is the agent name localized to the requested language.
	AgentName string
}

// AgentEnricher abstracts dynamic localization of raw avatar data.
type AgentEnricher interface {
	EnrichAgent(raw *zzz.AvatarData, lang fairy.Language) (*fairy.Agent, error)
}

// Cache stores localized payloads. The app layer declares this shape so the
// adapter implementation stays an infrastructure detail: main.go binds it to
// inmemory.SingleflightService, which gives TTL expiry, LRU eviction and
// singleflight coalescing of concurrent misses.
type Cache func(
	ctx context.Context,
	key string,
	compute func(context.Context) (Localized, time.Duration, error),
) (Localized, error)

// Localizer localizes a stored raw avatar payload. Implementations must be
// safe for concurrent use.
type Localizer interface {
	// Localize returns the enriched projection for the given raw payload and
	// language. ok is false when the payload cannot be localized, in which case
	// callers keep the stored values.
	Localize(ctx context.Context, raw json.RawMessage, lang fairy.Language) (result Localized, ok bool)
}

// Service is a caching Localizer. The zero value is not usable; call New.
type Service struct {
	enricher AgentEnricher
	cache    Cache
	ttl      time.Duration
}

// New creates a caching localizer. cache may be nil, in which case every call
// goes straight to enricher (useful in tests and as a safe default).
func New(enricher AgentEnricher, cache Cache, ttl time.Duration) *Service {
	if ttl <= 0 {
		ttl = defaultTTL
	}
	return &Service{enricher: enricher, cache: cache, ttl: ttl}
}

// defaultTTL bounds memory for a project that never reads its own builds again.
const defaultTTL = 15 * time.Minute

var _ Localizer = (*Service)(nil)

// Localize implements Localizer.
func (s *Service) Localize(
	ctx context.Context,
	raw json.RawMessage,
	lang fairy.Language,
) (Localized, bool) {
	if s == nil || s.enricher == nil || len(raw) == 0 {
		return Localized{}, false
	}
	if !lang.IsValid() {
		lang = fairy.LangRU
	}

	if s.cache == nil {
		result, _, err := s.compute(ctx, raw, lang)
		return result, err == nil
	}

	key := CacheKey(raw, lang)
	result, err := s.cache(ctx, key, func(ctx context.Context) (Localized, time.Duration, error) {
		return s.compute(ctx, raw, lang)
	})
	if err != nil {
		return Localized{}, false
	}
	return result, true
}

// compute performs the actual unmarshal/enrich/marshal round trip.
func (s *Service) compute(
	ctx context.Context,
	raw json.RawMessage,
	lang fairy.Language,
) (Localized, time.Duration, error) {
	if err := ctx.Err(); err != nil {
		return Localized{}, 0, err
	}

	var rawAvatar zzz.AvatarData
	if err := json.Unmarshal(raw, &rawAvatar); err != nil {
		return Localized{}, 0, fmt.Errorf("decode raw avatar: %w", err)
	}

	agent, err := s.enricher.EnrichAgent(&rawAvatar, lang)
	if err != nil {
		return Localized{}, 0, fmt.Errorf("enrich agent: %w", err)
	}

	data, err := json.Marshal(agent)
	if err != nil {
		return Localized{}, 0, fmt.Errorf("encode enriched agent: %w", err)
	}

	return Localized{Data: data, AgentName: agent.Name}, s.ttl, nil
}

// CacheKey derives the memoization key for a raw payload and language.
func CacheKey(raw json.RawMessage, lang fairy.Language) string {
	sum := sha256.Sum256(raw)
	return string(lang) + ":" + hex.EncodeToString(sum[:])
}
