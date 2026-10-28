package http

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	fairy "github.com/kirinyoku/fairy"
	"golang.org/x/time/rate"

	discordadapter "github.com/kirinyoku/proxyloadouts/backend/internal/adapter/discord"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/inmemory"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/accountsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/authsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildenrich"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// fixture is a full-stack test environment: migrated SQLite, real services,
// fake Discord API and fake showcase fetcher.
type fixture struct {
	router  http.Handler
	db      *sql.DB
	fetcher *fakeFetcher
	opts    Options
}

func newFixture(t *testing.T) *fixture {
	return newFixtureWithOpts(t, Options{FrontendURL: "http://localhost:5173"})
}

func newFixtureWithOpts(t *testing.T, opts Options) *fixture {
	t.Helper()

	db, err := sqlite.NewDB(filepath.Join(t.TempDir(), "api.db"))
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := sqlite.Migrate(context.Background(), db); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	users := sqlite.NewUserRepo(db)
	accounts := sqlite.NewAccountRepo(db)
	buildsRepo := sqlite.NewBuildRepo(db)
	teamsRepo := sqlite.NewTeamRepo(db)

	// Fake Discord OAuth API: the exchanged code selects the returned profile,
	// letting tests log in as distinct users.
	discordProfiles := map[string]map[string]any{
		"userA": {"id": "111111111111111111", "username": "kirin", "avatar": strPtr("hash-a")},
		"userB": {"id": "222222222222222222", "username": "second", "avatar": strPtr("hash-b")},
	}
	var lastCode string
	discord := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/oauth2/token":
			_ = r.ParseForm()
			lastCode = r.FormValue("code")
			_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "at-1", "token_type": "Bearer"})
		case "/users/@me":
			profile, ok := discordProfiles[lastCode]
			if !ok {
				profile = discordProfiles["userA"]
			}
			_ = json.NewEncoder(w).Encode(profile)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(discord.Close)

	discordClient := discordadapter.NewClient(discordadapter.Options{
		ClientID:     "client-1",
		ClientSecret: "secret-1",
		RedirectURI:  "http://localhost:8080/api/v1/auth/discord/callback",
		APIBaseURL:   discord.URL,
		CDNBaseURL:   "https://cdn.example.com",
	})

	authSvc, err := authsvc.New(users, discordClient, authsvc.Options{
		SessionSecret: "test-secret",
	})
	if err != nil {
		t.Fatalf("failed to create auth service: %v", err)
	}

	scannerFetcher := &fakeFetcher{}
	scanCache := inmemory.NewProfileCache[*zzz.Profile](1000, time.Minute)
	t.Cleanup(scanCache.Close)
	scanner := scannersvc.New(scannerFetcher, scanCache)

	accountSvc := accountsvc.New(accounts, accountsvc.WithUsers(users))

	// Exercise the same memoizing localizer production wires, so the API tests
	// cover the enrichment path as it actually runs.
	localizer := buildenrich.New(scanner, nil, 0)

	router := NewRouter(
		opts,
		Deps{
			DB:       db,
			Auth:     authSvc,
			Scanner:  scanner,
			Users:    users,
			Accounts: accountSvc,
			Builds:   buildsvc.New(buildsRepo, accounts, buildsvc.WithEnricher(localizer), buildsvc.WithUsers(users)),
			Teams:    teamsvc.New(teamsRepo, buildsRepo, accounts, teamsvc.WithEnricher(localizer), teamsvc.WithUsers(users)),
		},
	)
	return &fixture{router: router, db: db, fetcher: scannerFetcher, opts: opts}
}

func strPtr(s string) *string { return &s }

type fakeFetcher struct {
	profile *fairy.Profile
	agent   *fairy.Agent
	ttl     time.Duration
}

func (f *fakeFetcher) FetchRawProfile(_ context.Context, uid string) (*zzz.Profile, time.Duration, error) {
	if f.ttl == 0 {
		f.ttl = 60 * time.Second
	}
	return &zzz.Profile{UID: uid}, f.ttl, nil
}

func (f *fakeFetcher) EnrichProfile(raw *zzz.Profile, lang fairy.Language) (*fairy.Profile, error) {
	if f.profile == nil {
		f.profile = &fairy.Profile{UID: raw.UID, Nickname: "Chocola", Region: fairy.RegionEU}
	}
	return f.profile, nil
}

func (f *fakeFetcher) EnrichAgent(raw *zzz.AvatarData, lang fairy.Language) (*fairy.Agent, error) {
	if f.agent != nil {
		copyAgent := *f.agent
		copyAgent.ID = raw.ID
		if lang == fairy.LangEN {
			copyAgent.Name = "Agent EN"
		}
		return &copyAgent, nil
	}
	name := "Агент RU"
	if lang == fairy.LangEN {
		name = "Agent EN"
	}
	return &fairy.Agent{
		ID:   raw.ID,
		Name: name,
	}, nil
}

// do performs a request against the router, marshaling body as JSON.
func (f *fixture) do(t *testing.T, method, path string, body any, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()

	raw := ""
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("failed to marshal request body: %v", err)
		}
		raw = string(encoded)
	}
	return f.doRaw(t, method, path, raw, cookies...)
}

// doRaw performs a request with a pre-encoded body against the router.
func (f *fixture) doRaw(t *testing.T, method, path, rawBody string, cookies ...*http.Cookie) *httptest.ResponseRecorder {
	t.Helper()

	req := httptest.NewRequest(method, path, strings.NewReader(rawBody))
	req.Header.Set("Content-Type", "application/json")
	origin := f.opts.FrontendURL
	if origin == "" {
		origin = "http://localhost:5173"
	}
	req.Header.Set("Origin", origin)
	for _, c := range cookies {
		req.AddCookie(c)
	}

	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)
	return rec
}

func decodeBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()

	var out map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to decode response %q: %v", rec.Body.String(), err)
	}
	return out
}

func decodeBodyList(t *testing.T, rec *httptest.ResponseRecorder) []any {
	t.Helper()

	var out []any
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("failed to decode response %q: %v", rec.Body.String(), err)
	}
	return out
}

// login performs the OAuth flow as the default user and returns the session cookie.
func (f *fixture) login(t *testing.T) *http.Cookie {
	t.Helper()
	return f.loginAs(t, "userA")
}

