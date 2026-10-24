package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	fairy "github.com/kirinyoku/fairy"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// richShowcaseProfile builds a showcase with three fully equipped agents
// (W-Engine + two discs each, all UIDs disjoint) mimicking a real Enka scan.
func richShowcaseProfile(uid string) *fairy.Profile {
	specs := []struct {
		id        int
		name      string
		engineUID string
		discA     string
		discB     string
	}{
		{1511, "Miyabi", fmt.Sprintf("%d_engine", 1511), "32700_disc_1", "34100_disc_2"},
		{1411, "Ellen", fmt.Sprintf("%d_engine", 1411), "31000_disc_1", "32200_disc_2"},
		{1181, "Lycaon", fmt.Sprintf("%d_engine", 1181), "31200_disc_1", "31600_disc_2"},
	}

	profile := &fairy.Profile{
		UID:      uid,
		Nickname: "Chocola",
		Region:   fairy.RegionEU,
	}
	for _, s := range specs {
		engineUID := s.engineUID
		profile.Agents = append(profile.Agents, fairy.Agent{
			ID:    s.id,
			Name:  s.name,
			Level: 60,
			WEngine: &fairy.WEngine{
				ID:  s.id + 10000,
				UID: engineUID,
			},
			DriveDiscs: fairy.DriveDiscs{
				Slots: []fairy.DriveDisc{
					{UID: s.discA, Slot: 1},
					{UID: s.discB, Slot: 2},
				},
			},
		})
	}
	return profile
}

