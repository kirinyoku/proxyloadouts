package http

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

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	"github.com/kirinyoku/fairy"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
)

func TestPublic_BuildEndpoint(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)
	ctx := context.Background()

	// Link account
	accountRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, session)
	accountIDStr, _ := decodeBody(t, accountRec)["id"].(string)
	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		t.Fatalf("invalid account id: %v", err)
	}

	// Update metadata on account
	nick := "ProxyKirin"
	avatar := "https://cdn.example.com/avatar.png"
	accountRepo := sqlite.NewAccountRepo(f.db)
	if err := accountRepo.UpdateProfileMetadata(ctx, accountID, &nick, &avatar); err != nil {
		t.Fatalf("UpdateProfileMetadata failed: %v", err)
	}

	payload := map[string]any{
		"id": 1511, "name": "Miyabi", "level": 60,
		"w_engine":    map[string]any{"id": 15110, "uid": "1511_engine", "name": "Asasumaru"},
		"drive_discs": map[string]any{"slots": []any{map[string]any{"uid": "32700_disc_1", "slot": 1}}},
	}
	buildID := saveBuildViaAPI(t, f, session, accountIDStr, payload)
	f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID, map[string]any{"is_public": false}, session)

	// 1. Private build returns 404 on public endpoint
	recPriv := f.do(t, http.MethodGet, "/api/v1/public/builds/"+buildID, nil)
	if recPriv.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for private build, got %d (%s)", recPriv.Code, recPriv.Body.String())
	}

	// 2. Publish build via PATCH
	patchRec := f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID, map[string]any{
		"is_public": true,
	}, session)
	if patchRec.Code != http.StatusNoContent {
		t.Fatalf("patch is_public failed: %d (%s)", patchRec.Code, patchRec.Body.String())
	}

	// 3. Public GET without auth succeeds
	recPub := f.do(t, http.MethodGet, "/api/v1/public/builds/"+buildID, nil)
	if recPub.Code != http.StatusOK {
		t.Fatalf("expected 200 for public build, got %d (%s)", recPub.Code, recPub.Body.String())
	}

	body := decodeBody(t, recPub)
	buildMap, ok := body["build"].(map[string]any)
	if !ok {
		t.Fatalf("expected 'build' object in response, got %v", body)
	}
	if buildMap["is_public"] != true {
		t.Errorf("expected build.is_public = true, got %v", buildMap["is_public"])
	}

	ownerMap, ok := body["owner"].(map[string]any)
	if !ok {
		t.Fatalf("expected 'owner' object in response, got %v", body)
	}
	if ownerMap["uid"] != "1504687050" {
		t.Errorf("expected owner.uid 1504687050, got %v", ownerMap["uid"])
	}
	if ownerMap["nickname"] != nick {
		t.Errorf("expected owner.nickname %q, got %v", nick, ownerMap["nickname"])
	}
	if ownerMap["avatar_url"] != avatar {
		t.Errorf("expected owner.avatar_url %q, got %v", avatar, ownerMap["avatar_url"])
	}

	// 4. Dynamic localization via ?lang=en
	recEN := f.do(t, http.MethodGet, "/api/v1/public/builds/"+buildID+"?lang=en", nil)
	if recEN.Code != http.StatusOK {
		t.Fatalf("expected 200 for public build with lang=en, got %d", recEN.Code)
	}
	bodyEN := decodeBody(t, recEN)
	buildEN := bodyEN["build"].(map[string]any)
	if buildEN["agent_name"] != "Agent EN" {
		t.Errorf("expected agent_name 'Agent EN', got %v", buildEN["agent_name"])
	}

	// 5. Hide build again via PATCH
	hideRec := f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID, map[string]any{
		"is_public": false,
	}, session)
	if hideRec.Code != http.StatusNoContent {
		t.Fatalf("hide build failed: %d", hideRec.Code)
	}
	recHidden := f.do(t, http.MethodGet, "/api/v1/public/builds/"+buildID, nil)
	if recHidden.Code != http.StatusNotFound {
		t.Errorf("expected 404 for newly private build, got %d", recHidden.Code)
	}

	// 6. Invalid UUID returns 400 Bad Request
	recBadUUID := f.do(t, http.MethodGet, "/api/v1/public/builds/not-a-uuid", nil)
	if recBadUUID.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for bad UUID, got %d", recBadUUID.Code)
	}
}

