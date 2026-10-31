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
