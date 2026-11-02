package zfae

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

const (
	DefaultBaseURL               = "https://zfae.net"
	DefaultTimeout               = 15 * time.Second
	DefaultTTL                   = 20 * time.Minute
	DefaultCooldown              = 2 * time.Minute
	DefaultMaxConcurrentSwitches = 5
	DefaultUserAgent             = "ProxyLoadouts/1.0 (+https://github.com/kirinyoku/proxyloadouts)"
)

type Option func(*Client)

func WithBaseURL(rawURL string) Option {
	return func(c *Client) {
		c.baseURL = strings.TrimRight(rawURL, "/")
	}
}

func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		if hc != nil {
			c.httpClient = hc
		}
	}
}

func WithTTL(ttl time.Duration) Option {
	return func(c *Client) {
		if ttl > 0 {
			c.ttl = ttl
		}
	}
}

func WithCooldown(cooldown time.Duration) Option {
	return func(c *Client) {
		if cooldown > 0 {
			c.cooldown = cooldown
		}
	}
}

func WithUserAgent(ua string) Option {
	return func(c *Client) {
		if ua != "" {
			c.userAgent = ua
		}
	}
}

func WithMaxConcurrentSwitches(n int) Option {
	return func(c *Client) {
		if n > 0 {
			c.maxConcurrentSwitches = n
		}
	}
}

type ProfileResult struct {
	UID                   string
	Ratings               map[int]*domain.FaeRating
	AllRatings            []*domain.FaeRating
	ByFingerprint         map[string]*domain.FaeRating
	ByAgentAndFingerprint map[string]*domain.FaeRating
	FetchedAt             time.Time
	refreshErr            error
}

type cachedProfile struct {
	result    *ProfileResult
	expiresAt time.Time
}

type Client struct {
	baseURL               string
	httpClient            *http.Client
	ttl                   time.Duration
	cooldown              time.Duration
	userAgent             string
	maxConcurrentSwitches int

	mu                sync.RWMutex
	cache             map[string]*cachedProfile
	lastFetchShowcase map[string]time.Time

	sflight singleflight.Group
}

var _ domain.FaeFetcher = (*Client)(nil)

func NewClient(opts ...Option) *Client {
	c := &Client{
		baseURL:               DefaultBaseURL,
		httpClient:            &http.Client{Timeout: DefaultTimeout},
		ttl:                   DefaultTTL,
		cooldown:              DefaultCooldown,
		userAgent:             DefaultUserAgent,
		maxConcurrentSwitches: DefaultMaxConcurrentSwitches,
		cache:                 make(map[string]*cachedProfile),
		lastFetchShowcase:     make(map[string]time.Time),
	}
	for _, opt := range opts {
		opt(c)
	}
	return c
}

func (c *Client) FetchProfileRatings(ctx context.Context, uid string, forceRefresh bool) (map[int]*domain.FaeRating, error) {
	res, err := c.FetchProfileDetailed(ctx, uid, forceRefresh)
	if err != nil {
		return nil, err
	}
	return res.Ratings, nil
}