// loginAs performs the full OAuth flow for the given fake profile code.
func (f *fixture) loginAs(t *testing.T, code string) *http.Cookie {
	t.Helper()

	loginRec := f.do(t, http.MethodGet, "/api/v1/auth/discord/login", nil)
	if loginRec.Code != http.StatusFound {
		t.Fatalf("expected login redirect, got %d", loginRec.Code)
	}
	var stateCookie *http.Cookie
	for _, c := range loginRec.Result().Cookies() {
		if c.Name == stateCookieName {
			stateCookie = c
		}
	}
	if stateCookie == nil {
		t.Fatal("expected oauth state cookie on login")
	}

	callbackRec := f.do(t, http.MethodGet,
		fmt.Sprintf("/api/v1/auth/discord/callback?code=%s&state=%s", code, stateCookie.Value), nil, stateCookie)
	if callbackRec.Code != http.StatusFound {
		t.Fatalf("expected callback redirect, got %d: %s", callbackRec.Code, callbackRec.Body.String())
	}
	var sessionCookie *http.Cookie
	var stateCleared bool
	for _, c := range callbackRec.Result().Cookies() {
		if c.Name == sessionCookieName(f.opts.SecureCookies) {
			sessionCookie = c
		}
		if c.Name == stateCookieName && c.MaxAge < 0 {
			stateCleared = true
		}
	}
	if !stateCleared {
		t.Error("expected oauth state cookie to be cleared after callback")
	}
	if sessionCookie == nil {
		t.Fatal("expected session cookie after callback")
	}
	return sessionCookie
}

func TestHealthEndpoints(t *testing.T) {
	f := newFixture(t)

	for _, path := range []string{"/health", "/api/v1/health"} {
		rec := f.do(t, http.MethodGet, path, nil)
		if rec.Code != http.StatusOK {
			t.Errorf("%s: expected 200, got %d", path, rec.Code)
		}
		body := decodeBody(t, rec)
		if body["status"] != "ok" {
			t.Errorf("%s: expected status ok, got %v", path, body["status"])
		}
		if body["database"] != "connected" {
			t.Errorf("%s: expected database connected, got %v", path, body["database"])
		}
	}
}

type failingPinger struct{}

func (failingPinger) PingContext(ctx context.Context) error {
	return errors.New("database locked")
}

func TestHealthEndpoints_DegradedWhenDBFails(t *testing.T) {
	router := NewRouter(
		Options{FrontendURL: "http://localhost:5173"},
		Deps{DB: failingPinger{}},
	)

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("expected 503 Service Unavailable, got %d", rec.Code)
	}

	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}
	if body["status"] != "degraded" {
		t.Errorf("expected status degraded, got %v", body["status"])
	}
	if body["database"] != "unreachable" {
		t.Errorf("expected database unreachable, got %v", body["database"])
	}
}

func TestCORSPreflight(t *testing.T) {
	f := newFixture(t)

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/health", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusNoContent {
		t.Fatalf("expected preflight success, got %d", rec.Code)
	}
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:5173" {
		t.Errorf("expected CORS origin header, got %q", got)
	}
}

func TestAuthFlow_LoginCallbackMeLogout(t *testing.T) {
	f := newFixture(t)

	session := f.login(t)

	meRec := f.do(t, http.MethodGet, "/api/v1/auth/me", nil, session)
	if meRec.Code != http.StatusOK {
		t.Fatalf("expected /auth/me 200, got %d: %s", meRec.Code, meRec.Body.String())
	}
	body := decodeBody(t, meRec)
	user, _ := body["user"].(map[string]any)
	if user == nil || user["username"] != "kirin" {
		t.Errorf("expected user kirin in /auth/me response, got %v", body)
	}
	limits, _ := body["limits"].(map[string]any)
	if limits == nil || limits["max_builds_per_agent"] != float64(domain.MaxBuildsPerAgent) || limits["max_teams_per_account"] != float64(domain.MaxTeamsPerAccount) || limits["max_accounts_per_user"] != float64(domain.MaxAccountsPerUser) {
		t.Errorf("expected default limits (%d, %d, %d), got %v", domain.MaxBuildsPerAgent, domain.MaxTeamsPerAccount, domain.MaxAccountsPerUser, limits)
	}

	logoutRec := f.do(t, http.MethodPost, "/api/v1/auth/logout", nil, session)
	if logoutRec.Code != http.StatusNoContent {
		t.Errorf("expected logout 204, got %d", logoutRec.Code)
	}

	// The response must clear the cookie (Max-Age < 0).
	var cleared bool
	for _, c := range logoutRec.Result().Cookies() {
		if c.Name == sessionCookieName(f.opts.SecureCookies) && c.MaxAge < 0 {
			cleared = true
		}
	}
	if !cleared {
		t.Error("expected logout to clear the session cookie")
	}

	// Server-side revocation: replaying the logged-out session cookie must be rejected (401).
	replayedRec := f.do(t, http.MethodGet, "/api/v1/auth/me", nil, session)
	if replayedRec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for replayed session after logout, got %d: %s", replayedRec.Code, replayedRec.Body.String())
	}
	if errStr, _ := decodeBody(t, replayedRec)["error"].(string); errStr != "session revoked" {
		t.Errorf("expected 'session revoked' error, got %q", errStr)
	}

	// Requests without cookie are unauthorized.
	noCookieRec := f.do(t, http.MethodGet, "/api/v1/auth/me", nil)
	if noCookieRec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without cookie, got %d", noCookieRec.Code)
	}
}

