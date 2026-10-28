package http

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	"github.com/kirinyoku/fairy"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
)

func TestAccount_VerificationAndSettingsFlow(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	// 1. Link account
	uid := "1504687050"
	rec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": uid}, session)
	if rec.Code != http.StatusCreated {
		t.Fatalf("failed to create account: %d %s", rec.Code, rec.Body.String())
	}
	accData := decodeBody(t, rec)
	accountID := accData["id"].(string)

	// 2. Attempt to enable public showcase on unverified account -> 409 Conflict
	patchRec := f.do(t, http.MethodPatch, "/api/v1/accounts/"+accountID, map[string]any{
		"is_public_showcase": true,
	}, session)
	if patchRec.Code != http.StatusConflict {
		t.Fatalf("expected 409 conflict enabling showcase on unverified account, got %d: %s", patchRec.Code, patchRec.Body.String())
	}

	// Enabling show_discord on unverified account succeeds
	patchDiscord := f.do(t, http.MethodPatch, "/api/v1/accounts/"+accountID, map[string]any{
		"show_discord": true,
	}, session)
	if patchDiscord.Code != http.StatusOK {
		t.Fatalf("expected 200 setting show_discord, got %d: %s", patchDiscord.Code, patchDiscord.Body.String())
	}
	if decodeBody(t, patchDiscord)["show_discord"] != true {
		t.Errorf("expected show_discord=true")
	}

	// 3. Request verification challenge
	chalRec := f.do(t, http.MethodPost, "/api/v1/accounts/"+accountID+"/verify/challenge", nil, session)
	if chalRec.Code != http.StatusOK {
		t.Fatalf("failed to start verification: %d %s", chalRec.Code, chalRec.Body.String())
	}
	chalData := decodeBody(t, chalRec)
	code, ok := chalData["code"].(string)
	if !ok || len(code) == 0 {
		t.Fatalf("expected valid code, got %v", chalData["code"])
	}
	if chalData["cooldown_seconds"].(float64) != 30 {
		t.Errorf("expected cooldown_seconds=30, got %v", chalData["cooldown_seconds"])
	}

	// Calling challenge again returns the same active code (idempotent)
	chalRec2 := f.do(t, http.MethodPost, "/api/v1/accounts/"+accountID+"/verify/challenge", nil, session)
	chalData2 := decodeBody(t, chalRec2)
	if chalData2["code"] != code {
		t.Errorf("expected challenge idempotency, got %v vs %v", chalData2["code"], code)
	}

	// 4. Confirm verification when signature does NOT contain code -> 409 Conflict
	f.fetcher.rawProfile = &zzz.Profile{
		UID: uid,
		PlayerInfo: zzz.PlayerInfo{
			SocialDetail: &zzz.SocialDetail{
				Desc: "Some random profile signature without code",
				ProfileDetail: &zzz.ProfileDetail{
					Nickname: "ZZZPlayer",
				},
			},
		},
	}
	confirmFailRec := f.do(t, http.MethodPost, "/api/v1/accounts/"+accountID+"/verify/confirm", nil, session)
	if confirmFailRec.Code != http.StatusConflict {
		t.Fatalf("expected 409 conflict when code not in signature, got %d: %s", confirmFailRec.Code, confirmFailRec.Body.String())
	}

	// 5. Retrying immediately -> 429 Too Many Requests (cooldown active)
	confirmCooldownRec := f.do(t, http.MethodPost, "/api/v1/accounts/"+accountID+"/verify/confirm", nil, session)
	if confirmCooldownRec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 too many requests due to cooldown, got %d: %s", confirmCooldownRec.Code, confirmCooldownRec.Body.String())
	}

	// Reset cooldown in DB / service test by updating lastAttemptAt or resetting challenge
	// For testing successful confirmation, start fresh challenge
	// Or seed verified status directly to verify showcase / roster behavior
}