func TestAPI_FullUserJourney(t *testing.T) {
	f := newFixture(t)
	const uid = "1504687050"
	f.fetcher.profile = richShowcaseProfile(uid)
	f.fetcher.ttl = 60 * time.Second

	session := f.login(t)

	// 1. Public showcase scan (no session needed).
	scanRec := f.do(t, http.MethodGet, "/api/v1/showcase/"+uid, nil)
	if scanRec.Code != http.StatusOK {
		t.Fatalf("scan failed: %s", scanRec.Body.String())
	}
	scan := decodeBody(t, scanRec)
	if scan["nickname"] != "Chocola" || scan["source"] != "fresh" {
		t.Fatalf("unexpected scan payload: %v", scan)
	}
	agents, _ := scan["agents"].([]any)
	if len(agents) != 3 {
		t.Fatalf("expected 3 showcased agents, got %d", len(agents))
	}

	// 2. Immediate re-scan must come from the local TTL cache.
	rescanRec := f.do(t, http.MethodGet, "/api/v1/showcase/"+uid, nil)
	if rescan := decodeBody(t, rescanRec); rescan["source"] != "cached" {
		t.Errorf("expected cached re-scan, got %v", rescan["source"])
	}

	// 3. Link the game account.
	accountRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": uid}, session)
	if accountRec.Code != http.StatusCreated {
		t.Fatalf("account link failed: %s", accountRec.Body.String())
	}
	accountID, _ := decodeBody(t, accountRec)["id"].(string)

	// 4. Save every showcased agent as a build using the raw scan payload.
	buildIDs := make([]string, 0, len(agents))
	for i, a := range agents {
		agent, _ := a.(map[string]any)
		agentID := int(agent["id"].(float64))
		rawAvatarBytes, _ := json.Marshal(zzz.AvatarData{ID: agentID})
		rec := f.do(t, http.MethodPost, "/api/v1/builds", map[string]any{
			"game_account_id":   accountID,
			"name":              "",
			"raw_agent_payload": agent,
			"raw_data":          json.RawMessage(rawAvatarBytes),
		}, session)
		if rec.Code != http.StatusCreated {
			t.Fatalf("build save %d failed: %s", i, rec.Body.String())
		}
		body := decodeBody(t, rec)
		if body["weapon_uid"] == nil {
			t.Errorf("build %d: expected weapon uid extracted from payload", i)
		}
		if name, _ := body["name"].(string); name == "" {
			t.Error("expected auto-generated build name for empty input")
		}
		id, _ := body["id"].(string)
		buildIDs = append(buildIDs, id)
	}

	// 5. Live validation of the trio (GET so the report stays cacheable).
	validateRec := f.do(t, http.MethodGet, "/api/v1/teams/validate?build_ids="+strings.Join(buildIDs, ","), nil, session)
	if validateRec.Code != http.StatusOK {
		t.Fatalf("validate failed: %s", validateRec.Body.String())
	}
	if report := decodeBody(t, validateRec); report["is_valid"] != true {
		t.Errorf("expected valid trio, got %v", report)
	}

	// 6. Save the team.
	createRec := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accountID,
		"name":            "Ice Mono",
		"description":     "Shiyu 7",
		"build_ids":       buildIDs,
	}, session)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("team create failed: %s", createRec.Body.String())
	}
	teamID, _ := decodeBody(t, createRec)["id"].(string)

	// 7. Team detail carries full build payloads in slot order.
	detailRec := f.do(t, http.MethodGet, "/api/v1/teams/"+teamID, nil, session)
	if detailRec.Code != http.StatusOK {
		t.Fatalf("team detail failed: %s", detailRec.Body.String())
	}
	detail := decodeBody(t, detailRec)
	members, _ := detail["members"].([]any)
	if len(members) != 3 {
		t.Fatalf("expected 3 members, got %d", len(members))
	}
	for i, m := range members {
		member, _ := m.(map[string]any)
		if int(member["slot_number"].(float64)) != i+1 {
			t.Errorf("expected slot %d, got %v", i+1, member["slot_number"])
		}
		build, _ := member["build"].(map[string]any)
		if build["weapon_uid"] == nil {
			t.Errorf("member %d: expected build payload embedded", i)
		}
	}

	// 8. Team list exposes the validity report.
	listRec := f.do(t, http.MethodGet, "/api/v1/teams?game_account_id="+accountID, nil, session)
	summaries := decodeBodyList(t, listRec)
	if len(summaries) != 1 {
		t.Fatalf("expected 1 team summary, got %d", len(summaries))
	}
	summary, _ := summaries[0].(map[string]any)
	report, _ := summary["report"].(map[string]any)
	if report["is_valid"] != true {
		t.Errorf("expected valid report in list, got %v", report)
	}

	// 8a. The count endpoint answers without serializing the teams.
	countRec := f.do(t, http.MethodGet, "/api/v1/teams/count?game_account_id="+accountID, nil, session)
	if countRec.Code != http.StatusOK {
		t.Fatalf("team count failed: %s", countRec.Body.String())
	}
	if got := decodeBody(t, countRec)["count"]; got != float64(1) {
		t.Errorf("expected count 1, got %v", got)
	}
	if gotMax := decodeBody(t, countRec)["max"]; gotMax != float64(domain.MaxTeamsPerAccount) {
		t.Errorf("expected max %d, got %v", domain.MaxTeamsPerAccount, gotMax)
	}

	// 8b. Update team name and member composition.
	updateRec := f.do(t, http.MethodPut, "/api/v1/teams/"+teamID, map[string]any{
		"game_account_id": accountID,
		"name":            "Ice Anomaly Updated",
		"description":     "Updated note",
		"build_ids":       []string{buildIDs[0], buildIDs[1]},
	}, session)
	if updateRec.Code != http.StatusOK {
		t.Fatalf("team update failed: %s", updateRec.Body.String())
	}
	updatedTeam := decodeBody(t, updateRec)
	if updatedTeam["name"] != "Ice Anomaly Updated" {
		t.Errorf("expected name 'Ice Anomaly Updated', got %v", updatedTeam["name"])
	}

	// 9. Rename the first build; equipment stays immutable.
	patchRec := f.do(t, http.MethodPatch, "/api/v1/builds/"+buildIDs[0],
		map[string]string{"name": "Miyabi Main"}, session)
	if patchRec.Code != http.StatusNoContent {
		t.Fatalf("rename failed: %s", patchRec.Body.String())
	}

	// 10. Delete the team, then its builds become deletable.
	if rec := f.do(t, http.MethodDelete, "/api/v1/teams/"+teamID, nil, session); rec.Code != http.StatusNoContent {
		t.Fatalf("team delete failed: %d", rec.Code)
	}
	for _, id := range buildIDs {
		if rec := f.do(t, http.MethodDelete, "/api/v1/builds/"+id, nil, session); rec.Code != http.StatusNoContent {
			t.Errorf("build delete after team removal failed: %d", rec.Code)
		}
	}

	// 11. Unlinking the account cascades whatever is left (nothing here).
	if rec := f.do(t, http.MethodDelete, "/api/v1/accounts/"+accountID, nil, session); rec.Code != http.StatusNoContent {
		t.Fatalf("account unlink failed: %d", rec.Code)
	}
	listAfterRec := f.do(t, http.MethodGet, "/api/v1/accounts", nil, session)
	if accounts := decodeBodyList(t, listAfterRec); len(accounts) != 0 {
		t.Errorf("expected no linked accounts after unlink, got %d", len(accounts))
	}
}