func TestAuth_SessionRevocationPreventsReplay(t *testing.T) {
	f := newFixture(t)

	// 1. First login yields session cookie 1 (version 1).
	cookieV1 := f.login(t)

	// Verify cookie 1 is active.
	rec1 := f.do(t, http.MethodGet, "/api/v1/auth/me", nil, cookieV1)
	if rec1.Code != http.StatusOK {
		t.Fatalf("expected /auth/me 200 with cookieV1, got %d", rec1.Code)
	}

	// 2. User logs out.
	logoutRec := f.do(t, http.MethodPost, "/api/v1/auth/logout", nil, cookieV1)
	if logoutRec.Code != http.StatusNoContent {
		t.Fatalf("expected logout 204, got %d", logoutRec.Code)
	}

	// 3. Stolen / replayed cookie 1 must be rejected.
	replayRec := f.do(t, http.MethodGet, "/api/v1/auth/me", nil, cookieV1)
	if replayRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when replaying revoked cookieV1, got %d", replayRec.Code)
	}

	// 4. User logs in again, receiving session cookie 2 (version 2).
	cookieV2 := f.login(t)
	rec2 := f.do(t, http.MethodGet, "/api/v1/auth/me", nil, cookieV2)
	if rec2.Code != http.StatusOK {
		t.Fatalf("expected /auth/me 200 with cookieV2, got %d", rec2.Code)
	}

	// 5. Old cookie 1 remains rejected.
	replayAgainRec := f.do(t, http.MethodGet, "/api/v1/auth/me", nil, cookieV1)
	if replayAgainRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 when replaying old cookieV1 while cookieV2 is active, got %d", replayAgainRec.Code)
	}
}

func TestAuth_CallbackStateMismatch(t *testing.T) {
	f := newFixture(t)

	rec := f.do(t, http.MethodGet, "/api/v1/auth/discord/callback?code=x&state=wrong", nil,
		&http.Cookie{Name: stateCookieName, Value: "right"})
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 for state mismatch, got %d", rec.Code)
	}

	var stateCleared bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == stateCookieName && c.MaxAge < 0 && c.Path == "/api/v1/auth" {
			stateCleared = true
		}
	}
	if !stateCleared {
		t.Error("expected state mismatch to clear state cookie immediately")
	}
}

func TestAuth_CallbackStateMissing(t *testing.T) {
	f := newFixture(t)

	rec := f.do(t, http.MethodGet, "/api/v1/auth/discord/callback?code=x&state=some-state", nil)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for missing oauth state cookie, got %d", rec.Code)
	}
}

func TestAuth_CallbackUserCancelled(t *testing.T) {
	f := newFixture(t)

	rec := f.do(t, http.MethodGet, "/api/v1/auth/discord/callback?error=access_denied&error_description=The+user+denied+you", nil,
		&http.Cookie{Name: stateCookieName, Value: "some-state"})
	if rec.Code != http.StatusFound {
		t.Fatalf("expected 302 Found redirect for OAuth cancellation, got %d", rec.Code)
	}
	loc := rec.Header().Get("Location")
	if !strings.Contains(loc, "error=access_denied") {
		t.Errorf("expected redirect Location to contain error=access_denied, got %q", loc)
	}

	var stateCleared bool
	for _, c := range rec.Result().Cookies() {
		if c.Name == stateCookieName && c.MaxAge < 0 {
			stateCleared = true
		}
	}
	if !stateCleared {
		t.Error("expected state cookie to be cleared after cancellation")
	}
}

func TestAuth_ProductionCookiePrefix(t *testing.T) {
	f := newFixtureWithOpts(t, Options{
		FrontendURL:   "https://app.proxyloadouts.com",
		SecureCookies: true,
	})

	cookie := f.login(t)
	if cookie.Name != hostSessionCookieName {
		t.Fatalf("expected session cookie name %q, got %q", hostSessionCookieName, cookie.Name)
	}
	if !cookie.Secure {
		t.Errorf("expected Secure=true for __Host- cookie")
	}
	if cookie.Path != "/" {
		t.Errorf("expected Path=/ for __Host- cookie, got %q", cookie.Path)
	}
	if cookie.Domain != "" {
		t.Errorf("expected empty Domain for __Host- cookie, got %q", cookie.Domain)
	}

	// Verify authenticated request works with __Host-pl_session
	meRec := f.do(t, http.MethodGet, "/api/v1/auth/me", nil, cookie)
	if meRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK from /auth/me, got %d", meRec.Code)
	}

	// Verify logout clears __Host-pl_session
	logoutRec := f.do(t, http.MethodPost, "/api/v1/auth/logout", nil, cookie)
	if logoutRec.Code != http.StatusNoContent {
		t.Fatalf("expected 204 from /auth/logout, got %d", logoutRec.Code)
	}

	var hostCleared bool
	for _, c := range logoutRec.Result().Cookies() {
		if c.Name == hostSessionCookieName && c.MaxAge < 0 {
			hostCleared = true
		}
	}
	if !hostCleared {
		t.Errorf("expected logout to clear %s", hostSessionCookieName)
	}
}

func TestAuth_ProductionCookieFallback(t *testing.T) {
	f := newFixtureWithOpts(t, Options{
		FrontendURL:   "https://app.proxyloadouts.com",
		SecureCookies: true,
	})

	cookie := f.login(t)
	// Clone as legacy defaultSessionCookieName to simulate rolling deployment
	legacyCookie := &http.Cookie{
		Name:  defaultSessionCookieName,
		Value: cookie.Value,
	}

	meRec := f.do(t, http.MethodGet, "/api/v1/auth/me", nil, legacyCookie)
	if meRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK with legacy cookie during production transition, got %d", meRec.Code)
	}
}

func TestProtectedWithoutSession(t *testing.T) {
	f := newFixture(t)

	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/api/v1/accounts"},
		{http.MethodPost, "/api/v1/accounts"},
		{http.MethodGet, "/api/v1/builds?game_account_id=00000000-0000-0000-0000-000000000000"},
		{http.MethodPost, "/api/v1/builds"},
		{http.MethodGet, "/api/v1/teams/validate?build_ids=00000000-0000-0000-0000-000000000001,00000000-0000-0000-0000-000000000002"},
		{http.MethodGet, "/api/v1/teams/count?game_account_id=00000000-0000-0000-0000-000000000000"},
	} {
		rec := f.do(t, tc.method, tc.path, nil)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s %s: expected 401 without session, got %d", tc.method, tc.path, rec.Code)
		}
	}
}