func TestPublic_TeamEndpoint_ImplicitMemberRead(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)
	ctx := context.Background()

	// Link account
	accountRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, session)
	accountIDStr, _ := decodeBody(t, accountRec)["id"].(string)
	accountID, err := uuid.Parse(accountIDStr)
	if err != nil {
		t.Fatalf("invalid account id: %v", err)
	}

	nick := "SquadLeader"
	accountRepo := sqlite.NewAccountRepo(f.db)
	if err := accountRepo.UpdateProfileMetadata(ctx, accountID, &nick, nil); err != nil {
		t.Fatalf("UpdateProfileMetadata failed: %v", err)
	}

	// Create 3 private builds (is_public = false)
	b1 := saveBuildViaAPI(t, f, session, accountIDStr, map[string]any{
		"id": 1511, "name": "Miyabi", "level": 60,
		"w_engine": map[string]any{"id": 15110, "uid": "1511_eng", "name": "Asasumaru"},
	})
	b2 := saveBuildViaAPI(t, f, session, accountIDStr, map[string]any{
		"id": 1512, "name": "Soukaku", "level": 60,
		"w_engine": map[string]any{"id": 15120, "uid": "1512_eng", "name": "Bashful Demon"},
	})
	b3 := saveBuildViaAPI(t, f, session, accountIDStr, map[string]any{
		"id": 1513, "name": "Lycaon", "level": 60,
		"w_engine": map[string]any{"id": 15130, "uid": "1513_eng", "name": "Restrained"},
	})

	for _, b := range []string{b1, b2, b3} {
		f.do(t, http.MethodPatch, "/api/v1/builds/"+b, map[string]any{"is_public": false}, session)
	}

	// Create public team referencing private builds
	isPublic := true
	teamRec := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accountIDStr,
		"name":            "Ice Squad Public",
		"description":     "Shiyu 17 team",
		"is_public":       isPublic,
		"build_ids":       []string{b1, b2, b3},
	}, session)
	if teamRec.Code != http.StatusCreated {
		t.Fatalf("create team failed: %d (%s)", teamRec.Code, teamRec.Body.String())
	}
	teamID, _ := decodeBody(t, teamRec)["id"].(string)

	// Public GET /api/v1/public/teams/{teamID} without auth
	recPub := f.do(t, http.MethodGet, "/api/v1/public/teams/"+teamID, nil)
	if recPub.Code != http.StatusOK {
		t.Fatalf("expected 200 for public team, got %d (%s)", recPub.Code, recPub.Body.String())
	}

	body := decodeBody(t, recPub)
	teamMap := body["team"].(map[string]any)
	if teamMap["is_public"] != true {
		t.Errorf("expected team.is_public = true, got %v", teamMap["is_public"])
	}

	members, ok := body["members"].([]any)
	if !ok || len(members) != 3 {
		t.Fatalf("expected 3 members via Implicit Member Read, got %v", body["members"])
	}

	// Verify each member build was loaded despite being private
	for i, m := range members {
		mMap := m.(map[string]any)
		slot := int(mMap["slot_number"].(float64))
		if slot != i+1 {
			t.Errorf("expected slot %d, got %d", i+1, slot)
		}
		buildObj := mMap["build"].(map[string]any)
		if buildObj["is_public"] != false {
			t.Errorf("slot %d: expected member build to remain is_public=false", slot)
		}
		if buildObj["agent_name"] == "" {
			t.Errorf("slot %d: expected non-empty agent_name", slot)
		}
	}

	report := body["report"].(map[string]any)
	if report["is_valid"] != true {
		t.Errorf("expected conflict report is_valid = true, got %v", report)
	}

	// Update team to private
	isPriv := false
	putRec := f.do(t, http.MethodPut, "/api/v1/teams/"+teamID, map[string]any{
		"game_account_id": accountIDStr,
		"name":            "Ice Squad Now Private",
		"is_public":       isPriv,
		"build_ids":       []string{b1, b2, b3},
	}, session)
	if putRec.Code != http.StatusOK {
		t.Fatalf("update team failed: %d", putRec.Code)
	}

	// Should now be 404
	recPriv := f.do(t, http.MethodGet, "/api/v1/public/teams/"+teamID, nil)
	if recPriv.Code != http.StatusNotFound {
		t.Errorf("expected 404 for private team, got %d", recPriv.Code)
	}
}

