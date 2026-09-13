package authsvc

import (
	"context"
	"database/sql"
	"encoding/base64"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

const (
	testSecret    = "test-session-secret"
	testDiscordID = "987654321098765432"
)

type mockDiscordClient struct {
	authorizeURLFn func(state string) string
	exchangeCodeFn func(ctx context.Context, code string) (string, error)
	fetchUserFn    func(ctx context.Context, accessToken string) (*domain.User, error)
}

func (m *mockDiscordClient) AuthorizeURL(state string) string {
	if m.authorizeURLFn != nil {
		return m.authorizeURLFn(state)
	}
	return "https://discord.com/oauth2/authorize?state=" + state
}

func (m *mockDiscordClient) ExchangeCode(ctx context.Context, code string) (string, error) {
	if m.exchangeCodeFn != nil {
		return m.exchangeCodeFn(ctx, code)
	}
	return "access-token-123", nil
}

func (m *mockDiscordClient) FetchUser(ctx context.Context, accessToken string) (*domain.User, error) {
	if m.fetchUserFn != nil {
		return m.fetchUserFn(ctx, accessToken)
	}
	avatar := "https://cdn.example.com/avatars/" + testDiscordID + "/abc123.png"
	return &domain.User{
		DiscordID: testDiscordID,
		Username:  "kirin",
		AvatarURL: &avatar,
	}, nil
}

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sqlite.NewDB(filepath.Join(t.TempDir(), "auth.db"))
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := sqlite.Migrate(context.Background(), db); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}
	return db
}

func newTestService(t *testing.T, discord DiscordClient, opts ...Options) *Service {
	t.Helper()

	users := sqlite.NewUserRepo(openTestDB(t))
	opt := Options{SessionSecret: testSecret}
	if len(opts) > 0 {
		opt = opts[0]
	}

	if discord == nil {
		discord = &mockDiscordClient{}
	}

	svc, err := New(users, discord, opt)
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}
	return svc
}

func TestNew_MissingSessionSecret(t *testing.T) {
	users := sqlite.NewUserRepo(openTestDB(t))
	if _, err := New(users, &mockDiscordClient{}, Options{}); err == nil {
		t.Error("expected error for empty session secret")
	}
}

func TestLoginURL_ContainsOAuthParams(t *testing.T) {
	svc := newTestService(t, &mockDiscordClient{
		authorizeURLFn: func(state string) string {
			return "https://discord.com/oauth2/authorize?client_id=123&state=" + state
		},
	})

	state, err := svc.GenerateState()
	if err != nil {
		t.Fatalf("failed to generate state: %v", err)
	}

	loginURL := svc.LoginURL(state)
	if !strings.Contains(loginURL, "state="+state) {
		t.Errorf("expected login url to contain state, got %q", loginURL)
	}
}

func TestGenerateState_RandomAndSized(t *testing.T) {
	svc := newTestService(t, nil)

	first, err := svc.GenerateState()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	second, _ := svc.GenerateState()
	if first == second {
		t.Error("expected distinct states")
	}
	if len(first) != stateSize*2 { // hex encoding
		t.Errorf("expected hex state of %d chars, got %d", stateSize*2, len(first))
	}
}

func TestExchangeCode_CreatesUser(t *testing.T) {
	svc := newTestService(t, nil)

	user, err := svc.ExchangeCode(context.Background(), "valid-code")
	if err != nil {
		t.Fatalf("exchange failed: %v", err)
	}
	if user.DiscordID != testDiscordID || user.Username != "kirin" {
		t.Errorf("unexpected user profile: %+v", user)
	}
	if user.AvatarURL == nil || *user.AvatarURL != "https://cdn.example.com/avatars/"+testDiscordID+"/abc123.png" {
		t.Errorf("unexpected avatar url: %v", user.AvatarURL)
	}
}

func TestExchangeCode_RefreshesExistingUser(t *testing.T) {
	db := openTestDB(t)
	users := sqlite.NewUserRepo(db)

	firstDiscord := &mockDiscordClient{}
	firstSvc, err := New(users, firstDiscord, Options{SessionSecret: testSecret})
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}
	first, err := firstSvc.ExchangeCode(context.Background(), "code-1")
	if err != nil {
		t.Fatalf("first exchange failed: %v", err)
	}

	secondDiscord := &mockDiscordClient{
		fetchUserFn: func(ctx context.Context, accessToken string) (*domain.User, error) {
			return &domain.User{
				DiscordID: testDiscordID,
				Username:  "kirin-v2",
			}, nil
		},
	}
	secondSvc, err := New(users, secondDiscord, Options{SessionSecret: testSecret})
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}
	second, err := secondSvc.ExchangeCode(context.Background(), "code-2")
	if err != nil {
		t.Fatalf("second exchange failed: %v", err)
	}
	if second.Username != "kirin-v2" {
		t.Errorf("expected refreshed username, got %q", second.Username)
	}
	if second.ID != first.ID {
		t.Errorf("expected same local user %s, got %s", first.ID, second.ID)
	}
}

