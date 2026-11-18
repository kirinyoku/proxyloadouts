package http

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"golang.org/x/time/rate"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
)

func TestNoteVisibilityAcrossPublicReads(t *testing.T) {
	f := newFixtureWithOpts(t, Options{
		PublicReadRateLimiter: NewIPRateLimiter(rate.Inf, 1, time.Minute),
	})
	owner := f.login(t)

	const (
		uid       = "1504687099"
		buildNote = "Miyabi note for visibility test"
		teamNote  = "Team note for visibility test"
	)

	account := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": uid}, owner)
	if account.Code != http.StatusCreated {
		t.Fatalf("create account: %d %s", account.Code, account.Body.String())
	}
	accountID := decodeBody(t, account)["id"].(string)
	accountRepo := sqlite.NewAccountRepo(f.db)
	ctx := context.Background()
	if err := accountRepo.VerifyOwnership(ctx, uuid.MustParse(accountID), uid, time.Now().UTC(), nil, nil); err != nil {
		t.Fatalf("verify account: %v", err)
	}
	if err := accountRepo.UpdateSettings(ctx, uuid.MustParse(accountID), true, true, false); err != nil {
		t.Fatalf("publish account roster and squads: %v", err)
	}

	buildID := saveBuildViaAPI(t, f, owner, accountID, map[string]any{"id": 1511, "name": "Miyabi", "level": 60})
	buildPath := "/api/v1/builds/" + buildID
	buildPatch := f.do(t, http.MethodPatch, buildPath, map[string]any{
		"is_public": true, "description": buildNote,
	}, owner)
	if buildPatch.Code != http.StatusNoContent {
		t.Fatalf("save build note: %d %s", buildPatch.Code, buildPatch.Body.String())
	}
	team := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accountID,
		"name":            "Ice",
		"build_ids":       []string{buildID},
		"is_public":       true,
		"description":     teamNote,
	}, owner)
	if team.Code != http.StatusCreated {
		t.Fatalf("create public team: %d %s", team.Code, team.Body.String())
	}
	teamID := decodeBody(t, team)["id"].(string)
	teamPath := "/api/v1/teams/" + teamID

	sharePath := func(createPath, readPath string) string {
		t.Helper()
		rec := f.do(t, http.MethodPost, createPath, nil, owner)
		if rec.Code != http.StatusCreated {
			t.Fatalf("create share at %s: %d %s", createPath, rec.Code, rec.Body.String())
		}
		return readPath + decodeBody(t, rec)["token"].(string)
	}

	publicReads := []struct {
		path  string
		notes []string
	}{
		{"/api/v1/public/builds/" + buildID, []string{buildNote}},
		{"/api/v1/public/teams/" + teamID, []string{buildNote, teamNote}},
		{"/api/v1/showcase/" + uid + "/roster", []string{buildNote, teamNote}},
		{sharePath(buildPath+"/share", "/api/v1/shared/builds/"), []string{buildNote}},
		{sharePath(teamPath+"/share", "/api/v1/shared/teams/"), []string{buildNote, teamNote}},
		{sharePath("/api/v1/accounts/"+accountID+"/roster-share", "/api/v1/shared/rosters/"), []string{buildNote}},
		{sharePath("/api/v1/accounts/"+accountID+"/teams-share", "/api/v1/shared/squads/"), []string{buildNote, teamNote}},
		{"/b/" + buildID, []string{buildNote}},
		{"/t/" + teamID, []string{teamNote}},
	}
	checkPublicReads := func(wantNotes bool) {
		t.Helper()
		for _, read := range publicReads {
			rec := f.do(t, http.MethodGet, read.path, nil)
			if rec.Code != http.StatusOK {
				t.Errorf("GET %s: %d %s", read.path, rec.Code, rec.Body.String())
				continue
			}
			for _, note := range read.notes {
				if got := strings.Contains(rec.Body.String(), note); got != wantNotes {
					t.Errorf("GET %s: contains note %q = %t, want %t", read.path, note, got, wantNotes)
				}
			}
		}
	}
	checkPublicReads(false)

	ownedTeam := f.do(t, http.MethodGet, teamPath, nil, owner)
	if ownedTeam.Code != http.StatusOK {
		t.Fatalf("GET owned team: %d %s", ownedTeam.Code, ownedTeam.Body.String())
	}
	for _, note := range []string{buildNote, teamNote} {
		if !strings.Contains(ownedTeam.Body.String(), note) {
			t.Errorf("GET owned team is missing private note %q", note)
		}
	}

	for _, isPublic := range []bool{true, false} {
		body := map[string]any{"is_note_public": isPublic}
		buildPatch := f.do(t, http.MethodPatch, buildPath, body, owner)
		if buildPatch.Code != http.StatusNoContent {
			t.Fatalf("set build note visibility: %d %s", buildPatch.Code, buildPatch.Body.String())
		}
		teamPatch := f.do(t, http.MethodPatch, teamPath, body, owner)
		if teamPatch.Code != http.StatusOK {
			t.Fatalf("set team note visibility: %d %s", teamPatch.Code, teamPatch.Body.String())
		}
		checkPublicReads(isPublic)
	}
}
