package discord

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestAuthorizeURL(t *testing.T) {
	c := NewClient(Options{
		ClientID:    "my-client-id",
		RedirectURI: "http://localhost/callback",
	})

	u := c.AuthorizeURL("xyz123")
	for _, want := range []string{
		"client_id=my-client-id",
		"redirect_uri=http%3A%2F%2Flocalhost%2Fcallback",
		"response_type=code",
		"scope=identify",
		"state=xyz123",
	} {
		if !strings.Contains(u, want) {
			t.Errorf("expected url to contain %q, got %q", want, u)
		}
	}
}

func TestExchangeCode_Success(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/oauth2/token" {
			http.NotFound(w, r)
			return
		}
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		_ = r.ParseForm()
		if r.FormValue("code") != "test-code" {
			t.Errorf("expected code test-code, got %s", r.FormValue("code"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(tokenResponse{
			AccessToken: "token-abc",
			TokenType:   "Bearer",
		})
	}))
	defer ts.Close()

	c := NewClient(Options{
		ClientID:     "id",
		ClientSecret: "secret",
		RedirectURI:  "uri",
		APIBaseURL:   ts.URL,
	})

	token, err := c.ExchangeCode(context.Background(), "test-code")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if token != "token-abc" {
		t.Errorf("expected token-abc, got %s", token)
	}
}

func TestExchangeCode_InvalidCode(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error":"invalid_grant"}`))
	}))
	defer ts.Close()

	c := NewClient(Options{APIBaseURL: ts.URL})

	_, err := c.ExchangeCode(context.Background(), "bad-code")
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected ErrUnauthorized, got %v", err)
	}
}

func TestExchangeCode_EmptyCode(t *testing.T) {
	c := NewClient(Options{})
	_, err := c.ExchangeCode(context.Background(), "  ")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput, got %v", err)
	}
}

func TestFetchUser_Success(t *testing.T) {
	avatar := "abc_hash"
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/users/@me" {
			http.NotFound(w, r)
			return
		}
		if r.Header.Get("Authorization") != "Bearer token-abc" {
			t.Errorf("expected bearer token, got %s", r.Header.Get("Authorization"))
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(discordUser{
			ID:       "12345",
			Username: "kirin",
			Avatar:   &avatar,
		})
	}))
	defer ts.Close()

	c := NewClient(Options{
		APIBaseURL: ts.URL,
		CDNBaseURL: "https://cdn.discord.com",
	})

	u, err := c.FetchUser(context.Background(), "token-abc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if u.DiscordID != "12345" || u.Username != "kirin" {
		t.Errorf("unexpected user: %+v", u)
	}
	if u.AvatarURL == nil || *u.AvatarURL != "https://cdn.discord.com/avatars/12345/abc_hash.png" {
		t.Errorf("unexpected avatar url: %v", u.AvatarURL)
	}
}

func TestFetchUser_ServerDown(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer ts.Close()

	c := NewClient(Options{APIBaseURL: ts.URL})

	_, err := c.FetchUser(context.Background(), "token")
	if !errors.Is(err, domain.ErrSourceUnavailable) {
		t.Errorf("expected ErrSourceUnavailable, got %v", err)
	}
}