func TestExchangeCode_InvalidCode(t *testing.T) {
	svc := newTestService(t, &mockDiscordClient{
		exchangeCodeFn: func(ctx context.Context, code string) (string, error) {
			return "", domain.ErrUnauthorized
		},
	})

	if _, err := svc.ExchangeCode(context.Background(), "bad-code"); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected ErrUnauthorized for bad code, got %v", err)
	}
}

func TestExchangeCode_EmptyCode(t *testing.T) {
	svc := newTestService(t, nil)

	if _, err := svc.ExchangeCode(context.Background(), " "); !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput for empty code, got %v", err)
	}
}

func TestExchangeCode_DiscordDown(t *testing.T) {
	svc := newTestService(t, &mockDiscordClient{
		exchangeCodeFn: func(ctx context.Context, code string) (string, error) {
			return "", domain.ErrSourceUnavailable
		},
	})

	if _, err := svc.ExchangeCode(context.Background(), "code"); !errors.Is(err, domain.ErrSourceUnavailable) {
		t.Errorf("expected ErrSourceUnavailable when discord is down, got %v", err)
	}
}

func TestSession_IssueVerifyRoundtrip(t *testing.T) {
	svc := newTestService(t, nil)

	userID := uuid.New()
	value, expiresAt, err := svc.IssueSession(userID, 2)
	if err != nil {
		t.Fatalf("failed to issue session: %v", err)
	}
	if !expiresAt.After(time.Now()) {
		t.Error("expected future expiry")
	}

	session, err := svc.VerifySession(value)
	if err != nil {
		t.Fatalf("failed to verify session: %v", err)
	}
	if session.UserID != userID {
		t.Errorf("expected user id %s, got %s", userID, session.UserID)
	}
	if session.Version != 2 {
		t.Errorf("expected version 2, got %d", session.Version)
	}
}

func TestSession_TamperedCookieRejected(t *testing.T) {
	svc := newTestService(t, nil)

	value, _, err := svc.IssueSession(uuid.New(), 1)
	if err != nil {
		t.Fatalf("failed to issue session: %v", err)
	}

	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		t.Fatalf("failed to decode issued cookie: %v", err)
	}
	raw[len(raw)-1] ^= 0xFF
	tampered := base64.RawURLEncoding.EncodeToString(raw)

	if _, err := svc.VerifySession(tampered); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected ErrUnauthorized for tampered cookie, got %v", err)
	}
	if _, err := svc.VerifySession("garbage"); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected ErrUnauthorized for garbage cookie, got %v", err)
	}
}

func TestSession_WrongSecretRejected(t *testing.T) {
	svcA := newTestService(t, nil, Options{SessionSecret: "secret-A"})
	svcB := newTestService(t, nil, Options{SessionSecret: "secret-B"})

	value, _, err := svcA.IssueSession(uuid.New(), 1)
	if err != nil {
		t.Fatalf("failed to issue session: %v", err)
	}
	if _, err := svcB.VerifySession(value); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected ErrUnauthorized across secrets, got %v", err)
	}
}

func TestSession_ExpiryRespected(t *testing.T) {
	svc := newTestService(t, nil, Options{SessionSecret: testSecret, SessionTTL: time.Nanosecond})

	value, _, err := svc.IssueSession(uuid.New(), 1)
	if err != nil {
		t.Fatalf("failed to issue session: %v", err)
	}
	time.Sleep(10 * time.Millisecond)

	if _, err := svc.VerifySession(value); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected ErrUnauthorized for expired session, got %v", err)
	}
}

func TestRevokeSession(t *testing.T) {
	db := openTestDB(t)
	users := sqlite.NewUserRepo(db)
	svc, err := New(users, &mockDiscordClient{}, Options{SessionSecret: testSecret})
	if err != nil {
		t.Fatalf("failed to create service: %v", err)
	}

	user, err := svc.ExchangeCode(context.Background(), "code-1")
	if err != nil {
		t.Fatalf("exchange failed: %v", err)
	}
	if user.TokenVersion != 1 {
		t.Fatalf("expected initial version 1, got %d", user.TokenVersion)
	}

	if err := svc.RevokeSession(context.Background(), user.ID); err != nil {
		t.Fatalf("failed to revoke session: %v", err)
	}

	got, err := users.GetByID(context.Background(), user.ID)
	if err != nil {
		t.Fatalf("failed to get user: %v", err)
	}
	if got.TokenVersion != 2 {
		t.Errorf("expected incremented token version 2, got %d", got.TokenVersion)
	}
}
