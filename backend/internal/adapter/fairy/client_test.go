package fairy

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	sdk "github.com/kirinyoku/fairy"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// newTestServer serves the given status and body for every request.
func newTestServer(t *testing.T, status int, body string) *httptest.Server {
	t.Helper()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(server.Close)
	return server
}

// newTestClient creates an adapter client pointed at the given base URL with
// retries disabled for fast, deterministic tests.
func newTestClient(t *testing.T, baseURL string) *Client {
	t.Helper()

	client, err := NewClient(Options{
		UserAgent:   "proxyloadouts-test/1.0",
		MaxAttempts: 1,
		BaseURL:     baseURL,
	})
	if err != nil {
		t.Fatalf("failed to create test client: %v", err)
	}
	return client
}

func loadFixture(t *testing.T) string {
	t.Helper()

	data, err := os.ReadFile(filepath.Join("testdata", "profile.json"))
	if err != nil {
		t.Fatalf("failed to read profile fixture: %v", err)
	}
	return string(data)
}

func TestNewClient_Defaults(t *testing.T) {
	client, err := NewClient()
	if err != nil {
		t.Fatalf("NewClient() unexpected error: %v", err)
	}
	if client == nil {
		t.Fatal("expected non-nil client")
	}

	opts := DefaultOptions()
	if opts.Timeout != 15*time.Second {
		t.Errorf("expected default timeout 15s, got %v", opts.Timeout)
	}
	if opts.MaxAttempts != 3 {
		t.Errorf("expected default max attempts 3, got %d", opts.MaxAttempts)
	}
	if opts.DefaultLang != sdk.LangEN {
		t.Errorf("expected default lang en, got %v", opts.DefaultLang)
	}
}

func TestMapError(t *testing.T) {
	cases := []struct {
		name    string
		err     error
		want    error
		wantNil bool
	}{
		{"nil", nil, nil, true},
		{"invalid uid", sdk.ErrInvalidUID, domain.ErrInvalidInput, false},
		{"profile not found", sdk.ErrProfileNotFound, domain.ErrNotFound, false},
		{"rate limit", sdk.ErrRateLimit, domain.ErrRateLimited, false},
		{"maintenance", sdk.ErrMaintenance, domain.ErrSourceUnavailable, false},
		{"network", sdk.ErrNetwork, domain.ErrSourceUnavailable, false},
		{"wrapped not found", errors.Join(errors.New("context"), sdk.ErrProfileNotFound), domain.ErrNotFound, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := mapError(tc.err)
			if tc.wantNil {
				if got != nil {
					t.Fatalf("expected nil error, got %v", got)
				}
				return
			}
			if !errors.Is(got, tc.want) {
				t.Fatalf("expected error %v, got %v", tc.want, got)
			}
		})
	}
}

func TestFetchProfile_UpstreamFixture(t *testing.T) {
	server := newTestServer(t, http.StatusOK, loadFixture(t))
	client := newTestClient(t, server.URL)

	profile, ttl, err := client.FetchProfile(context.Background(), "1301806568")
	if err != nil {
		t.Fatalf("FetchProfile() unexpected error: %v", err)
	}

	if profile == nil {
		t.Fatal("expected non-nil profile")
	}
	if profile.UID != "1301806568" {
		t.Errorf("expected uid 1301806568, got %q", profile.UID)
	}
	if profile.Nickname != "Chocola" {
		t.Errorf("expected nickname Chocola, got %q", profile.Nickname)
	}
	if ttl != 300*time.Second {
		t.Errorf("expected upstream TTL 300s, got %v", ttl)
	}
}

func TestGetProfileWithLang(t *testing.T) {
	fixture := loadFixture(t)
	if !strings.Contains(fixture, "Chocola") {
		t.Fatal("fixture unexpectedly missing expected player")
	}

	server := newTestServer(t, http.StatusOK, fixture)
	client := newTestClient(t, server.URL)

	profile, err := client.GetProfileWithLang(context.Background(), "1301806568", sdk.LangEN)
	if err != nil {
		t.Fatalf("GetProfileWithLang() unexpected error: %v", err)
	}
	if profile.Nickname != "Chocola" {
		t.Errorf("expected nickname Chocola, got %q", profile.Nickname)
	}
}

func TestGetProfile_ErrorMapping(t *testing.T) {
	cases := []struct {
		name   string
		status int
		want   error
	}{
		{"not found", http.StatusNotFound, domain.ErrNotFound},
		{"rate limited", http.StatusTooManyRequests, domain.ErrRateLimited},
		{"maintenance", http.StatusServiceUnavailable, domain.ErrSourceUnavailable},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			server := newTestServer(t, tc.status, `{"error":"..."}`)
			client := newTestClient(t, server.URL)

			_, err := client.GetProfile(context.Background(), "1301806568")
			if !errors.Is(err, tc.want) {
				t.Fatalf("expected error %v, got %v", tc.want, err)
			}
		})
	}
}

func TestFetchProfile_ErrorNotWrappedAsSuccess(t *testing.T) {
	server := newTestServer(t, http.StatusInternalServerError, `{"error":"maintenance"}`)
	client := newTestClient(t, server.URL)

	profile, _, err := client.FetchProfile(context.Background(), "1301806568")
	if err == nil {
		t.Fatal("expected error for 503 response")
	}
	if profile != nil {
		t.Error("expected nil profile on error")
	}
	if !errors.Is(err, domain.ErrSourceUnavailable) {
		t.Errorf("expected ErrSourceUnavailable, got %v", err)
	}
}
