package adminhttp_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/time/rate"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/adminhttp"
	httpadapter "github.com/kirinyoku/proxyloadouts/backend/internal/adapter/http"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/inmemory"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestAdminServer_OverviewAndStats(t *testing.T) {
	db, err := sqlite.NewDB(":memory:")
	if err != nil {
		t.Fatalf("NewDB: %v", err)
	}
	defer db.Close()

	ctx := context.Background()
	if err := sqlite.Migrate(ctx, db); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	userRepo := sqlite.NewUserRepo(db)
	accRepo := sqlite.NewAccountRepo(db)
	buildRepo := sqlite.NewBuildRepo(db)
	teamRepo := sqlite.NewTeamRepo(db)
	adminRepo := sqlite.NewAdminRepo(db)

	now := time.Now().UTC()
	u := &domain.User{
		ID:        uuid.New(),
		DiscordID: "9001",
		Username:  "AdminTester",
		CreatedAt: now,
	}
	if err := userRepo.Create(ctx, u); err != nil {
		t.Fatalf("Create user: %v", err)
	}
	acc := &domain.GameAccount{
		ID:        uuid.New(),
		UserID:    u.ID,
		UID:       "1500000001",
		Region:    "Europe",
		CreatedAt: now,
	}
	if err := accRepo.Create(ctx, acc); err != nil {
		t.Fatalf("Create account: %v", err)
	}
	b := &domain.AgentBuild{
		ID:            uuid.New(),
		UserID:        u.ID,
		GameAccountID: acc.ID,
		AgentID:       1011,
		AgentName:     "Anby",
		Name:          "Anby Test",
		RawData:       json.RawMessage(`{"id":1011}`),
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := buildRepo.Create(ctx, b); err != nil {
		t.Fatalf("Create build: %v", err)
	}

	profileCache := inmemory.NewProfileCache[string](100, 0)
	defer profileCache.Close()
	negCache := inmemory.NewNegativeCache(200, 0)
	defer negCache.Close()
	negCache.Set("showcase:uid:1500000001", time.Minute)

	showcaseLim := httpadapter.NewIPRateLimiter(rate.Limit(1), 5, time.Minute)
	defer showcaseLim.Close()

	router := adminhttp.NewRouter(adminhttp.Deps{
		AdminRepo:       adminRepo,
		Users:           userRepo,
		Accounts:        accRepo,
		Builds:          buildRepo,
		Teams:           teamRepo,
		ProfileCache:    profileCache,
		NegativeCache:   negCache,
		ShowcaseLimiter: showcaseLim,
		Env:             "test",
		Release:         "abc1234",
		StartedAt:       now.Add(-120 * time.Second),
	})

	// 1. Test GET / (UI HTML)
	reqUI := httptest.NewRequest(http.MethodGet, "/", nil)
	recUI := httptest.NewRecorder()
	router.ServeHTTP(recUI, reqUI)
	if recUI.Code != http.StatusOK {
		t.Fatalf("GET / status = %d, want 200", recUI.Code)
	}
	if !strings.Contains(recUI.Header().Get("Content-Type"), "text/html") {
		t.Errorf("GET / Content-Type = %q, want text/html", recUI.Header().Get("Content-Type"))
	}
	if !strings.Contains(recUI.Body.String(), "ProxyLoadouts") {
		t.Errorf("GET / body missing ProxyLoadouts title")
	}

	// 2. Test GET /api/admin/health
	reqHealth := httptest.NewRequest(http.MethodGet, "/api/admin/health", nil)
	recHealth := httptest.NewRecorder()
	router.ServeHTTP(recHealth, reqHealth)
	if recHealth.Code != http.StatusOK {
		t.Fatalf("GET /api/admin/health status = %d, want 200", recHealth.Code)
	}
	var healthResp map[string]any
	if err := json.Unmarshal(recHealth.Body.Bytes(), &healthResp); err != nil {
		t.Fatalf("Unmarshal health: %v", err)
	}
	if healthResp["status"] != "ok" || healthResp["env"] != "test" || healthResp["release"] != "abc1234" {
		t.Errorf("unexpected health response: %+v", healthResp)
	}

	// 3. Test GET /api/admin/stats?days=14
	reqStats := httptest.NewRequest(http.MethodGet, "/api/admin/stats?days=14", nil)
	recStats := httptest.NewRecorder()
	router.ServeHTTP(recStats, reqStats)
	if recStats.Code != http.StatusOK {
		t.Fatalf("GET /api/admin/stats status = %d, want 200", recStats.Code)
	}
	var stats sqlite.AdminStats
	if err := json.Unmarshal(recStats.Body.Bytes(), &stats); err != nil {
		t.Fatalf("Unmarshal stats: %v", err)
	}
	if stats.Counts.Users.Total != 1 {
		t.Errorf("Counts.Users.Total = %d, want 1", stats.Counts.Users.Total)
	}
	if stats.Counts.Accounts.Total != 1 {
		t.Errorf("Counts.Accounts.Total = %d, want 1", stats.Counts.Accounts.Total)
	}
	if stats.Counts.Builds.Total != 1 {
		t.Errorf("Counts.Builds.Total = %d, want 1", stats.Counts.Builds.Total)
	}
	if len(stats.DailyActivity) != 14 {
		t.Errorf("len(DailyActivity) = %d, want 14", len(stats.DailyActivity))
	}

	// 4. Test Stage 2: GET /api/admin/users?q=1500000001
	reqUsers := httptest.NewRequest(http.MethodGet, "/api/admin/users?q=1500000001", nil)
	recUsers := httptest.NewRecorder()
	router.ServeHTTP(recUsers, reqUsers)
	if recUsers.Code != http.StatusOK {
		t.Fatalf("GET /api/admin/users status = %d, want 200", recUsers.Code)
	}
	var userList sqlite.AdminUserListResult
	if err := json.Unmarshal(recUsers.Body.Bytes(), &userList); err != nil {
		t.Fatalf("Unmarshal userList: %v", err)
	}
	if userList.Total != 1 || len(userList.Items) != 1 || userList.Items[0].ID != u.ID.String() {
		t.Fatalf("unexpected userList: %+v", userList)
	}

	// 5. Test PATCH /api/admin/users/{userID}/limits
	reqLimits := httptest.NewRequest(
		http.MethodPatch,
		"/api/admin/users/"+u.ID.String()+"/limits",
		strings.NewReader(`{"custom_max_builds_per_agent":25,"custom_max_teams":100,"custom_max_accounts":5}`),
	)
	recLimits := httptest.NewRecorder()
	router.ServeHTTP(recLimits, reqLimits)
	if recLimits.Code != http.StatusOK {
		t.Fatalf("PATCH /limits status = %d, body = %s", recLimits.Code, recLimits.Body.String())
	}
	var detail sqlite.AdminUserDetail
	if err := json.Unmarshal(recLimits.Body.Bytes(), &detail); err != nil {
		t.Fatalf("Unmarshal detail: %v", err)
	}
	if detail.User.EffectiveMaxBuildsPerAgent != 25 || detail.User.EffectiveMaxTeams != 100 || detail.User.EffectiveMaxAccounts != 5 {
		t.Errorf("unexpected updated limits: %+v", detail.User)
	}

	// 6. Test POST /api/admin/users/{userID}/revoke-sessions
	reqRevoke := httptest.NewRequest(http.MethodPost, "/api/admin/users/"+u.ID.String()+"/revoke-sessions", nil)
	recRevoke := httptest.NewRecorder()
	router.ServeHTTP(recRevoke, reqRevoke)
	if recRevoke.Code != http.StatusOK {
		t.Fatalf("POST /revoke-sessions status = %d", recRevoke.Code)
	}
	if err := json.Unmarshal(recRevoke.Body.Bytes(), &detail); err != nil {
		t.Fatalf("Unmarshal detail after revoke: %v", err)
	}
	if detail.User.TokenVersion != 2 {
		t.Errorf("TokenVersion = %d, want 2", detail.User.TokenVersion)
	}

	// 7. Test POST /api/admin/users/{userID}/ban
	reqBan := httptest.NewRequest(
		http.MethodPost,
		"/api/admin/users/"+u.ID.String()+"/ban",
		strings.NewReader(`{"banned":true,"reason":"abuse"}`),
	)
	recBan := httptest.NewRecorder()
	router.ServeHTTP(recBan, reqBan)
	if recBan.Code != http.StatusOK {
		t.Fatalf("POST /ban status = %d, body = %s", recBan.Code, recBan.Body.String())
	}
	if err := json.Unmarshal(recBan.Body.Bytes(), &detail); err != nil {
		t.Fatalf("Unmarshal detail after ban: %v", err)
	}
	if detail.User.BannedAt == nil || detail.User.BanReason == nil || *detail.User.BanReason != "abuse" {
		t.Errorf("expected banned user with reason 'abuse', got %+v", detail.User)
	}
	if detail.User.TokenVersion != 3 {
		t.Errorf("TokenVersion after ban = %d, want 3", detail.User.TokenVersion)
	}

	// 7.1 Test Stage 3: Content Inspector (Builds & Teams)
	team := &domain.Team{
		ID:            uuid.New(),
		UserID:        u.ID,
		GameAccountID: acc.ID,
		Name:          "Cunning Hares",
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := teamRepo.Create(ctx, team, []domain.TeamMember{
		{ID: uuid.New(), TeamID: team.ID, SlotNumber: 1, BuildID: b.ID},
	}); err != nil {
		t.Fatalf("Create team: %v", err)
	}

	reqBuilds := httptest.NewRequest(http.MethodGet, "/api/admin/builds?q=Anby", nil)
	recBuilds := httptest.NewRecorder()
	router.ServeHTTP(recBuilds, reqBuilds)
	if recBuilds.Code != http.StatusOK {
		t.Fatalf("GET /api/admin/builds status = %d", recBuilds.Code)
	}
	var buildList sqlite.AdminBuildListResult
	if err := json.Unmarshal(recBuilds.Body.Bytes(), &buildList); err != nil {
		t.Fatalf("Unmarshal buildList: %v", err)
	}
	if buildList.Total != 1 || buildList.Items[0].TeamsUsedCount != 1 {
		t.Errorf("unexpected buildList: %+v", buildList)
	}

	reqBuildDetail := httptest.NewRequest(http.MethodGet, "/api/admin/builds/"+b.ID.String(), nil)
	recBuildDetail := httptest.NewRecorder()
	router.ServeHTTP(recBuildDetail, reqBuildDetail)
	if recBuildDetail.Code != http.StatusOK {
		t.Fatalf("GET /api/admin/builds/{id} status = %d", recBuildDetail.Code)
	}
	var buildDetail sqlite.AdminBuildDetail
	if err := json.Unmarshal(recBuildDetail.Body.Bytes(), &buildDetail); err != nil {
		t.Fatalf("Unmarshal buildDetail: %v", err)
	}
	if len(buildDetail.Teams) != 1 || buildDetail.Teams[0].TeamID != team.ID.String() {
		t.Errorf("unexpected buildDetail.Teams: %+v", buildDetail.Teams)
	}

	reqTeams := httptest.NewRequest(http.MethodGet, "/api/admin/teams?q=Cunning", nil)
	recTeams := httptest.NewRecorder()
	router.ServeHTTP(recTeams, reqTeams)
	if recTeams.Code != http.StatusOK {
		t.Fatalf("GET /api/admin/teams status = %d", recTeams.Code)
	}
	var teamList sqlite.AdminTeamListResult
	if err := json.Unmarshal(recTeams.Body.Bytes(), &teamList); err != nil {
		t.Fatalf("Unmarshal teamList: %v", err)
	}
	if teamList.Total != 1 || len(teamList.Items[0].Members) != 1 {
		t.Errorf("unexpected teamList: %+v", teamList)
	}

	// Non-forced delete of build used in team should fail with 409 Conflict
	reqDelBuildNoForce := httptest.NewRequest(http.MethodDelete, "/api/admin/builds/"+b.ID.String(), nil)
	recDelBuildNoForce := httptest.NewRecorder()
	router.ServeHTTP(recDelBuildNoForce, reqDelBuildNoForce)
	if recDelBuildNoForce.Code != http.StatusConflict {
		t.Errorf("DELETE /builds without force status = %d, want 409", recDelBuildNoForce.Code)
	}

	// Forced delete of build detaches from team and removes empty team
	reqDelBuildForce := httptest.NewRequest(http.MethodDelete, "/api/admin/builds/"+b.ID.String()+"?force=true", nil)
	recDelBuildForce := httptest.NewRecorder()
	router.ServeHTTP(recDelBuildForce, reqDelBuildForce)
	if recDelBuildForce.Code != http.StatusNoContent {
		t.Fatalf("DELETE /builds?force=true status = %d, body = %s", recDelBuildForce.Code, recDelBuildForce.Body.String())
	}

	// 8. Test DELETE /api/admin/accounts/{accountID}
	reqDelAcc := httptest.NewRequest(http.MethodDelete, "/api/admin/accounts/"+acc.ID.String(), nil)
	recDelAcc := httptest.NewRecorder()
	router.ServeHTTP(recDelAcc, reqDelAcc)
	if recDelAcc.Code != http.StatusNoContent {
		t.Fatalf("DELETE /accounts status = %d, want 204", recDelAcc.Code)
	}

	// 9. Test DELETE /api/admin/users/{userID}
	reqDelUser := httptest.NewRequest(http.MethodDelete, "/api/admin/users/"+u.ID.String(), nil)
	recDelUser := httptest.NewRecorder()
	router.ServeHTTP(recDelUser, reqDelUser)
	if recDelUser.Code != http.StatusNoContent {
		t.Fatalf("DELETE /users status = %d, want 204", recDelUser.Code)
	}

	// 10. Test Stage 4: Caches & Rate Limiters
	if !negCache.Has("showcase:uid:1500000001") {
		t.Fatalf("expected negCache to contain showcase:uid:1500000001 before purge")
	}
	reqPurge := httptest.NewRequest(http.MethodPost, "/api/admin/caches/purge-uid", strings.NewReader(`{"uid":"1500000001"}`))
	recPurge := httptest.NewRecorder()
	router.ServeHTTP(recPurge, reqPurge)
	if recPurge.Code != http.StatusOK {
		t.Fatalf("POST /caches/purge-uid status = %d, body = %s", recPurge.Code, recPurge.Body.String())
	}
	if negCache.Has("showcase:uid:1500000001") {
		t.Errorf("expected negCache entry to be purged")
	}

	negCache.Set("showcase:uid:1500000002", time.Minute)
	reqFlushCache := httptest.NewRequest(http.MethodPost, "/api/admin/caches/flush", strings.NewReader(`{"target":"all"}`))
	recFlushCache := httptest.NewRecorder()
	router.ServeHTTP(recFlushCache, reqFlushCache)
	if recFlushCache.Code != http.StatusOK {
		t.Fatalf("POST /caches/flush status = %d", recFlushCache.Code)
	}
	if negCache.Len() != 0 {
		t.Errorf("expected negCache.Len() == 0 after flush all, got %d", negCache.Len())
	}

	reqFlushLim := httptest.NewRequest(http.MethodPost, "/api/admin/ratelimiters/flush", strings.NewReader(`{"target":"showcase"}`))
	recFlushLim := httptest.NewRecorder()
	router.ServeHTTP(recFlushLim, reqFlushLim)
	if recFlushLim.Code != http.StatusOK {
		t.Fatalf("POST /ratelimiters/flush status = %d", recFlushLim.Code)
	}

	// 11. Test Stage 5: System Diagnostics, SQLite Maintenance & Hot Backup
	reqSys := httptest.NewRequest(http.MethodGet, "/api/admin/system", nil)
	recSys := httptest.NewRecorder()
	router.ServeHTTP(recSys, reqSys)
	if recSys.Code != http.StatusOK {
		t.Fatalf("GET /api/admin/system status = %d", recSys.Code)
	}

	reqMaint := httptest.NewRequest(http.MethodPost, "/api/admin/sqlite/maintenance", nil)
	recMaint := httptest.NewRecorder()
	router.ServeHTTP(recMaint, reqMaint)
	if recMaint.Code != http.StatusOK {
		t.Fatalf("POST /api/admin/sqlite/maintenance status = %d, body = %s", recMaint.Code, recMaint.Body.String())
	}

	reqBackup := httptest.NewRequest(http.MethodGet, "/api/admin/sqlite/backup", nil)
	recBackup := httptest.NewRecorder()
	router.ServeHTTP(recBackup, reqBackup)
	if recBackup.Code != http.StatusOK {
		t.Fatalf("GET /api/admin/sqlite/backup status = %d, body = %s", recBackup.Code, recBackup.Body.String())
	}
	if !strings.HasPrefix(recBackup.Body.String(), "SQLite format 3") {
		t.Errorf("expected valid SQLite header in backup response, got %d bytes", recBackup.Body.Len())
	}
}