func TestAccountsCRUD(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	createRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, session)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected account created, got %d: %s", createRec.Code, createRec.Body.String())
	}
	account := decodeBody(t, createRec)
	accountID, _ := account["id"].(string)
	if accountID == "" || account["region"] != "Europe" {
		t.Errorf("unexpected account payload: %v", account)
	}

	dupRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, session)
	if dupRec.Code != http.StatusConflict {
		t.Errorf("expected duplicate uid conflict, got %d", dupRec.Code)
	}

	badRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "nope"}, session)
	if badRec.Code != http.StatusBadRequest {
		t.Errorf("expected invalid uid rejection, got %d", badRec.Code)
	}

	listRec := f.do(t, http.MethodGet, "/api/v1/accounts", nil, session)
	if listRec.Code != http.StatusOK {
		t.Errorf("expected list 200, got %d", listRec.Code)
	}
	if list := decodeBodyList(t, listRec); len(list) != 1 {
		t.Errorf("expected one linked account, got %d (%s)", len(list), listRec.Body.String())
	}

	// Link accounts up to MaxAccountsPerUser limit (accounts 2 and 3).
	rec2 := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687051"}, session)
	if rec2.Code != http.StatusCreated {
		t.Fatalf("expected account 2 created, got %d", rec2.Code)
	}
	account2ID, _ := decodeBody(t, rec2)["id"].(string)

	rec3 := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687052"}, session)
	if rec3.Code != http.StatusCreated {
		t.Fatalf("expected account 3 created, got %d", rec3.Code)
	}
	account3ID, _ := decodeBody(t, rec3)["id"].(string)

	// Attempting to exceed MaxAccountsPerUser limit (4th account) returns 409 Conflict.
	overLimitRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687053"}, session)
	if overLimitRec.Code != http.StatusConflict {
		t.Errorf("expected 409 Conflict when exceeding account limit, got %d", overLimitRec.Code)
	}

	// Clean up accounts 2 and 3.
	f.do(t, http.MethodDelete, "/api/v1/accounts/"+account2ID, nil, session)
	f.do(t, http.MethodDelete, "/api/v1/accounts/"+account3ID, nil, session)

	delRec := f.do(t, http.MethodDelete, "/api/v1/accounts/"+accountID, nil, session)
	if delRec.Code != http.StatusNoContent {
		t.Errorf("expected delete 204, got %d", delRec.Code)
	}
}

// seedBuild creates a build through the API and returns its id.
func (f *fixture) seedBuild(t *testing.T, session *http.Cookie, accountID string, agentID int, agentName, discUID string) string {
	t.Helper()

	payload := map[string]any{
		"id": agentID, "name": agentName, "level": 60,
		"drive_discs": map[string]any{
			"slots": []any{map[string]any{"uid": discUID, "slot": 1}},
		},
	}
	rawAvatarBytes, _ := json.Marshal(zzz.AvatarData{ID: agentID})
	rec := f.do(t, http.MethodPost, "/api/v1/builds", map[string]any{
		"game_account_id":   accountID,
		"name":              agentName + " Build",
		"raw_agent_payload": payload,
		"raw_data":          json.RawMessage(rawAvatarBytes),
	}, session)
	if rec.Code != http.StatusCreated {
		t.Fatalf("build create failed with %d: %s", rec.Code, rec.Body.String())
	}
	body := decodeBody(t, rec)
	id, _ := body["id"].(string)
	if id == "" {
		t.Fatalf("expected build id in response: %v", body)
	}
	if body["agent_id"].(float64) != float64(agentID) {
		t.Errorf("expected agent_id %d, got %v", agentID, body["agent_id"])
	}
	discs, _ := body["disc_uids"].([]any)
	if len(discs) != 1 || discs[0] != discUID {
		t.Errorf("expected extracted disc uid, got %v", discs)
	}
	return id
}

func TestBuildsCRUD(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	accountRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, session)
	accountID, _ := decodeBody(t, accountRec)["id"].(string)

	buildID := f.seedBuild(t, session, accountID, 1511, "Miyabi", "33041_12345678")

	patchRec := f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID, map[string]string{"name": "Renamed"}, session)
	if patchRec.Code != http.StatusNoContent {
		t.Errorf("expected rename 204, got %d: %s", patchRec.Code, patchRec.Body.String())
	}

	getRec := f.do(t, http.MethodGet, "/api/v1/builds/"+buildID, nil, session)
	if getRec.Code != http.StatusOK {
		t.Errorf("expected get 200, got %d", getRec.Code)
	}
	if got := decodeBody(t, getRec); got["name"] != "Renamed" {
		t.Errorf("expected renamed build, got %v", got["name"])
	}

	delRec := f.do(t, http.MethodDelete, "/api/v1/builds/"+buildID, nil, session)
	if delRec.Code != http.StatusNoContent {
		t.Errorf("expected delete 204, got %d", delRec.Code)
	}
}

func TestTeamsValidateCreateAndConflict(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	accountRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, session)
	accountID, _ := decodeBody(t, accountRec)["id"].(string)

	first := f.seedBuild(t, session, accountID, 1511, "Miyabi", "33041_11111111")
	second := f.seedBuild(t, session, accountID, 1411, "Ellen", "31000_22222222")

	validateRec := f.do(t, http.MethodGet, "/api/v1/teams/validate?build_ids="+first+","+second, nil, session)
	if validateRec.Code != http.StatusOK {
		t.Fatalf("validate failed: %s", validateRec.Body.String())
	}
	report := decodeBody(t, validateRec)
	if report["is_valid"] != true {
		t.Errorf("expected valid report, got %v", report)
	}

	// The report is a deterministic function of the referenced builds, so it is
	// safe to let the browser reuse it briefly. `private` keeps it out of shared
	// caches, and Vary: Cookie scopes a shared cache to the session. Vary is
	// legitimately multi-valued (the CORS layer contributes Origin), so the
	// membership check must look at all values, not just the first.
	if cc := validateRec.Header().Get("Cache-Control"); cc != "private, max-age=60" {
		t.Errorf("expected a private cache policy on the report, got %q", cc)
	}
	if !slices.Contains(validateRec.Header().Values("Vary"), "Cookie") {
		t.Errorf("expected Vary to include Cookie, got %q", validateRec.Header().Values("Vary"))
	}

	createRec := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accountID,
		"name":            "Ice Mono",
		"build_ids":       []string{first, second},
	}, session)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("team create failed: %s", createRec.Body.String())
	}
	team := decodeBody(t, createRec)
	teamID, _ := team["id"].(string)

	// Conflicting composition: same build twice → DUPLICATE_AGENT → 422 + report.
	conflictRec := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accountID,
		"name":            "Broken",
		"build_ids":       []string{first, first},
	}, session)
	if conflictRec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected conflict rejection 422, got %d: %s", conflictRec.Code, conflictRec.Body.String())
	}
	conflictBody := decodeBody(t, conflictRec)
	if _, has := conflictBody["conflicts"]; !has {
		t.Error("expected conflicts report in rejection payload")
	}

	detailRec := f.do(t, http.MethodGet, "/api/v1/teams/"+teamID, nil, session)
	if detailRec.Code != http.StatusOK {
		t.Fatalf("team detail failed: %s", detailRec.Body.String())
	}
	detail := decodeBody(t, detailRec)
	members, _ := detail["members"].([]any)
	if len(members) != 2 {
		t.Errorf("expected 2 members with builds, got %d", len(members))
	}

	deleteRec := f.do(t, http.MethodDelete, "/api/v1/teams/"+teamID, nil, session)
	if deleteRec.Code != http.StatusNoContent {
		t.Errorf("expected delete 204, got %d", deleteRec.Code)
	}
}

