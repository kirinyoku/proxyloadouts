package http

import (
	"net/http"
	"testing"
)

func TestShareLinksKeepVisibilitySeparate(t *testing.T) {
	f := newFixture(t)
	owner := f.login(t)
	other := f.loginAs(t, "userB")
	account := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, owner)
	accountID := decodeBody(t, account)["id"].(string)
	payload := map[string]any{"id": 1511, "name": "Miyabi", "level": 60}
	privateID := saveBuildViaAPI(t, f, owner, accountID, payload)
	f.do(t, http.MethodPatch, "/api/v1/builds/"+privateID, map[string]any{"is_public": false}, owner)
	publicID := saveBuildViaAPI(t, f, owner, accountID, map[string]any{"id": 1512, "name": "Soukaku", "level": 60})
	f.do(t, http.MethodPatch, "/api/v1/builds/"+publicID, map[string]any{"is_public": true}, owner)
	buildStatus := "/api/v1/builds/" + privateID + "/share"
	rosterStatus := "/api/v1/accounts/" + accountID + "/roster-share"
	for _, path := range []string{buildStatus, rosterStatus} {
		if rec := f.do(t, http.MethodGet, path, nil, other); rec.Code != http.StatusNotFound {
			t.Fatalf("other owner read link status: %d", rec.Code)
		}
		if rec := f.do(t, http.MethodGet, path, nil, owner); rec.Code != http.StatusOK || decodeBody(t, rec)["active"] != false {
			t.Fatalf("initial link status: %d %s", rec.Code, rec.Body.String())
		}
	}
	if rec := f.do(t, http.MethodPost, "/api/v1/builds/"+privateID+"/share", nil, other); rec.Code != http.StatusNotFound {
		t.Fatalf("other owner created link: %d", rec.Code)
	}
	created := f.do(t, http.MethodPost, "/api/v1/builds/"+privateID+"/share", nil, owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("create build link: %d %s", created.Code, created.Body.String())
	}
	token := decodeBody(t, created)["token"].(string)
	if rec := f.do(t, http.MethodGet, "/api/v1/public/builds/"+privateID, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("private build became public: %d", rec.Code)
	}
	shared := f.do(t, http.MethodGet, "/api/v1/shared/builds/"+token, nil)
	if shared.Code != http.StatusOK || decodeBody(t, shared)["build"].(map[string]any)["is_public"] != false {
		t.Fatalf("shared private build: %d %s", shared.Code, shared.Body.String())
	}
	createdRoster := f.do(t, http.MethodPost, "/api/v1/accounts/"+accountID+"/roster-share", nil, owner)
	if createdRoster.Code != http.StatusCreated {
		t.Fatalf("create roster link: %d %s", createdRoster.Code, createdRoster.Body.String())
	}
	rosterToken := decodeBody(t, createdRoster)["token"].(string)
	for _, path := range []string{buildStatus, rosterStatus} {
		if rec := f.do(t, http.MethodGet, path, nil, owner); rec.Code != http.StatusOK || decodeBody(t, rec)["active"] != true {
			t.Fatalf("active link status: %d %s", rec.Code, rec.Body.String())
		}
	}
	roster := f.do(t, http.MethodGet, "/api/v1/shared/rosters/"+rosterToken, nil)
	if roster.Code != http.StatusOK {
		t.Fatalf("shared roster: %d %s", roster.Code, roster.Body.String())
	}
	builds := decodeBody(t, roster)["builds"].([]any)
	if len(builds) != 1 || builds[0].(map[string]any)["id"] != publicID {
		t.Fatalf("roster includes private builds: %v", builds)
	}
	f.do(t, http.MethodDelete, "/api/v1/builds/"+privateID+"/share", nil, owner)
	if rec := f.do(t, http.MethodGet, "/api/v1/shared/builds/"+token, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("revoked link remains accessible: %d", rec.Code)
	}
	f.do(t, http.MethodDelete, "/api/v1/accounts/"+accountID+"/roster-share", nil, owner)
	if rec := f.do(t, http.MethodGet, "/api/v1/shared/rosters/"+rosterToken, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("revoked roster link remains accessible: %d", rec.Code)
	}
	for _, path := range []string{buildStatus, rosterStatus} {
		if rec := f.do(t, http.MethodGet, path, nil, owner); rec.Code != http.StatusOK || decodeBody(t, rec)["active"] != false {
			t.Fatalf("revoked link status: %d %s", rec.Code, rec.Body.String())
		}
	}
}