func (c *Client) LookupByFingerprint(uid string, agentID int, fingerprint string) (*domain.FaeRating, bool) {
	if uid == "" || fingerprint == "" {
		return nil, false
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	cached, ok := c.cache[uid]
	if !ok || cached == nil || cached.result == nil {
		return nil, false
	}
	if agentID > 0 {
		key := fmt.Sprintf("%d:%s", agentID, fingerprint)
		if r, ok := cached.result.ByAgentAndFingerprint[key]; ok && r != nil {
			return r, true
		}
	}
	if r, ok := cached.result.ByFingerprint[fingerprint]; ok && r != nil {
		return r, true
	}
	return nil, false
}

func (c *Client) FetchProfileDetailed(ctx context.Context, uid string, forceRefresh bool) (*ProfileResult, error) {
	if !forceRefresh {
		c.mu.RLock()
		if cached, ok := c.cache[uid]; ok && time.Now().Before(cached.expiresAt) {
			c.mu.RUnlock()
			return cached.result, nil
		}
		c.mu.RUnlock()
	}

	key := uid
	val, err, _ := c.sflight.Do(key, func() (any, error) {
		if !forceRefresh {
			c.mu.RLock()
			if cached, ok := c.cache[uid]; ok && time.Now().Before(cached.expiresAt) {
				c.mu.RUnlock()
				return cached.result, nil
			}
			c.mu.RUnlock()
		}

		return c.doFetchProfile(ctx, uid)
	})
	result, _ := val.(*ProfileResult)
	if forceRefresh && result != nil && result.refreshErr != nil {
		return nil, result.refreshErr
	}
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) doFetchProfile(ctx context.Context, uid string) (*ProfileResult, error) {
	preHTML, preStatusCode, err := c.getProfileHTML(ctx, uid)
	if err != nil && preStatusCode != http.StatusNotFound {
		return nil, err
	}

	preCards := ParseProfileCards(preHTML)

	didRefresh := false

	c.mu.Lock()
	last, hasCooldown := c.lastFetchShowcase[uid]
	canRefresh := !hasCooldown || time.Since(last) >= c.cooldown
	if canRefresh {
		c.lastFetchShowcase[uid] = time.Now()
	}
	c.mu.Unlock()

	var refreshErr error
	if canRefresh {
		refreshErr = c.postFetchShowcase(ctx, uid)
		didRefresh = refreshErr == nil
	}

	cardsToProcess := preCards
	var postCards []CardParseResult
	if didRefresh {
		postHTML, postStatus, postErr := c.getProfileHTML(ctx, uid)
		refreshErr = postErr
		if postStatus == http.StatusNotFound {
			refreshErr = fmt.Errorf("%w: zfae profile %s", domain.ErrNotFound, uid)
		}
		if postErr == nil && postStatus == http.StatusOK {
			postCards = ParseProfileCards(postHTML)
			if len(postCards) > 0 {
				cardsToProcess = postCards
			}
		}
	}

	if len(cardsToProcess) == 0 && preStatusCode == http.StatusNotFound {
		return &ProfileResult{refreshErr: refreshErr}, fmt.Errorf("%w: zfae profile %s", domain.ErrNotFound, uid)
	}

	c.normalizeCardsLeaderboard(ctx, cardsToProcess)

	now := time.Now()
	res := &ProfileResult{
		UID:                   uid,
		Ratings:               make(map[int]*domain.FaeRating),
		AllRatings:            make([]*domain.FaeRating, 0, len(cardsToProcess)+len(preCards)),
		ByFingerprint:         make(map[string]*domain.FaeRating),
		ByAgentAndFingerprint: make(map[string]*domain.FaeRating),
		FetchedAt:             now,
		refreshErr:            refreshErr,
	}

	for _, card := range preCards {
		if card.Rating != nil {
			res.AllRatings = append(res.AllRatings, card.Rating)
			if card.Rating.EquipmentFingerprint != nil && *card.Rating.EquipmentFingerprint != "" {
				res.ByFingerprint[*card.Rating.EquipmentFingerprint] = card.Rating
				if card.AgentID > 0 {
					res.ByAgentAndFingerprint[fmt.Sprintf("%d:%s", card.AgentID, *card.Rating.EquipmentFingerprint)] = card.Rating
				}
			}
		}
	}

	for _, card := range cardsToProcess {
		if card.Rating != nil {
			res.Ratings[card.AgentID] = card.Rating
			res.AllRatings = append(res.AllRatings, card.Rating)
			if card.Rating.EquipmentFingerprint != nil && *card.Rating.EquipmentFingerprint != "" {
				res.ByFingerprint[*card.Rating.EquipmentFingerprint] = card.Rating
				if card.AgentID > 0 {
					res.ByAgentAndFingerprint[fmt.Sprintf("%d:%s", card.AgentID, *card.Rating.EquipmentFingerprint)] = card.Rating
				}
			}
		}
	}

	c.mu.Lock()
	c.cache[uid] = &cachedProfile{
		result:    res,
		expiresAt: now.Add(c.ttl),
	}
	c.mu.Unlock()

	return res, nil
}

func (c *Client) normalizeCardsLeaderboard(ctx context.Context, cards []CardParseResult) {
	sem := make(chan struct{}, c.maxConcurrentSwitches)
	var wg sync.WaitGroup

	for i := range cards {
		card := &cards[i]
		if card.ActiveLeaderboardID > 0 && card.AssessmentID != "" {
			wg.Add(1)
			go func(cRef *CardParseResult) {
				defer wg.Done()
				select {
				case sem <- struct{}{}:
					defer func() { <-sem }()
				case <-ctx.Done():
					return
				}

				html, err := c.postSwitchLeaderboard(ctx, cRef.AssessmentID, 0)
				if err != nil {
					return
				}
				if newCard, ok := ParseCardHTML(html); ok && newCard.Rating != nil {
					cRef.Rating = newCard.Rating
					cRef.ActiveLeaderboardID = newCard.ActiveLeaderboardID
				}
			}(card)
		}
	}

	wg.Wait()
}

func (c *Client) getProfileHTML(ctx context.Context, uid string) (string, int, error) {
	reqURL := fmt.Sprintf("%s/profile/%s", c.baseURL, url.PathEscape(uid))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return "", 0, fmt.Errorf("failed to create profile request: %w", err)
	}
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", 0, fmt.Errorf("failed to fetch zfae profile: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusNotFound {
		return "", resp.StatusCode, nil
	}
	if resp.StatusCode == http.StatusTooManyRequests {
		return "", resp.StatusCode, fmt.Errorf("%w: zfae rate limit", domain.ErrRateLimited)
	}
	if resp.StatusCode >= http.StatusInternalServerError {
		return "", resp.StatusCode, fmt.Errorf("%w: zfae upstream error %d", domain.ErrSourceUnavailable, resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return "", resp.StatusCode, fmt.Errorf("zfae unexpected status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", resp.StatusCode, fmt.Errorf("failed to read zfae profile body: %w", err)
	}
	return string(body), resp.StatusCode, nil
}

func (c *Client) postFetchShowcase(ctx context.Context, uid string) error {
	reqURL := c.baseURL + "/profile?query"
	form := url.Values{
		"task":    {"fetchShowcase"},
		"userUid": {uid},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, strings.NewReader(form.Encode()))
	if err != nil {
		return fmt.Errorf("failed to create fetchShowcase request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to post fetchShowcase: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode == http.StatusTooManyRequests {
		return fmt.Errorf("%w: zfae rate limit", domain.ErrRateLimited)
	}
	if resp.StatusCode >= http.StatusInternalServerError {
		return fmt.Errorf("%w: zfae upstream error %d", domain.ErrSourceUnavailable, resp.StatusCode)
	}
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("zfae fetchShowcase status: %d", resp.StatusCode)
	}

	return nil
}

func (c *Client) postSwitchLeaderboard(ctx context.Context, assessmentID string, leaderboardID int) (string, error) {
	reqURL := c.baseURL + "/profile?query"
	form := url.Values{
		"task":              {"switchLeaderboard"},
		"assessmentId":      {assessmentID},
		"leaderboardId":     {strconv.Itoa(leaderboardID)},
		"showDedicatedLink": {"0"},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to create switchLeaderboard request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", c.userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to post switchLeaderboard: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("zfae switchLeaderboard status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read switchLeaderboard body: %w", err)
	}
	return string(body), nil
}