func TestShowcaseEndpointPublic(t *testing.T) {
	f := newFixture(t)

	rec := f.do(t, http.MethodGet, "/api/v1/showcase/1504687050", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("expected public showcase 200, got %d: %s", rec.Code, rec.Body.String())
	}
	body := decodeBody(t, rec)
	if body["nickname"] != "Chocola" || body["source"] != "fresh" {
		t.Errorf("unexpected showcase payload: %v", body)
	}

	badRec := f.do(t, http.MethodGet, "/api/v1/showcase/nope", nil)
	if badRec.Code != http.StatusBadRequest {
		t.Errorf("expected invalid uid 400, got %d", badRec.Code)
	}
}

func TestShowcaseEndpointRateLimit(t *testing.T) {
	limiter := NewIPRateLimiter(rate.Limit(1.0), 3, time.Minute)
	defer limiter.Close()

	db, err := sqlite.NewDB(filepath.Join(t.TempDir(), "api.db"))
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := sqlite.Migrate(context.Background(), db); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}

	users := sqlite.NewUserRepo(db)
	accounts := sqlite.NewAccountRepo(db)
	buildsRepo := sqlite.NewBuildRepo(db)
	teamsRepo := sqlite.NewTeamRepo(db)

	authSvc, _ := authsvc.New(users, discordadapter.NewClient(discordadapter.Options{}), authsvc.Options{SessionSecret: "test-secret"})
	scannerFetcher := &fakeFetcher{}
	scanCache := inmemory.NewProfileCache[*zzz.Profile](1000, time.Minute)
	t.Cleanup(scanCache.Close)
	scanner := scannersvc.New(scannerFetcher, scanCache)
	accountSvc := accountsvc.New(accounts, accountsvc.WithUsers(users))
	localizer := buildenrich.New(scanner, nil, 0)

	router := NewRouter(
		Options{
			FrontendURL:         "http://localhost:5173",
			ShowcaseRateLimiter: limiter,
		},
		Deps{
			Auth:     authSvc,
			Scanner:  scanner,
			Users:    users,
			Accounts: accountSvc,
			Builds:   buildsvc.New(buildsRepo, accounts, buildsvc.WithEnricher(localizer), buildsvc.WithUsers(users)),
			Teams:    teamsvc.New(teamsRepo, buildsRepo, accounts, teamsvc.WithEnricher(localizer), teamsvc.WithUsers(users)),
		},
	)

	// Requests from IP A: first 3 pass burst allowance
	for i := 1; i <= 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/api/v1/showcase/1504687050", nil)
		req.Header.Set("X-Forwarded-For", "198.51.100.1")
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i, rec.Code)
		}
	}

	// 4th request from IP A must be rate limited (429)
	req4 := httptest.NewRequest(http.MethodGet, "/api/v1/showcase/1504687050", nil)
	req4.Header.Set("X-Forwarded-For", "198.51.100.1")
	rec4 := httptest.NewRecorder()
	router.ServeHTTP(rec4, req4)
	if rec4.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 Too Many Requests, got %d", rec4.Code)
	}
	if rec4.Header().Get("Retry-After") == "" {
		t.Error("expected Retry-After header on 429 response")
	}

	// Request from IP B must succeed (isolated rate limit per IP)
	reqB := httptest.NewRequest(http.MethodGet, "/api/v1/showcase/1504687050", nil)
	reqB.Header.Set("X-Forwarded-For", "198.51.100.2")
	recB := httptest.NewRecorder()
	router.ServeHTTP(recB, reqB)
	if recB.Code != http.StatusOK {
		t.Fatalf("expected 200 for IP B, got %d", recB.Code)
	}
}

func TestSPAFallback(t *testing.T) {
	f := newFixture(t)

	rootRec := f.do(t, http.MethodGet, "/", nil)
	if rootRec.Code != http.StatusOK {
		t.Fatalf("expected index page 200, got %d", rootRec.Code)
	}
	if !strings.Contains(rootRec.Body.String(), "ProxyLoadouts") {
		t.Error("expected placeholder SPA content")
	}

	deepRec := f.do(t, http.MethodGet, "/some/client/route", nil)
	if deepRec.Code != http.StatusOK || !strings.Contains(deepRec.Body.String(), "ProxyLoadouts") {
		t.Error("expected history-API fallback to index.html")
	}

	apiRec := f.do(t, http.MethodGet, "/api/v1/unknown-endpoint", nil)
	if apiRec.Code != http.StatusNotFound {
		t.Errorf("expected unknown api route to stay 404 json, got %d", apiRec.Code)
	}
}

// embeddedAssetName returns the name of a real file under static/assets, or
// skips the test when the build has not been synced into the embed directory.
func embeddedAssetName(t *testing.T, suffix string) string {
	t.Helper()
	entries, err := fs.ReadDir(staticFS, "static/assets")
	if err != nil || len(entries) == 0 {
		t.Skip("no embedded assets in this build; run `make sync-static` first")
	}
	for _, entry := range entries {
		if strings.HasSuffix(entry.Name(), suffix) {
			return entry.Name()
		}
	}
	t.Skipf("no embedded asset with suffix %q; run `make sync-static` first", suffix)
	return ""
}

