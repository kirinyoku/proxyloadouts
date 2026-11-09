package zfae

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

const (
	DefaultBaseURL            = "https://zfae.net"
	DefaultTimeout            = 15 * time.Second
	DefaultCooldown           = 20 * time.Minute
	DefaultUserAgent          = "ProxyLoadouts/1.0 (+https://github.com/kirinyoku/proxyloadouts)"
	DefaultProfileLimit int64 = 8 << 20
	DefaultCardLimit    int64 = 1 << 20
)

var pipeline = make(chan struct{}, 1)
var nextRequestStart time.Time

type Option func(*Client)

func WithBaseURL(rawURL string) Option {
	return func(c *Client) { c.baseURL = strings.TrimRight(rawURL, "/") }
}
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		if hc != nil {
			c.httpClient = hc
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

// Client loads missing observations and refreshes profiles through a shared pipeline.
type Client struct {
	store        domain.FaeStore
	baseURL      string
	httpClient   *http.Client
	userAgent    string
	pacing       time.Duration
	profileLimit int64
	cardLimit    int64
}

var _ domain.FaeRefresher = (*Client)(nil)
var _ domain.FaeLoader = (*Client)(nil)

// NewClient requires a durable store so refresh admission survives restarts.
func NewClient(store domain.FaeStore, opts ...Option) *Client {
	c := &Client{
		store:        store,
		baseURL:      DefaultBaseURL,
		httpClient:   &http.Client{Timeout: DefaultTimeout},
		userAgent:    DefaultUserAgent,
		pacing:       500 * time.Millisecond,
		profileLimit: DefaultProfileLimit,
		cardLimit:    DefaultCardLimit,
	}
	for _, opt := range opts {
		opt(c)
	}
	transport := *c.httpClient
	transport.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	c.httpClient = &transport
	return c
}

// LoadProfile preserves stored observations regardless of age and fetches only on a miss.
// Once a cold fill begins, it continues if the caller cancels, for at most 45 seconds.
func (c *Client) LoadProfile(ctx context.Context, uid string) (*domain.FaeProfile, error) {
	p, err := c.store.ReadProfile(ctx, uid)
	if err != nil {
		return nil, err
	}
	if p.Current != nil {
		return p, nil
	}
	select {
	case pipeline <- struct{}{}:
		defer func() { <-pipeline }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	p, err = c.store.ReadProfile(ctx, uid)
	if err != nil {
		return nil, err
	}
	if p.Current != nil || (p.RefreshAvailableAt != nil && time.Now().Before(*p.RefreshAvailableAt)) {
		return p, nil
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	fillCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 45*time.Second)
	defer cancel()
	return c.fetchProfile(fillCtx, uid, c.load)
}

func (c *Client) RefreshProfile(ctx context.Context, uid string) (*domain.FaeProfile, error) {
	select {
	case pipeline <- struct{}{}:
		defer func() { <-pipeline }()
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return c.fetchProfile(ctx, uid, c.refresh)
}

func (c *Client) fetchProfile(ctx context.Context, uid string, fetch func(context.Context, string) error) (*domain.FaeProfile, error) {
	admission, err := c.store.ReserveRefresh(ctx, uid, time.Now(), DefaultCooldown, 1000)
	if err != nil {
		return nil, err
	}
	if admission.Outcome != domain.FaeRefreshUpdated {
		return c.result(ctx, uid, admission)
	}
	err = fetch(ctx, uid)
	if err != nil {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		if !errors.Is(err, domain.ErrSourceUnavailable) && !errors.Is(err, domain.ErrRateLimited) {
			return nil, err
		}
		admission.Outcome = domain.FaeRefreshFailed
		if errors.Is(err, domain.ErrRateLimited) {
			admission.Outcome = domain.FaeRefreshBackoff
		}
	}
	return c.result(ctx, uid, admission)
}

func (c *Client) result(ctx context.Context, uid string, admission domain.FaeRefreshAdmission) (*domain.FaeProfile, error) {
	p, err := c.store.ReadProfile(ctx, uid)
	if err != nil {
		return nil, err
	}
	p.Outcome = admission.Outcome
	if !admission.AvailableAt.IsZero() && (p.RefreshAvailableAt == nil || admission.AvailableAt.After(*p.RefreshAvailableAt)) {
		p.RefreshAvailableAt = &admission.AvailableAt
	}
	return p, nil
}

func (c *Client) load(ctx context.Context, uid string) error {
	cards, missing, err := c.profile(ctx, uid)
	if err != nil {
		return err
	}
	if missing {
		return c.fetchShowcase(ctx, uid, true)
	}
	if err := c.normalize(ctx, cards); err != nil {
		return err
	}
	return c.store.SaveObservation(ctx, uid, observation(cards))
}

func (c *Client) refresh(ctx context.Context, uid string) error {
	pre, preMissing, err := c.profile(ctx, uid)
	if err != nil {
		return err
	}
	if !preMissing {
		if err := c.normalize(ctx, pre); err != nil {
			return err
		}
		if err := c.store.SaveObservation(ctx, uid, observation(pre)); err != nil {
			return err
		}
	}
	return c.fetchShowcase(ctx, uid, preMissing)
}

func (c *Client) fetchShowcase(ctx context.Context, uid string, preMissing bool) error {
	if _, _, err := c.request(ctx, http.MethodPost, "/profile?query", url.Values{"task": {"fetchShowcase"}, "userUid": {uid}}, c.cardLimit); err != nil {
		return err
	}
	post, postMissing, err := c.profile(ctx, uid)
	if err != nil {
		return err
	}
	if postMissing && !preMissing {
		return fmt.Errorf("%w: populated profile disappeared", domain.ErrSourceUnavailable)
	}
	if err := c.normalize(ctx, post); err != nil {
		return err
	}
	return c.store.SaveObservation(ctx, uid, observation(post))
}

func observation(cards []CardParseResult) domain.FaeObservation {
	now := time.Now().UTC()
	ratings := make(map[int]*domain.FaeRating, len(cards))
	for _, card := range cards {
		r := card.Rating.Clone()
		r.ObservedAt = &now
		if r.Rank != nil {
			r.Status = domain.FaeStatusSnapshot
		}
		ratings[card.AgentID] = r
	}
	return domain.FaeObservation{ObservedAt: now, Agents: ratings}
}

func (c *Client) profile(ctx context.Context, uid string) ([]CardParseResult, bool, error) {
	body, status, err := c.request(ctx, http.MethodGet, "/profile/"+url.PathEscape(uid), nil, c.profileLimit)
	if err != nil {
		return nil, false, err
	}
	if status == http.StatusNotFound {
		return nil, true, nil
	}
	if !reProfileDocument.MatchString(body) {
		return nil, false, fmt.Errorf("%w: incomplete zfae profile document", domain.ErrSourceUnavailable)
	}
	cards := ParseProfileCards(body)
	if len(cards) == 0 || len(cards) != len(reCardStart.FindAllStringIndex(body, -1)) {
		return nil, false, fmt.Errorf("%w: malformed zfae profile", domain.ErrSourceUnavailable)
	}
	return cards, false, nil
}

func (c *Client) normalize(ctx context.Context, cards []CardParseResult) error {
	for i := range cards {
		card := &cards[i]
		if card.ActiveLeaderboardID == 0 {
			continue
		}
		if card.AssessmentID == "" {
			return fmt.Errorf("%w: missing assessment", domain.ErrSourceUnavailable)
		}
		body, _, err := c.request(ctx, http.MethodPost, "/profile?query", url.Values{"task": {"switchLeaderboard"}, "assessmentId": {card.AssessmentID}, "leaderboardId": {"0"}, "showDedicatedLink": {"0"}}, c.cardLimit)
		if err != nil {
			return err
		}
		normalized, ok := ParseCardHTML(body)
		if !ok || len(reCardStart.FindAllStringIndex(body, 2)) != 1 || normalized.AgentID != card.AgentID || normalized.AssessmentID != card.AssessmentID {
			return fmt.Errorf("%w: invalid normalized card", domain.ErrSourceUnavailable)
		}
		if !normalized.HasActiveLeaderboard || normalized.ActiveLeaderboardID != 0 {
			return fmt.Errorf("%w: invalid normalized card", domain.ErrSourceUnavailable)
		}
		*card = normalized
	}
	return nil
}

func (c *Client) request(ctx context.Context, method, path string, form url.Values, limit int64) (string, int, error) {
	if err := waitUntil(ctx, nextRequestStart); err != nil {
		return "", 0, err
	}
	backoff, err := c.store.HostBackoff(ctx)
	if err != nil {
		return "", 0, err
	}
	if time.Now().Before(backoff) {
		return "", 0, domain.ErrRateLimited
	}
	var body io.Reader
	if form != nil {
		body = strings.NewReader(form.Encode())
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return "", 0, err
	}
	req.Header.Set("User-Agent", c.userAgent)
	if form != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	nextRequestStart = time.Now().Add(c.pacing)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		if ctx.Err() != nil {
			return "", 0, ctx.Err()
		}
		if backoffErr := c.persistBackoff(ctx, time.Now().Add(10*time.Second)); backoffErr != nil {
			return "", 0, backoffErr
		}
		return "", 0, fmt.Errorf("%w: %w", domain.ErrSourceUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()
	status := resp.StatusCode
	if status == http.StatusTooManyRequests || status >= http.StatusInternalServerError {
		delay := 10 * time.Second
		if status == http.StatusTooManyRequests {
			delay = time.Minute
		}
		deadline := time.Now().Add(delay)
		if status == http.StatusTooManyRequests || status == http.StatusServiceUnavailable {
			if parsed, ok := retryAfter(resp.Header.Get("Retry-After"), time.Now()); ok {
				deadline = parsed
			}
		}
		if err := c.persistBackoff(ctx, deadline); err != nil {
			return "", status, err
		}
		if status == http.StatusTooManyRequests {
			return "", status, domain.ErrRateLimited
		}
		return "", status, domain.ErrSourceUnavailable
	}
	if status == http.StatusNotFound && method == http.MethodGet {
		return "", status, nil
	}
	if status != http.StatusOK {
		return "", status, fmt.Errorf("%w: zfae status %d", domain.ErrSourceUnavailable, status)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		if ctx.Err() != nil {
			return "", status, ctx.Err()
		}
		if backoffErr := c.persistBackoff(ctx, time.Now().Add(10*time.Second)); backoffErr != nil {
			return "", status, backoffErr
		}
		return "", status, fmt.Errorf("%w: %w", domain.ErrSourceUnavailable, err)
	}
	if int64(len(data)) > limit {
		return "", status, fmt.Errorf("%w: zfae response exceeds limit", domain.ErrSourceUnavailable)
	}
	return string(data), status, nil
}

func retryAfter(value string, now time.Time) (time.Time, bool) {
	if seconds, err := strconv.ParseInt(strings.TrimSpace(value), 10, 32); err == nil && seconds >= 0 {
		return now.Add(time.Duration(seconds) * time.Second), true
	}
	if deadline, err := http.ParseTime(value); err == nil && !deadline.Before(now) {
		return deadline, true
	}
	return time.Time{}, false
}

func waitUntil(ctx context.Context, deadline time.Time) error {
	duration := time.Until(deadline)
	if duration <= 0 {
		return ctx.Err()
	}
	timer := time.NewTimer(duration)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (c *Client) persistBackoff(ctx context.Context, deadline time.Time) error {
	policyCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
	defer cancel()
	return c.store.ExtendHostBackoff(policyCtx, deadline)
}