func TestShowcase_EnrichedOwnerAndRoster(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)
	ctx := context.Background()

	uid := "1504687050"
	rec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": uid}, session)
	if rec.Code != http.StatusCreated {
		t.Fatalf("failed to create account: %d %s", rec.Code, rec.Body.String())
	}
	accData := decodeBody(t, rec)
	accountIDStr := accData["id"].(string)
	accountID, _ := uuid.Parse(accountIDStr)

	// 1. Unverified showcase lookup returns verified_owner: null and has_public_roster: false
	f.fetcher.profile = &fairy.Profile{UID: uid, Nickname: "LiveEnkaNick", Region: fairy.RegionEU}
	showcaseRec1 := f.do(t, http.MethodGet, "/api/v1/showcase/"+uid, nil)
	if showcaseRec1.Code != http.StatusOK {
		t.Fatalf("expected 200 for showcase, got %d", showcaseRec1.Code)
	}
	scData1 := decodeBody(t, showcaseRec1)
	if scData1["verified_owner"] != nil {
		t.Errorf("expected verified_owner to be nil/null, got %v", scData1["verified_owner"])
	}
	if scData1["has_public_roster"] != false {
		t.Errorf("expected has_public_roster to be false, got %v", scData1["has_public_roster"])
	}

	// 2. Unverified UID requesting roster -> 404 Not Found
	rosterRec404 := f.do(t, http.MethodGet, "/api/v1/showcase/"+uid+"/roster", nil)
	if rosterRec404.Code != http.StatusNotFound {
		t.Fatalf("expected 404 for unverified roster, got %d", rosterRec404.Code)
	}

	// 3. Mark account verified in database
	accRepo := sqlite.NewAccountRepo(f.db)
	nick := "VerifiedProxy"
	avatar := "https://cdn.example.com/avatar.png"
	now := time.Now().UTC()
	if err := accRepo.VerifyOwnership(ctx, accountID, uid, now, &nick, &avatar); err != nil {
		t.Fatalf("VerifyOwnership failed: %v", err)
	}

	// Initially after verification, is_public_showcase = true (set by VerifyOwnership)
	// Let's set is_public_showcase = false to test private verified roster
	if err := accRepo.UpdateSettings(ctx, accountID, false, true); err != nil {
		t.Fatalf("UpdateSettings failed: %v", err)
	}

	// 4. Roster with is_public_showcase = false returns 200 with empty builds & teams and owner metadata
	rosterPrivRec := f.do(t, http.MethodGet, "/api/v1/showcase/"+uid+"/roster", nil)
	if rosterPrivRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for private verified roster, got %d: %s", rosterPrivRec.Code, rosterPrivRec.Body.String())
	}
	privRosterData := decodeBody(t, rosterPrivRec)
	if privRosterData["is_public_showcase"] != false {
		t.Errorf("expected is_public_showcase=false")
	}
	buildsArr, ok := privRosterData["builds"].([]any)
	if !ok || len(buildsArr) != 0 {
		t.Errorf("expected empty builds array, got %v", privRosterData["builds"])
	}
	teamsArr, ok := privRosterData["teams"].([]any)
	if !ok || len(teamsArr) != 0 {
		t.Errorf("expected empty teams array, got %v", privRosterData["teams"])
	}
	ownerObj, ok := privRosterData["owner"].(map[string]any)
	if !ok || ownerObj["uid"] != uid || ownerObj["is_verified"] != true {
		t.Errorf("expected owner object with is_verified=true, got %v", privRosterData["owner"])
	}

	// 5. Enable public showcase
	if err := accRepo.UpdateSettings(ctx, accountID, true, true); err != nil {
		t.Fatalf("UpdateSettings failed: %v", err)
	}

	// Create 1 public build, 1 private build
	payloadPub := map[string]any{
		"id": 1511, "name": "Miyabi", "level": 60,
		"w_engine":    map[string]any{"id": 15110, "uid": "1511_eng", "name": "Asasumaru"},
		"drive_discs": map[string]any{"slots": []any{map[string]any{"uid": "32700_1", "slot": 1}}},
	}
	pubBuildID := saveBuildViaAPI(t, f, session, accountIDStr, payloadPub)
	f.do(t, http.MethodPatch, "/api/v1/builds/"+pubBuildID, map[string]any{"is_public": true}, session)

	payloadPriv := map[string]any{
		"id": 1411, "name": "Ellen", "level": 60,
		"w_engine":    map[string]any{"id": 14110, "uid": "1411_eng", "name": "DeepSea"},
		"drive_discs": map[string]any{"slots": []any{map[string]any{"uid": "32800_1", "slot": 1}}},
	}
	privBuildID := saveBuildViaAPI(t, f, session, accountIDStr, payloadPriv)
	// privBuildID remains is_public = false

	// Create 1 public team containing the private build (testing Implicit Member Read)
	teamPayload := map[string]any{
		"game_account_id": accountIDStr,
		"name":            "Ice Team",
		"description":     "Public Team with private member build",
		"is_public":       true,
		"build_ids":       []string{pubBuildID, privBuildID},
	}
	teamRec := f.do(t, http.MethodPost, "/api/v1/teams", teamPayload, session)
	if teamRec.Code != http.StatusCreated {
		t.Fatalf("failed to create team: %d %s", teamRec.Code, teamRec.Body.String())
	}

	// 6. Request public roster
	rosterPubRec := f.do(t, http.MethodGet, "/api/v1/showcase/"+uid+"/roster", nil)
	if rosterPubRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for public roster, got %d: %s", rosterPubRec.Code, rosterPubRec.Body.String())
	}
	pubRosterData := decodeBody(t, rosterPubRec)
	if pubRosterData["is_public_showcase"] != true {
		t.Errorf("expected is_public_showcase=true")
	}

	// Builds list only contains public builds
	rBuilds := pubRosterData["builds"].([]any)
	if len(rBuilds) != 1 {
		t.Fatalf("expected 1 public build in roster, got %d", len(rBuilds))
	}
	b0 := rBuilds[0].(map[string]any)
	if b0["id"] != pubBuildID {
		t.Errorf("expected public build ID %s, got %s", pubBuildID, b0["id"])
	}

	// Teams list contains the team, and its members include the private build via Implicit Member Read!
	rTeams := pubRosterData["teams"].([]any)
	if len(rTeams) != 1 {
		t.Fatalf("expected 1 public team in roster, got %d", len(rTeams))
	}
	t0 := rTeams[0].(map[string]any)
	tMembers := t0["members"].([]any)
	if len(tMembers) != 2 {
		t.Fatalf("expected 2 members in public team via implicit member read, got %d", len(tMembers))
	}
	m1 := tMembers[1].(map[string]any)["build"].(map[string]any)
	if m1["id"] != privBuildID {
		t.Errorf("expected member 2 build id %s, got %s", privBuildID, m1["id"])
	}

	// 7. Verify GET /showcase/{uid} returns verified_owner and has_public_roster = true
	showcaseRec2 := f.do(t, http.MethodGet, "/api/v1/showcase/"+uid, nil)
	if showcaseRec2.Code != http.StatusOK {
		t.Fatalf("expected 200 for showcase, got %d", showcaseRec2.Code)
	}
	scData2 := decodeBody(t, showcaseRec2)
	if scData2["has_public_roster"] != true {
		t.Errorf("expected has_public_roster=true, got %v", scData2["has_public_roster"])
	}
	vOwner, ok := scData2["verified_owner"].(map[string]any)
	if !ok || vOwner["uid"] != uid || vOwner["is_verified"] != true {
		t.Fatalf("expected valid verified_owner object, got %v", scData2["verified_owner"])
	}
	if vOwner["discord_username"] != "kirin" {
		t.Errorf("expected discord_username 'kirin', got %v", vOwner["discord_username"])
	}
}