func TestAPI_ConflictRejectionAndBuildProtection(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	accountRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, session)
	accountID, _ := decodeBody(t, accountRec)["id"].(string)

	sharedDiscPayload := func(agentID int, name string) map[string]any {
		return map[string]any{
			"id": agentID, "name": name, "level": 60,
			"w_engine":    map[string]any{"id": agentID * 10, "uid": fmt.Sprintf("engine_%d", agentID)},
			"drive_discs": map[string]any{"slots": []any{map[string]any{"uid": "33041_shared", "slot": 1}}},
		}
	}

	first := saveBuildViaAPI(t, f, session, accountID, sharedDiscPayload(1511, "Miyabi"))
	second := saveBuildViaAPI(t, f, session, accountID, sharedDiscPayload(1411, "Ellen"))

	validateRec := f.do(t, http.MethodGet, "/api/v1/teams/validate?build_ids="+first+","+second, nil, session)
	report := decodeBody(t, validateRec)
	if report["is_valid"] != false {
		t.Fatal("expected conflicting validation report")
	}

	createRec := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accountID,
		"name":            "Broken",
		"build_ids":       []string{first, second},
	}, session)
	if createRec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 conflict rejection, got %d: %s", createRec.Code, createRec.Body.String())
	}
	body := decodeBody(t, createRec)
	if _, has := body["conflicts"]; !has {
		t.Error("expected conflicts report attached to rejection")
	}

	// No partial team rows.
	listRec := f.do(t, http.MethodGet, "/api/v1/teams?game_account_id="+accountID, nil, session)
	if summaries := decodeBodyList(t, listRec); len(summaries) != 0 {
		t.Errorf("expected rejected team to leave nothing behind, got %d", len(summaries))
	}

	// Builds used by nobody can be deleted; simulate team usage via a valid team.
	third := saveBuildViaAPI(t, f, session, accountID, sharedDiscPayload(1181, "Lycaon"))
	okTeamRec := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accountID,
		"name":            "Fine",
		"build_ids":       []string{third},
	}, session)
	if okTeamRec.Code != http.StatusCreated {
		t.Fatalf("valid team create failed: %s", okTeamRec.Body.String())
	}
	if rec := f.do(t, http.MethodDelete, "/api/v1/builds/"+third, nil, session); rec.Code != http.StatusConflict {
		t.Errorf("expected 409 deleting team-used build, got %d", rec.Code)
	}
}

func TestAPI_OwnershipIsolation(t *testing.T) {
	f := newFixture(t)

	sessionA := f.loginAs(t, "userA")
	sessionB := f.loginAs(t, "userB")

	// User A links an account and saves a build.
	accountRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, sessionA)
	accountIDA, _ := decodeBody(t, accountRec)["id"].(string)
	payload := map[string]any{
		"id": 1511, "name": "Miyabi",
		"drive_discs": map[string]any{"slots": []any{map[string]any{"uid": "33041_a", "slot": 1}}},
	}
	buildA := saveBuildViaAPI(t, f, sessionA, accountIDA, payload)

	// User B cannot touch A's resources.
	if rec := f.do(t, http.MethodGet, "/api/v1/builds/"+buildA, nil, sessionB); rec.Code != http.StatusForbidden {
		t.Errorf("expected foreign build read to be forbidden, got %d", rec.Code)
	}
	if rec := f.do(t, http.MethodPatch, "/api/v1/builds/"+buildA, map[string]string{"name": "Hijack"}, sessionB); rec.Code != http.StatusForbidden {
		t.Errorf("expected foreign build rename to be forbidden, got %d", rec.Code)
	}
	if rec := f.do(t, http.MethodDelete, "/api/v1/builds/"+buildA, nil, sessionB); rec.Code != http.StatusForbidden {
		t.Errorf("expected foreign build delete to be forbidden, got %d", rec.Code)
	}
	if rec := f.do(t, http.MethodGet, "/api/v1/builds?game_account_id="+accountIDA, nil, sessionB); rec.Code != http.StatusForbidden {
		t.Errorf("expected foreign account listing to be forbidden, got %d", rec.Code)
	}
	if rec := f.do(t, http.MethodDelete, "/api/v1/accounts/"+accountIDA, nil, sessionB); rec.Code != http.StatusForbidden {
		t.Errorf("expected foreign account delete to be forbidden, got %d", rec.Code)
	}

	// B builds their own team; A cannot read it.
	accountRecB := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504699999"}, sessionB)
	accountIDB, _ := decodeBody(t, accountRecB)["id"].(string)
	buildB := saveBuildViaAPI(t, f, sessionB, accountIDB, payload)
	teamRec := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accountIDB,
		"name":            "B Team",
		"build_ids":       []string{buildB},
	}, sessionB)
	if teamRec.Code != http.StatusCreated {
		t.Fatalf("team create failed: %s", teamRec.Body.String())
	}
	teamID, _ := decodeBody(t, teamRec)["id"].(string)

	if rec := f.do(t, http.MethodGet, "/api/v1/teams/"+teamID, nil, sessionA); rec.Code != http.StatusForbidden {
		t.Errorf("expected foreign team read to be forbidden, got %d", rec.Code)
	}
	if rec := f.do(t, http.MethodDelete, "/api/v1/teams/"+teamID, nil, sessionA); rec.Code != http.StatusForbidden {
		t.Errorf("expected foreign team delete to be forbidden, got %d", rec.Code)
	}
	if rec := f.do(t, http.MethodGet, "/api/v1/teams/count?game_account_id="+accountIDB, nil, sessionA); rec.Code != http.StatusForbidden {
		t.Errorf("expected foreign team count to be forbidden, got %d", rec.Code)
	}

	// Same UID cannot be linked twice by different users? It can — but twice by one user cannot.
	dupRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504699999"}, sessionB)
	if dupRec.Code != http.StatusConflict {
		t.Errorf("expected duplicate uid conflict for same user, got %d", dupRec.Code)
	}
}