func TestPublic_RateLimiter(t *testing.T) {
	// Set burst 2, rate 0.01 req/s
	limiter := NewIPRateLimiter(rate.Limit(0.01), 2, time.Minute)
	f := newFixtureWithOpts(t, Options{
		FrontendURL:           "http://localhost:5173",
		PublicReadRateLimiter: limiter,
	})

	randomUUID := uuid.New().String()

	rec1 := f.do(t, http.MethodGet, "/api/v1/public/builds/"+randomUUID, nil)
	if rec1.Code != http.StatusNotFound {
		t.Fatalf("req 1: expected 404, got %d", rec1.Code)
	}

	rec2 := f.do(t, http.MethodGet, "/api/v1/public/builds/"+randomUUID, nil)
	if rec2.Code != http.StatusNotFound {
		t.Fatalf("req 2: expected 404, got %d", rec2.Code)
	}

	// 3rd request should be throttled
	rec3 := f.do(t, http.MethodGet, "/api/v1/public/builds/"+randomUUID, nil)
	if rec3.Code != http.StatusTooManyRequests {
		t.Fatalf("req 3: expected 429 Too Many Requests, got %d", rec3.Code)
	}
}

func TestOpenGraph_DynamicInjection(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)
	ctx := context.Background()

	f.fetcher.agent = &fairy.Agent{
		Name: "Miyabi",
		WEngine: &fairy.WEngine{
			Name: "Hoshushu Asasumaru",
		},
		DriveDiscs: fairy.DriveDiscs{
			SetBonuses: []fairy.DriveDiscSetBonus{
				{
					Count: 4,
					Set:   fairy.Set{Name: "Woodpecker Electro"},
				},
				{
					Count: 2,
					Set:   fairy.Set{Name: "Polar Metal"},
				},
			},
		},
		UIStats: fairy.UIStats{
			ATK:      fairy.FormattedStatBreakdown{Total: "2840"},
			CritRate: fairy.FormattedStatBreakdown{Total: "68.4%"},
			CritDMG:  fairy.FormattedStatBreakdown{Total: "142.0%"},
		},
	}

	// Link account
	accountRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, session)
	accountIDStr, _ := decodeBody(t, accountRec)["id"].(string)
	accountID, _ := uuid.Parse(accountIDStr)

	nick := "ProxyLeader <Admin>"
	accountRepo := sqlite.NewAccountRepo(f.db)
	_ = accountRepo.UpdateProfileMetadata(ctx, accountID, &nick, nil)

	// Create public build
	buildPayload := map[string]any{
		"id": 1511, "name": "Miyabi", "level": 60,
		"w_engine": map[string]any{"id": 15110, "uid": "1511_eng", "name": "Hoshushu Asasumaru"},
		"drive_discs": map[string]any{
			"set_bonuses": []any{
				map[string]any{
					"count": 4,
					"set":   map[string]any{"name": "Woodpecker Electro"},
				},
				map[string]any{
					"count": 2,
					"set":   map[string]any{"name": "Polar Metal"},
				},
			},
		},
		"ui_stats": map[string]any{
			"atk":       map[string]any{"total": "2840"},
			"crit_rate": map[string]any{"total": "68.4%"},
			"crit_dmg":  map[string]any{"total": "142.0%"},
		},
	}
	rawAvatar, _ := json.Marshal(zzz.AvatarData{ID: 1511, Level: 60})
	createRec := f.do(t, http.MethodPost, "/api/v1/builds", map[string]any{
		"game_account_id":   accountIDStr,
		"name":              "Anomaly <DPS> & 'Ice'",
		"description":       "Top tier ice rotation",
		"is_public":         true,
		"raw_agent_payload": buildPayload,
		"raw_data":          json.RawMessage(rawAvatar),
	}, session)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("create build failed: %d", createRec.Code)
	}
	buildID, _ := decodeBody(t, createRec)["id"].(string)

	// 1. GET /b/{buildID} returns injected HTML
	req := httptest.NewRequest(http.MethodGet, "/b/"+buildID, nil)
	rec := httptest.NewRecorder()
	f.router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	html := rec.Body.String()

	// Verify escaping of special characters in title
	expectedTitleSubstr := "Anomaly &lt;DPS&gt; &amp; &#39;Ice&#39;"
	if !strings.Contains(html, expectedTitleSubstr) {
		t.Errorf("expected HTML to contain escaped build name %q, got body:\n%s", expectedTitleSubstr, html[:500])
	}
	expectedNickSubstr := "ProxyLeader &lt;Admin&gt;"
	if !strings.Contains(html, expectedNickSubstr) {
		t.Errorf("expected HTML to contain escaped nickname %q", expectedNickSubstr)
	}

	// Verify og:title and twitter:title
	if !strings.Contains(html, `<meta property="og:title" content="`) {
		t.Errorf("expected og:title meta tag")
	}
	if !strings.Contains(html, `<meta name="twitter:title" content="`) {
		t.Errorf("expected twitter:title meta tag")
	}

	// Verify og:description has stats, weapon, and sets
	if !strings.Contains(html, "Hoshushu Asasumaru") {
		t.Errorf("expected og:description to mention weapon 'Hoshushu Asasumaru'")
	}
	if !strings.Contains(html, "Woodpecker Electro") {
		t.Errorf("expected og:description to mention disc set 'Woodpecker Electro'")
	}
	if !strings.Contains(html, "Top tier ice rotation") {
		t.Errorf("expected og:description to mention note 'Top tier ice rotation'")
	}

	// 2. Private build GET /b/{privateID} returns default un-injected index.html
	_ = f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID, map[string]any{"is_public": false}, session)
	recPriv := httptest.NewRecorder()
	f.router.ServeHTTP(recPriv, req)
	if recPriv.Code != http.StatusOK {
		t.Fatalf("expected 200 SPA fallback, got %d", recPriv.Code)
	}
	privHTML := recPriv.Body.String()
	if strings.Contains(privHTML, "Anomaly &lt;DPS&gt;") {
		t.Errorf("private build should NOT leak build name into HTML")
	}
	if !strings.Contains(privHTML, "Agent Build Manager for Zenless Zone Zero") {
		t.Errorf("expected default index.html title for private build")
	}

	// 3. Team OpenGraph injection GET /t/{teamID}
	teamRec := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accountIDStr,
		"name":            "Team <Victory>",
		"description":     "Team note <safe>",
		"is_public":       true,
		"build_ids":       []string{buildID},
	}, session)
	teamID, _ := decodeBody(t, teamRec)["id"].(string)

	reqTeam := httptest.NewRequest(http.MethodGet, "/t/"+teamID, nil)
	recTeam := httptest.NewRecorder()
	f.router.ServeHTTP(recTeam, reqTeam)

	if recTeam.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", recTeam.Code)
	}
	teamHTML := recTeam.Body.String()
	if !strings.Contains(teamHTML, "Team &lt;Victory&gt;") {
		t.Errorf("expected team HTML to contain escaped team name")
	}
	if !strings.Contains(teamHTML, "Team note &lt;safe&gt;") {
		t.Errorf("expected team HTML to contain escaped team note")
	}
}