func TestStaticCacheControl(t *testing.T) {
	f := newFixture(t)

	// Content-hashed build output can be pinned for a year.
	jsName := embeddedAssetName(t, ".js")
	jsRec := f.do(t, http.MethodGet, "/assets/"+jsName, nil)
	if jsRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for embedded asset, got %d", jsRec.Code)
	}
	if got := jsRec.Header().Get("Cache-Control"); got != immutableCacheControl {
		t.Errorf("hashed asset %s: expected %q, got %q", jsName, immutableCacheControl, got)
	}

	fontName := embeddedAssetName(t, ".woff2")
	fontRec := f.do(t, http.MethodGet, "/assets/"+fontName, nil)
	if fontRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for embedded font, got %d", fontRec.Code)
	}
	if got := fontRec.Header().Get("Cache-Control"); got != immutableCacheControl {
		t.Errorf("hashed font %s: expected %q, got %q", fontName, immutableCacheControl, got)
	}

	// The SPA shell and the service worker bootstrap must be revalidated so a
	// deploy is picked up on the next navigation.
	indexRec := f.do(t, http.MethodGet, "/index.html", nil)
	if got := indexRec.Header().Get("Cache-Control"); got != revalidateCacheControl {
		t.Errorf("index.html: expected %q, got %q", revalidateCacheControl, got)
	}

	rootRec := f.do(t, http.MethodGet, "/", nil)
	if rootRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for root, got %d", rootRec.Code)
	}
	if got := rootRec.Header().Get("Cache-Control"); got != revalidateCacheControl {
		t.Errorf("root: expected %q, got %q", revalidateCacheControl, got)
	}

	swRec := f.do(t, http.MethodGet, "/sw.js", nil)
	if got := swRec.Header().Get("Cache-Control"); got != revalidateCacheControl {
		t.Errorf("sw.js: expected %q, got %q", revalidateCacheControl, got)
	}
}

func TestStaticMissingAssetIsNotFound(t *testing.T) {
	// A missing file must return 404, not the SPA shell. Answering with HTML
	// would hand the browser a text/html body for a .js URL, which surfaces as
	// a hard MIME failure on a module script instead of a diagnosable 404 — and
	// the wrong bytes would be cached at the wrong URL.
	f := newFixture(t)

	jsRec := f.do(t, http.MethodGet, "/assets/does-not-exist.js", nil)
	if jsRec.Code != http.StatusNotFound {
		t.Errorf("missing .js: expected 404, got %d", jsRec.Code)
	}
	if got := jsRec.Header().Get("Cache-Control"); got != revalidateCacheControl {
		t.Errorf("missing .js: expected %q, got %q", revalidateCacheControl, got)
	}

	cssRec := f.do(t, http.MethodGet, "/assets/does-not-exist.css", nil)
	if cssRec.Code != http.StatusNotFound {
		t.Errorf("missing .css: expected 404, got %d", cssRec.Code)
	}

	fontRec := f.do(t, http.MethodGet, "/assets/does-not-exist.woff2", nil)
	if fontRec.Code != http.StatusNotFound {
		t.Errorf("missing .woff2: expected 404, got %d", fontRec.Code)
	}

	// A 404 for a module script must not be served as HTML.
	if ct := jsRec.Header().Get("Content-Type"); strings.Contains(ct, "text/html") {
		t.Errorf("missing .js: expected a non-HTML 404 body, got Content-Type %q", ct)
	}
}

func TestStaticClientRoutesStillFallBack(t *testing.T) {
	// The extension check must not break the history-API fallback: client-side
	// routes carry no file extension.
	f := newFixture(t)

	for _, route := range []string{"/roster", "/teams/new", "/showcase", "/settings", "/some/deep/client/route"} {
		rec := f.do(t, http.MethodGet, route, nil)
		if rec.Code != http.StatusOK {
			t.Errorf("%s: expected 200 from the SPA fallback, got %d", route, rec.Code)
			continue
		}
		if !strings.Contains(rec.Body.String(), "ProxyLoadouts") {
			t.Errorf("%s: expected SPA shell content", route)
		}
	}
}

func TestAccountsAutoDetectRegion(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	cases := []struct {
		uid        string
		wantRegion string
	}{
		{"1004687050", "America"},
		{"1304687050", "Asia"},
		{"1504687050", "Europe"},
		{"1704687050", "TW/HK/MO"},
	}

	for _, tc := range cases {
		rec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": tc.uid}, session)
		if rec.Code != http.StatusCreated {
			t.Fatalf("expected account created for %s, got %d: %s", tc.uid, rec.Code, rec.Body.String())
		}
		account := decodeBody(t, rec)
		if account["region"] != tc.wantRegion {
			t.Errorf("UID %s got region %v, want %s", tc.uid, account["region"], tc.wantRegion)
		}
		f.do(t, http.MethodDelete, "/api/v1/accounts/"+account["id"].(string), nil, session)
	}
}

func TestBuilds_DynamicLocalizationHTTP(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	// Create account
	accRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, session)
	if accRec.Code != http.StatusCreated {
		t.Fatalf("account creation failed: %d", accRec.Code)
	}
	accountID := decodeBody(t, accRec)["id"].(string)

	rawAvatarBytes, _ := json.Marshal(zzz.AvatarData{ID: 1511})
	buildPayload := map[string]any{
		"game_account_id": accountID,
		"name":            "My Build",
		"raw_agent_payload": map[string]any{
			"id":   1511,
			"name": "Static Name",
		},
		"raw_data": json.RawMessage(rawAvatarBytes),
	}

	createRec := f.do(t, http.MethodPost, "/api/v1/builds", buildPayload, session)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("build creation failed: %d: %s", createRec.Code, createRec.Body.String())
	}
	buildID := decodeBody(t, createRec)["id"].(string)

	// 1. GET with ?lang=ru
	getRU := f.do(t, http.MethodGet, "/api/v1/builds/"+buildID+"?lang=ru", nil, session)
	if getRU.Code != http.StatusOK {
		t.Fatalf("get ru failed: %d", getRU.Code)
	}
	if decodeBody(t, getRU)["agent_name"] != "Агент RU" {
		t.Errorf("expected Агент RU, got %v", decodeBody(t, getRU)["agent_name"])
	}

	// 2. GET with ?lang=en
	getEN := f.do(t, http.MethodGet, "/api/v1/builds/"+buildID+"?lang=en", nil, session)
	if getEN.Code != http.StatusOK {
		t.Fatalf("get en failed: %d", getEN.Code)
	}
	if decodeBody(t, getEN)["agent_name"] != "Agent EN" {
		t.Errorf("expected Agent EN, got %v", decodeBody(t, getEN)["agent_name"])
	}

	// 3. GET list with ?lang=en
	listEN := f.do(t, http.MethodGet, "/api/v1/builds?game_account_id="+accountID+"&lang=en", nil, session)
	if listEN.Code != http.StatusOK {
		t.Fatalf("list en failed: %d", listEN.Code)
	}
	var listResp []map[string]any
	_ = json.Unmarshal(listEN.Body.Bytes(), &listResp)
	if len(listResp) == 0 || listResp[0]["agent_name"] != "Agent EN" {
		t.Errorf("expected Agent EN in list, got %+v", listResp)
	}
}