func TestAPI_RequestValidation(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	cases := []struct {
		name   string
		method string
		path   string
		body   string
		want   int
	}{
		{"malformed json", http.MethodPost, "/api/v1/accounts", `{invalid`, http.StatusBadRequest},
		{"unknown field", http.MethodPost, "/api/v1/accounts", `{"uid":"1504687050","admin":true}`, http.StatusBadRequest},
		{"invalid uuid path param", http.MethodDelete, "/api/v1/accounts/not-a-uuid", "", http.StatusBadRequest},
		{"missing account filter", http.MethodGet, "/api/v1/builds", "", http.StatusBadRequest},
		{"invalid account filter", http.MethodGet, "/api/v1/builds?game_account_id=xyz", "", http.StatusBadRequest},
		{"empty team name", http.MethodPost, "/api/v1/teams",
			`{"game_account_id":"00000000-0000-0000-0000-000000000000","name":"  ","build_ids":["00000000-0000-0000-0000-000000000001"]}`,
			http.StatusBadRequest},
		{"zero builds", http.MethodPost, "/api/v1/teams",
			`{"game_account_id":"00000000-0000-0000-0000-000000000000","name":"X","build_ids":[]}`,
			http.StatusBadRequest},
		{"too many builds", http.MethodPost, "/api/v1/teams",
			`{"game_account_id":"00000000-0000-0000-0000-000000000000","name":"X","build_ids":[
				"00000000-0000-0000-0000-000000000001",
				"00000000-0000-0000-0000-000000000002",
				"00000000-0000-0000-0000-000000000003",
				"00000000-0000-0000-0000-000000000004"]}`,
			http.StatusBadRequest},
		{"blank build rename", http.MethodPatch, "/api/v1/builds/00000000-0000-0000-0000-000000000001",
			`{"name":"   "}`, http.StatusBadRequest},
		{"missing count account filter", http.MethodGet, "/api/v1/teams/count", "", http.StatusBadRequest},
		{"invalid count account filter", http.MethodGet, "/api/v1/teams/count?game_account_id=xyz", "", http.StatusBadRequest},
		{"missing validate build_ids", http.MethodGet, "/api/v1/teams/validate", "", http.StatusBadRequest},
		{"malformed validate build id", http.MethodGet,
			"/api/v1/teams/validate?build_ids=00000000-0000-0000-0000-000000000001,not-a-uuid", "", http.StatusBadRequest},
		{"empty entry in validate build_ids", http.MethodGet,
			"/api/v1/teams/validate?build_ids=00000000-0000-0000-0000-000000000001,,00000000-0000-0000-0000-000000000002", "", http.StatusBadRequest},
		{"validate with too many builds", http.MethodGet,
			"/api/v1/teams/validate?build_ids=00000000-0000-0000-0000-000000000001,00000000-0000-0000-0000-000000000002," +
				"00000000-0000-0000-0000-000000000003,00000000-0000-0000-0000-000000000004", "", http.StatusBadRequest},
	}
	for _, tc := range cases {
		rec := f.doRaw(t, tc.method, tc.path, tc.body, session)
		if rec.Code != tc.want {
			t.Errorf("%s: expected %d, got %d (%s)", tc.name, tc.want, rec.Code, rec.Body.String())
		}
	}
}