func TestTeamAndSquadShareLinks(t *testing.T) {
	f := newFixture(t)
	owner := f.login(t)
	other := f.loginAs(t, "userB")

	account := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1504687050"}, owner)
	accountID := decodeBody(t, account)["id"].(string)

	payload1 := map[string]any{"id": 1511, "name": "Miyabi", "level": 60}
	b1 := saveBuildViaAPI(t, f, owner, accountID, payload1)
	payload2 := map[string]any{"id": 1512, "name": "Soukaku", "level": 60}
	b2 := saveBuildViaAPI(t, f, owner, accountID, payload2)

	teamRec := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accountID,
		"name":            "Ice Duo",
		"build_ids":       []string{b1, b2},
		"is_public":       false,
	}, owner)
	if teamRec.Code != http.StatusCreated {
		t.Fatalf("create team failed: %d %s", teamRec.Code, teamRec.Body.String())
	}
	teamID := decodeBody(t, teamRec)["id"].(string)

	teamStatusPath := "/api/v1/teams/" + teamID + "/share"
	squadsStatusPath := "/api/v1/accounts/" + accountID + "/teams-share"

	for _, path := range []string{teamStatusPath, squadsStatusPath} {
		if rec := f.do(t, http.MethodGet, path, nil, other); rec.Code != http.StatusNotFound {
			t.Fatalf("other owner read link status: %d", rec.Code)
		}
		if rec := f.do(t, http.MethodGet, path, nil, owner); rec.Code != http.StatusOK || decodeBody(t, rec)["active"] != false {
			t.Fatalf("initial link status: %d %s", rec.Code, rec.Body.String())
		}
	}

	// 1. Create and read Team Share
	createdTeam := f.do(t, http.MethodPost, "/api/v1/teams/"+teamID+"/share", nil, owner)
	if createdTeam.Code != http.StatusCreated {
		t.Fatalf("create team link: %d %s", createdTeam.Code, createdTeam.Body.String())
	}
	teamToken := decodeBody(t, createdTeam)["token"].(string)

	if rec := f.do(t, http.MethodGet, teamStatusPath, nil, owner); rec.Code != http.StatusOK || decodeBody(t, rec)["active"] != true {
		t.Fatalf("team link status not active: %d", rec.Code)
	}

	sharedTeam := f.do(t, http.MethodGet, "/api/v1/shared/teams/"+teamToken, nil)
	if sharedTeam.Code != http.StatusOK {
		t.Fatalf("get shared team failed: %d %s", sharedTeam.Code, sharedTeam.Body.String())
	}
	sharedTeamBody := decodeBody(t, sharedTeam)
	if sharedTeamBody["team"].(map[string]any)["id"] != teamID {
		t.Fatalf("mismatched shared team id: %v", sharedTeamBody["team"])
	}

	// 2. Create and read Squads Share
	createdSquads := f.do(t, http.MethodPost, "/api/v1/accounts/"+accountID+"/teams-share", nil, owner)
	if createdSquads.Code != http.StatusCreated {
		t.Fatalf("create squads link: %d %s", createdSquads.Code, createdSquads.Body.String())
	}
	squadsToken := decodeBody(t, createdSquads)["token"].(string)

	if rec := f.do(t, http.MethodGet, squadsStatusPath, nil, owner); rec.Code != http.StatusOK || decodeBody(t, rec)["active"] != true {
		t.Fatalf("squads link status not active: %d", rec.Code)
	}

	sharedSquads := f.do(t, http.MethodGet, "/api/v1/shared/squads/"+squadsToken, nil)
	if sharedSquads.Code != http.StatusOK {
		t.Fatalf("get shared squads failed: %d %s", sharedSquads.Code, sharedSquads.Body.String())
	}

	// 3. Revoke Team Share
	f.do(t, http.MethodDelete, "/api/v1/teams/"+teamID+"/share", nil, owner)
	if rec := f.do(t, http.MethodGet, "/api/v1/shared/teams/"+teamToken, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("revoked team link remains accessible: %d", rec.Code)
	}
	if rec := f.do(t, http.MethodGet, teamStatusPath, nil, owner); rec.Code != http.StatusOK || decodeBody(t, rec)["active"] != false {
		t.Fatalf("team link status not inactive after revoke: %d", rec.Code)
	}

	// 4. Revoke Squads Share
	f.do(t, http.MethodDelete, "/api/v1/accounts/"+accountID+"/teams-share", nil, owner)
	if rec := f.do(t, http.MethodGet, "/api/v1/shared/squads/"+squadsToken, nil); rec.Code != http.StatusNotFound {
		t.Fatalf("revoked squads link remains accessible: %d", rec.Code)
	}
	if rec := f.do(t, http.MethodGet, squadsStatusPath, nil, owner); rec.Code != http.StatusOK || decodeBody(t, rec)["active"] != false {
		t.Fatalf("squads link status not inactive after revoke: %d", rec.Code)
	}
}
