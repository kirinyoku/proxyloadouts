// Package discord provides a client adapter for the Discord OAuth2 endpoints
// and the Discord REST API.
package discord

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// Default Discord endpoints, overridable via Options for tests.
const (
	DefaultAuthorizeURL = "https://discord.com/oauth2/authorize"
	DefaultAPIBaseURL   = "https://discord.com/api"
	DefaultCDNBaseURL   = "https://cdn.discordapp.com"

	oauthScope = "identify"
)

// Options holds configuration for the Discord client adapter.
type Options struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string

	// Overridable for tests and proxies.
	AuthorizeURL string
	APIBaseURL   string
	CDNBaseURL   string
	HTTPClient   *http.Client
}

// Client interacts with the Discord OAuth2 and REST API.
type Client struct {
	opts Options
}

// NewClient creates a new Discord client adapter.
func NewClient(opts Options) *Client {
	if opts.AuthorizeURL == "" {
		opts.AuthorizeURL = DefaultAuthorizeURL
	}
	if opts.APIBaseURL == "" {
		opts.APIBaseURL = DefaultAPIBaseURL
	}
	if opts.CDNBaseURL == "" {
		opts.CDNBaseURL = DefaultCDNBaseURL
	}
	if opts.HTTPClient == nil {
		opts.HTTPClient = &http.Client{Timeout: 10 * time.Second}
	}
	return &Client{opts: opts}
}

// AuthorizeURL builds the Discord authorization redirect URL for the given CSRF state.
func (c *Client) AuthorizeURL(state string) string {
	q := url.Values{}
	q.Set("client_id", c.opts.ClientID)
	q.Set("redirect_uri", c.opts.RedirectURI)
	q.Set("response_type", "code")
	q.Set("scope", oauthScope)
	q.Set("state", state)
	return c.opts.AuthorizeURL + "?" + q.Encode()
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
}

// ExchangeCode swaps an OAuth authorization code for an access token string.
func (c *Client) ExchangeCode(ctx context.Context, code string) (string, error) {
	if strings.TrimSpace(code) == "" {
		return "", fmt.Errorf("%w: empty oauth code", domain.ErrInvalidInput)
	}

	form := url.Values{
		"client_id":     {c.opts.ClientID},
		"client_secret": {c.opts.ClientSecret},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {c.opts.RedirectURI},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.opts.APIBaseURL+"/oauth2/token", strings.NewReader(form.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to build token request: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.opts.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("%w: discord unreachable: %w", domain.ErrSourceUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		if resp.StatusCode == http.StatusBadRequest {
			return "", fmt.Errorf("%w: invalid oauth code", domain.ErrUnauthorized)
		}
		return "", fmt.Errorf("%w: token endpoint status %d: %s",
			domain.ErrSourceUnavailable, resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var token tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}
	if token.AccessToken == "" {
		return "", errors.New("token response missing access_token")
	}
	return token.AccessToken, nil
}

type discordUser struct {
	ID       string  `json:"id"`
	Username string  `json:"username"`
	Avatar   *string `json:"avatar"`
}

// FetchUser retrieves the user profile for the given access token and enriches
// the avatar CDN URL, returning a domain.User prototype.
func (c *Client) FetchUser(ctx context.Context, accessToken string) (*domain.User, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		c.opts.APIBaseURL+"/users/@me", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to build profile request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := c.opts.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: discord unreachable: %w", domain.ErrSourceUnavailable, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: profile endpoint status %d",
			domain.ErrSourceUnavailable, resp.StatusCode)
	}

	var u discordUser
	if err := json.NewDecoder(resp.Body).Decode(&u); err != nil {
		return nil, fmt.Errorf("failed to decode profile response: %w", err)
	}
	if u.ID == "" {
		return nil, errors.New("profile response missing id")
	}

	var avatarURL *string
	if u.Avatar != nil && *u.Avatar != "" {
		url := fmt.Sprintf("%s/avatars/%s/%s.png", c.opts.CDNBaseURL, u.ID, *u.Avatar)
		avatarURL = &url
	}

	return &domain.User{
		DiscordID: u.ID,
		Username:  u.Username,
		AvatarURL: avatarURL,
	}, nil
}