// saveBuildViaAPI posts an agent payload as a new build and returns its id.
func saveBuildViaAPI(t *testing.T, f *fixture, session *http.Cookie, accountID string, payload map[string]any) string {
	t.Helper()

	var agentID int
	switch v := payload["id"].(type) {
	case int:
		agentID = v
	case float64:
		agentID = int(v)
	}
	rawAvatarBytes, _ := json.Marshal(zzz.AvatarData{ID: agentID})

	rec := f.do(t, http.MethodPost, "/api/v1/builds", map[string]any{
		"game_account_id":   accountID,
		"name":              fmt.Sprintf("%v Build", payload["name"]),
		"raw_agent_payload": payload,
		"raw_data":          json.RawMessage(rawAvatarBytes),
	}, session)
	if rec.Code != http.StatusCreated {
		t.Fatalf("build save failed: %s", rec.Body.String())
	}
	id, _ := decodeBody(t, rec)["id"].(string)
	if id == "" {
		t.Fatal("expected build id")
	}
	return id
}

func TestAPI_BuildPartialUpdate(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	accountRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, session)
	accountID, _ := decodeBody(t, accountRec)["id"].(string)

	payload := map[string]any{
		"id": 1511, "name": "Miyabi", "level": 60,
		"w_engine":    map[string]any{"id": 15110, "uid": "1511_engine"},
		"drive_discs": map[string]any{"slots": []any{map[string]any{"uid": "32700_disc_1", "slot": 1}}},
	}
	buildID := saveBuildViaAPI(t, f, session, accountID, payload)

	// 1. Update only description (without providing name) -> 204
	patchDesc := f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID,
		map[string]any{"description": "Partial description update"}, session)
	if patchDesc.Code != http.StatusNoContent {
		t.Fatalf("update only description failed: %d (%s)", patchDesc.Code, patchDesc.Body.String())
	}

	getRec := f.do(t, http.MethodGet, "/api/v1/builds/"+buildID, nil, session)
	getBuild := decodeBody(t, getRec)
	if getBuild["name"] != "Miyabi Build" {
		t.Errorf("expected name to remain 'Miyabi Build', got %v", getBuild["name"])
	}
	if getBuild["description"] != "Partial description update" {
		t.Errorf("expected description to be 'Partial description update', got %v", getBuild["description"])
	}

	// 2. Clear description with null -> 204
	patchNull := f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID,
		map[string]any{"description": nil}, session)
	if patchNull.Code != http.StatusNoContent {
		t.Fatalf("clear description failed: %d (%s)", patchNull.Code, patchNull.Body.String())
	}

	getRec2 := f.do(t, http.MethodGet, "/api/v1/builds/"+buildID, nil, session)
	getBuild2 := decodeBody(t, getRec2)
	if getBuild2["description"] != nil {
		t.Errorf("expected description to be null, got %v", getBuild2["description"])
	}

	// 3. Update only name -> 204
	patchName := f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID,
		map[string]any{"name": "New Miyabi Name"}, session)
	if patchName.Code != http.StatusNoContent {
		t.Fatalf("update name failed: %d (%s)", patchName.Code, patchName.Body.String())
	}

	getRec3 := f.do(t, http.MethodGet, "/api/v1/builds/"+buildID, nil, session)
	getBuild3 := decodeBody(t, getRec3)
	if getBuild3["name"] != "New Miyabi Name" {
		t.Errorf("expected name 'New Miyabi Name', got %v", getBuild3["name"])
	}

	// 4. Update both name and description -> 204
	patchBoth := f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID,
		map[string]any{"name": "Final Name", "description": "Final Note"}, session)
	if patchBoth.Code != http.StatusNoContent {
		t.Fatalf("update both failed: %d (%s)", patchBoth.Code, patchBoth.Body.String())
	}

	getRec4 := f.do(t, http.MethodGet, "/api/v1/builds/"+buildID, nil, session)
	getBuild4 := decodeBody(t, getRec4)
	if getBuild4["name"] != "Final Name" || getBuild4["description"] != "Final Note" {
		t.Errorf("expected Final Name and Final Note, got %v / %v", getBuild4["name"], getBuild4["description"])
	}

	// 5. Empty body -> 400 Bad Request
	patchEmpty := f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID, map[string]any{}, session)
	if patchEmpty.Code != http.StatusBadRequest {
		t.Errorf("expected 400 for empty patch body, got %d", patchEmpty.Code)
	}
}
