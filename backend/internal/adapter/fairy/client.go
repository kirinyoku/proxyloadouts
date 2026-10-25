// Package fairy is a thin adapter around github.com/kirinyoku/fairy (ZZZ SDK).
//
// It owns client initialization (timeouts, retries, user agent, default
// language), provides GetProfile / GetProfileWithLang wrappers, exposes the
// upstream cache TTL alongside the enriched profile, and maps SDK sentinel
// errors to domain errors so upper layers never depend on the SDK.
package fairy

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	sdk "github.com/kirinyoku/fairy"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// Options holds configuration for the fairy adapter client.
type Options struct {
	// Timeout is the upstream HTTP request timeout. Defaults to 15s.
	Timeout time.Duration

	// UserAgent identifies the app to the EnkaNetwork API.
	UserAgent string

	// DefaultLang is the default localization language for enrichment.
	DefaultLang sdk.Language

	// MaxAttempts is the total number of upstream attempts including the
	// first one (retry policy for transient failures). Defaults to 3.
	MaxAttempts int

	// BaseURL overrides the EnkaNetwork API base URL. Intended for tests,
	// mocks, and proxies only; never set it from untrusted input.
	BaseURL string
}

// DefaultOptions returns recommended adapter settings.
func DefaultOptions() Options {
	return Options{
		Timeout:     15 * time.Second,
		UserAgent:   "proxyloadouts/0.1",
		DefaultLang: sdk.LangEN,
		MaxAttempts: 3,
	}
}

// Client wraps the fairy SDK client.
type Client struct {
	sdk  *sdk.Client
	lang sdk.Language
}

// Result bundles an enriched profile with the upstream cache TTL reported by
// the EnkaNetwork API. The profile must be treated as immutable by consumers.
type Result struct {
	Profile *sdk.Profile
	// TTL is how long the upstream keeps serving this cached payload.
	TTL time.Duration
}

// NewClient creates an adapter client with the given options (defaults apply when omitted).
func NewClient(opts ...Options) (*Client, error) {
	opt := DefaultOptions()
	if len(opts) > 0 {
		opt = opts[0]
	}
	if opt.Timeout <= 0 {
		opt.Timeout = 15 * time.Second
	}
	if opt.UserAgent == "" {
		opt.UserAgent = "proxyloadouts/0.1"
	}
	if opt.DefaultLang == "" {
		opt.DefaultLang = sdk.LangEN
	}
	if opt.MaxAttempts <= 0 {
		opt.MaxAttempts = 3
	}

	client, err := sdk.NewClient(
		sdk.WithDefaultLang(opt.DefaultLang),
		sdk.WithEnkaOptions(zzz.Options{
			UserAgent:  opt.UserAgent,
			HTTPClient: &http.Client{Timeout: opt.Timeout},
			Retry:      &zzz.RetryOptions{MaxAttempts: opt.MaxAttempts},
			BaseURL:    opt.BaseURL,
		}),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize fairy client: %w", err)
	}

	return &Client{sdk: client, lang: opt.DefaultLang}, nil
}

// GetProfile fetches and enriches a player profile using the default language.
func (c *Client) GetProfile(ctx context.Context, uid string) (*sdk.Profile, error) {
	profile, err := c.sdk.GetProfile(ctx, uid)
	if err != nil {
		return nil, mapError(err)
	}
	return profile, nil
}

// GetProfileWithLang fetches and enriches a player profile using the given language.
func (c *Client) GetProfileWithLang(ctx context.Context, uid string, lang sdk.Language) (*sdk.Profile, error) {
	profile, err := c.sdk.GetProfileWithLang(ctx, uid, lang)
	if err != nil {
		return nil, mapError(err)
	}
	return profile, nil
}

// FetchProfile fetches a profile with the default language and reports the
// upstream cache TTL. Unlike GetProfile it performs a raw fetch plus in-memory
// enrichment so the TTL from the upstream payload is preserved.
func (c *Client) FetchProfile(ctx context.Context, uid string) (*sdk.Profile, time.Duration, error) {
	res, err := c.FetchProfileWithLang(ctx, uid, c.lang)
	if err != nil {
		return nil, 0, err
	}
	return res.Profile, res.TTL, nil
}

// FetchProfileWithLang fetches a profile with the given language and reports
// the upstream cache TTL.
func (c *Client) FetchProfileWithLang(ctx context.Context, uid string, lang sdk.Language) (*Result, error) {
	raw, err := c.sdk.GetRawProfile(ctx, uid)
	if err != nil {
		return nil, mapError(err)
	}

	profile, err := c.sdk.EnrichWithLang(raw, lang)
	if err != nil {
		return nil, fmt.Errorf("failed to enrich profile %q: %w", uid, err)
	}

	return &Result{Profile: profile, TTL: raw.CacheTTL()}, nil
}

// FetchRawProfile fetches the raw upstream profile from the EnkaNetwork API
// preserving the cache TTL.
func (c *Client) FetchRawProfile(ctx context.Context, uid string) (*zzz.Profile, time.Duration, error) {
	raw, err := c.sdk.GetRawProfile(ctx, uid)
	if err != nil {
		return nil, 0, mapError(err)
	}
	return raw, raw.CacheTTL(), nil
}

// EnrichProfile transforms a raw zzz.Profile into an enriched Profile using the given language.
func (c *Client) EnrichProfile(raw *zzz.Profile, lang sdk.Language) (*sdk.Profile, error) {
	if raw == nil {
		return nil, errors.New("raw profile is nil")
	}
	profile, err := c.sdk.EnrichWithLang(raw, lang)
	if err != nil {
		return nil, fmt.Errorf("failed to enrich profile: %w", err)
	}
	return profile, nil
}

// EnrichAgent transforms a raw zzz.AvatarData into an enriched Agent using the given language.
func (c *Client) EnrichAgent(raw *zzz.AvatarData, lang sdk.Language) (*sdk.Agent, error) {
	if raw == nil {
		return nil, errors.New("raw avatar is nil")
	}
	dummyProfile := &zzz.Profile{
		PlayerInfo: zzz.PlayerInfo{
			ShowcaseDetail: &zzz.ShowcaseDetail{
				AvatarList: []zzz.AvatarData{*raw},
			},
		},
	}
	profile, err := c.sdk.EnrichWithLang(dummyProfile, lang)
	if err != nil {
		return nil, fmt.Errorf("failed to enrich agent: %w", err)
	}
	if len(profile.Agents) == 0 {
		return nil, errors.New("agent enrichment returned no agents")
	}
	return &profile.Agents[0], nil
}

// mapError converts fairy SDK sentinel errors into domain errors.
func mapError(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, sdk.ErrInvalidUID):
		return fmt.Errorf("%w: %w", domain.ErrInvalidInput, err)
	case errors.Is(err, sdk.ErrProfileNotFound):
		return fmt.Errorf("%w: showcase profile not found", domain.ErrNotFound)
	case errors.Is(err, sdk.ErrRateLimit):
		return fmt.Errorf("%w: Enka rate limit exceeded", domain.ErrRateLimited)
	case errors.Is(err, sdk.ErrMaintenance), errors.Is(err, sdk.ErrNetwork):
		return fmt.Errorf("%w: %w", domain.ErrSourceUnavailable, err)
	default:
		return fmt.Errorf("unexpected upstream error: %w", err)
	}
}