func TestCSRF_OriginVerification(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	// 1. Cross-site request rejected via Sec-Fetch-Site header
	reqCrossSite, _ := http.NewRequest(http.MethodPost, "/api/v1/accounts", strings.NewReader(`{"uid":"1504687050"}`))
	reqCrossSite.Header.Set("Content-Type", "application/json")
	reqCrossSite.Header.Set("Sec-Fetch-Site", "cross-site")
	reqCrossSite.AddCookie(session)
	recCrossSite := httptest.NewRecorder()
	f.router.ServeHTTP(recCrossSite, reqCrossSite)
	if recCrossSite.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for cross-site request, got %d", recCrossSite.Code)
	}

	// 2. Untrusted Origin header rejected
	reqUntrusted, _ := http.NewRequest(http.MethodPost, "/api/v1/accounts", strings.NewReader(`{"uid":"1504687050"}`))
	reqUntrusted.Header.Set("Content-Type", "application/json")
	reqUntrusted.Header.Set("Origin", "https://malicious-site.example.com")
	reqUntrusted.AddCookie(session)
	recUntrusted := httptest.NewRecorder()
	f.router.ServeHTTP(recUntrusted, reqUntrusted)
	if recUntrusted.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for untrusted origin, got %d", recUntrusted.Code)
	}

	// 3. Trusted Origin header allowed
	reqTrusted, _ := http.NewRequest(http.MethodPost, "/api/v1/accounts", strings.NewReader(`{"uid":"1504687050"}`))
	reqTrusted.Header.Set("Content-Type", "application/json")
	reqTrusted.Header.Set("Origin", "http://localhost:5173")
	reqTrusted.AddCookie(session)
	recTrusted := httptest.NewRecorder()
	f.router.ServeHTTP(recTrusted, reqTrusted)
	if recTrusted.Code != http.StatusCreated {
		t.Errorf("expected 201 Created for trusted origin, got %d", recTrusted.Code)
	}
	f.do(t, http.MethodDelete, "/api/v1/accounts/"+decodeBody(t, recTrusted)["id"].(string), nil, session)

	// 4. Missing Origin and Referer rejected
	reqMissing, _ := http.NewRequest(http.MethodPost, "/api/v1/accounts", strings.NewReader(`{"uid":"1504687051"}`))
	reqMissing.Header.Set("Content-Type", "application/json")
	reqMissing.AddCookie(session)
	recMissing := httptest.NewRecorder()
	f.router.ServeHTTP(recMissing, reqMissing)
	if recMissing.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for missing origin, got %d", recMissing.Code)
	}
	if body := decodeBody(t, recMissing); body["error"] != "missing origin header" {
		t.Errorf("expected 'missing origin header' error, got %v", body["error"])
	}

	// 5. Trusted Referer allowed when Origin is missing
	reqReferer, _ := http.NewRequest(http.MethodPost, "/api/v1/accounts", strings.NewReader(`{"uid":"1504687052"}`))
	reqReferer.Header.Set("Content-Type", "application/json")
	reqReferer.Header.Set("Referer", "http://localhost:5173/dashboard")
	reqReferer.AddCookie(session)
	recReferer := httptest.NewRecorder()
	f.router.ServeHTTP(recReferer, reqReferer)
	if recReferer.Code != http.StatusCreated {
		t.Errorf("expected 201 Created for trusted referer, got %d", recReferer.Code)
	}
	f.do(t, http.MethodDelete, "/api/v1/accounts/"+decodeBody(t, recReferer)["id"].(string), nil, session)

	// 6. Custom header X-Requested-With allowed when Origin/Referer is missing
	reqReqWith, _ := http.NewRequest(http.MethodPost, "/api/v1/accounts", strings.NewReader(`{"uid":"1504687053"}`))
	reqReqWith.Header.Set("Content-Type", "application/json")
	reqReqWith.Header.Set("X-Requested-With", "XMLHttpRequest")
	reqReqWith.AddCookie(session)
	recReqWith := httptest.NewRecorder()
	f.router.ServeHTTP(recReqWith, reqReqWith)
	if recReqWith.Code != http.StatusCreated {
		t.Errorf("expected 201 Created for request with X-Requested-With, got %d", recReqWith.Code)
	}
	f.do(t, http.MethodDelete, "/api/v1/accounts/"+decodeBody(t, recReqWith)["id"].(string), nil, session)

	// 7. Custom header X-CSRF-Token allowed when Origin/Referer is missing
	reqCSRFToken, _ := http.NewRequest(http.MethodPost, "/api/v1/accounts", strings.NewReader(`{"uid":"1504687054"}`))
	reqCSRFToken.Header.Set("Content-Type", "application/json")
	reqCSRFToken.Header.Set("X-CSRF-Token", "token-value")
	reqCSRFToken.AddCookie(session)
	recCSRFToken := httptest.NewRecorder()
	f.router.ServeHTTP(recCSRFToken, reqCSRFToken)
	if recCSRFToken.Code != http.StatusCreated {
		t.Errorf("expected 201 Created for request with X-CSRF-Token, got %d", recCSRFToken.Code)
	}
	f.do(t, http.MethodDelete, "/api/v1/accounts/"+decodeBody(t, recCSRFToken)["id"].(string), nil, session)

	// 8. Untrusted Origin rejected even if X-Requested-With is present
	reqUntrustedWithHeader, _ := http.NewRequest(http.MethodPost, "/api/v1/accounts", strings.NewReader(`{"uid":"1504687055"}`))
	reqUntrustedWithHeader.Header.Set("Content-Type", "application/json")
	reqUntrustedWithHeader.Header.Set("Origin", "https://malicious-site.example.com")
	reqUntrustedWithHeader.Header.Set("X-Requested-With", "XMLHttpRequest")
	reqUntrustedWithHeader.AddCookie(session)
	recUntrustedWithHeader := httptest.NewRecorder()
	f.router.ServeHTTP(recUntrustedWithHeader, reqUntrustedWithHeader)
	if recUntrustedWithHeader.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for untrusted origin with X-Requested-With, got %d", recUntrustedWithHeader.Code)
	}
}

func TestSecurityHeaders(t *testing.T) {
	t.Run("development without secure cookies", func(t *testing.T) {
		f := newFixture(t)

		req, _ := http.NewRequest(http.MethodGet, "/health", nil)
		rec := httptest.NewRecorder()
		f.router.ServeHTTP(rec, req)

		if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
			t.Errorf("expected X-Content-Type-Options: nosniff, got %q", got)
		}
		if got := rec.Header().Get("X-Frame-Options"); got != "DENY" {
			t.Errorf("expected X-Frame-Options: DENY, got %q", got)
		}
		if got := rec.Header().Get("Referrer-Policy"); got != "strict-origin-when-cross-origin" {
			t.Errorf("expected Referrer-Policy: strict-origin-when-cross-origin, got %q", got)
		}
		if got := rec.Header().Get("Strict-Transport-Security"); got != "" {
			t.Errorf("expected no Strict-Transport-Security in dev mode, got %q", got)
		}

		// Verify on SPA route as well
		reqSPA, _ := http.NewRequest(http.MethodGet, "/some/spa/route", nil)
		recSPA := httptest.NewRecorder()
		f.router.ServeHTTP(recSPA, reqSPA)

		if got := recSPA.Header().Get("X-Content-Type-Options"); got != "nosniff" {
			t.Errorf("expected X-Content-Type-Options: nosniff on SPA route, got %q", got)
		}
		if got := recSPA.Header().Get("X-Frame-Options"); got != "DENY" {
			t.Errorf("expected X-Frame-Options: DENY on SPA route, got %q", got)
		}
	})

	t.Run("production with secure cookies", func(t *testing.T) {
		f := newFixtureWithOpts(t, Options{
			FrontendURL:   "https://app.proxyloadouts.com",
			SecureCookies: true,
		})

		req, _ := http.NewRequest(http.MethodGet, "/health", nil)
		rec := httptest.NewRecorder()
		f.router.ServeHTTP(rec, req)

		if got := rec.Header().Get("X-Content-Type-Options"); got != "nosniff" {
			t.Errorf("expected X-Content-Type-Options: nosniff, got %q", got)
		}
		if got := rec.Header().Get("X-Frame-Options"); got != "DENY" {
			t.Errorf("expected X-Frame-Options: DENY, got %q", got)
		}
		if got := rec.Header().Get("Referrer-Policy"); got != "strict-origin-when-cross-origin" {
			t.Errorf("expected Referrer-Policy: strict-origin-when-cross-origin, got %q", got)
		}
		if got := rec.Header().Get("Strict-Transport-Security"); got != "max-age=31536000; includeSubDomains" {
			t.Errorf("expected Strict-Transport-Security: max-age=31536000; includeSubDomains, got %q", got)
		}
	})
}

func TestDeleteMe(t *testing.T) {
	f := newFixture(t)
	cookie := f.login(t)

	// Link an account
	createAcc := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1500000001"}, cookie)
	if createAcc.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for account, got %d: %s", createAcc.Code, createAcc.Body.String())
	}

	// Delete user account
	delRec := f.do(t, http.MethodDelete, "/api/v1/auth/me", nil, cookie)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("expected 204 No Content for DELETE /auth/me, got %d: %s", delRec.Code, delRec.Body.String())
	}

	// Accessing /auth/me with old cookie should now fail (user is deleted)
	meRec := f.do(t, http.MethodGet, "/api/v1/auth/me", nil, cookie)
	if meRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 Unauthorized after account deletion, got %d: %s", meRec.Code, meRec.Body.String())
	}

	// Check that game accounts were cascadingly deleted from DB
	var count int
	err := f.db.QueryRow("SELECT COUNT(*) FROM game_accounts WHERE uid = '1500000001'").Scan(&count)
	if err != nil {
		t.Fatalf("failed to query game_accounts: %v", err)
	}
	if count != 0 {
		t.Fatalf("expected 0 game_accounts after cascading user deletion, got %d", count)
	}
}

func TestRequestSizeLimit(t *testing.T) {
	f := newFixture(t)
	cookie := f.login(t)

	// Send a payload larger than 1 MiB limit
	hugeBody := `{"uid":"` + strings.Repeat("1", (1<<20)+16) + `"}`
	rec := f.doRaw(t, http.MethodPost, "/api/v1/accounts", hugeBody, cookie)

	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("expected 400 Bad Request or 413 Payload Too Large for oversized payload, got %d: %s", rec.Code, rec.Body.String())
	}
}

func TestAuthRateLimit(t *testing.T) {
	limiter := NewIPRateLimiter(rate.Limit(0.01), 2, time.Minute)
	t.Cleanup(limiter.Close)

	f := newFixtureWithOpts(t, Options{
		FrontendURL:     "http://localhost:5173",
		AuthRateLimiter: limiter,
	})

	for i := range 2 {
		rec := f.do(t, http.MethodGet, "/api/v1/auth/discord/login", nil)
		if rec.Code != http.StatusFound {
			t.Fatalf("attempt %d: expected 302 Found, got %d", i+1, rec.Code)
		}
	}

	blocked := f.do(t, http.MethodGet, "/api/v1/auth/discord/login", nil)
	if blocked.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 Too Many Requests on 3rd rapid login attempt, got %d", blocked.Code)
	}
}
