package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/kirinyoku/fairy"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestIsEnglishLang(t *testing.T) {
	tests := []struct {
		name string
		lang string
		want bool
	}{
		{"empty string", "", false},
		{"whitespace", "   ", false},
		{"russian simple", "ru", false},
		{"russian regional", "ru-RU", false},
		{"english simple", "en", true},
		{"english uppercase", "EN", true},
		{"english regional", "en-US", true},
		{"english gb", "en-GB", true},
		{"accept-language english priority", "en-US,en;q=0.9,ru;q=0.8", true},
		{"accept-language russian priority", "ru-RU,ru;q=0.9,en-US;q=0.8", false},
		{"accept-language weighted ru over en", "en;q=0.5, ru;q=0.9", false},
		{"accept-language english zero weight", "en;q=0, ru;q=0.8", false},
		{"accept-language english with underscore", "en_US", true},
		{"unsupported fallback", "ja", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isEnglishLang(tt.lang)
			if got != tt.want {
				t.Errorf("isEnglishLang(%q) = %v, want %v", tt.lang, got, tt.want)
			}
		})
	}
}

func TestBuildMetaForBuild_Localization(t *testing.T) {
	nick := "ProxyMaster"
	desc := "High anomaly burn setup"
	detail := &buildsvc.PublicBuildDetail{
		Build: &domain.AgentBuild{
			ID:          uuid.New(),
			AgentName:   "Burnice",
			Name:        "Burn DPS",
			Description: &desc,
			BuildData: []byte(`{
				"w_engine": {"name": "Flamemaker Shaker"},
				"drive_discs": {
					"set_bonuses": [
						{"set": {"name": "Chaos Jazz"}, "count": 4},
						{"set": {"name": "Inferno Metal"}, "count": 2}
					]
				},
				"ui_stats": {
					"atk": {"total": "2700"},
					"crit_rate": {"total": "55.0%"},
					"crit_dmg": {"total": "120.0%"},
					"anomaly_proficiency": {"total": "385"},
					"anomaly_mastery": {"total": "112"},
					"energy_regen": {"total": "1.8"},
					"pen_ratio": {"total": "24.0%"}
				},
				"splash_art_url": "https://example.com/burnice.png"
			}`),
		},
		Owner: &domain.PublicOwnerInfo{
			UID:      "1500000001",
			Region:   "Europe",
			Nickname: &nick,
		},
	}

	t.Run("Russian (default and explicit)", func(t *testing.T) {
		for _, l := range []string{"", "ru", "ru-RU"} {
			title, desc, img := buildMetaForBuild(detail, l)
			if img != "https://example.com/burnice.png" {
				t.Errorf("expected splash art url, got %q", img)
			}
			if !strings.Contains(title, "Сборка игрока ProxyMaster (UID 1500000001)") {
				t.Errorf("expected Russian title, got %q", title)
			}
			if !strings.Contains(desc, "Амплификатор: Flamemaker Shaker") {
				t.Errorf("expected Russian w-engine label, got %q", desc)
			}
			if !strings.Contains(desc, "Диски: 4-pc Chaos Jazz, 2-pc Inferno Metal") {
				t.Errorf("expected Russian drive discs label, got %q", desc)
			}
			if !strings.Contains(desc, "Крит 55.0%") || !strings.Contains(desc, "КУ 120.0%") {
				t.Errorf("expected Russian crit stats, got %q", desc)
			}
			if !strings.Contains(desc, "Знание аномалии 385") {
				t.Errorf("expected Russian anomaly proficiency label, got %q", desc)
			}
			if !strings.Contains(desc, "Контроль аномалии 112") {
				t.Errorf("expected Russian anomaly mastery label, got %q", desc)
			}
			if !strings.Contains(desc, "Восст. энергии 1.8") {
				t.Errorf("expected Russian energy regen label, got %q", desc)
			}
			if !strings.Contains(desc, "Пробивание 24.0%") {
				t.Errorf("expected Russian pen ratio label, got %q", desc)
			}
		}
	})

	t.Run("English", func(t *testing.T) {
		for _, l := range []string{"en", "en-US", "en-GB"} {
			title, desc, img := buildMetaForBuild(detail, l)
			if img != "https://example.com/burnice.png" {
				t.Errorf("expected splash art url, got %q", img)
			}
			if !strings.Contains(title, "Build by ProxyMaster (UID 1500000001)") {
				t.Errorf("expected English title, got %q", title)
			}
			if !strings.Contains(desc, "W-Engine: Flamemaker Shaker") {
				t.Errorf("expected English w-engine label, got %q", desc)
			}
			if !strings.Contains(desc, "Drive Discs: 4-pc Chaos Jazz, 2-pc Inferno Metal") {
				t.Errorf("expected English drive discs label, got %q", desc)
			}
			if !strings.Contains(desc, "CRIT Rate 55.0%") || !strings.Contains(desc, "CRIT DMG 120.0%") {
				t.Errorf("expected English crit stats, got %q", desc)
			}
			if !strings.Contains(desc, "Anomaly Proficiency 385") {
				t.Errorf("expected English anomaly proficiency label, got %q", desc)
			}
			if !strings.Contains(desc, "Anomaly Mastery 112") {
				t.Errorf("expected English anomaly mastery label, got %q", desc)
			}
			if !strings.Contains(desc, "Energy Regen 1.8") {
				t.Errorf("expected English energy regen label, got %q", desc)
			}
			if !strings.Contains(desc, "PEN Ratio 24.0%") {
				t.Errorf("expected English pen ratio label, got %q", desc)
			}
		}
	})
}

func TestTeamMetaForTeam_Localization(t *testing.T) {
	nick := "ProxyLeader"
	desc := "Fast fire stun rotation"
	detail := &teamsvc.PublicTeamDetail{
		Team: &domain.Team{
			ID:          uuid.New(),
			Name:        "Fire Disorder",
			Description: &desc,
		},
		Owner: &domain.PublicOwnerInfo{
			UID:      "1500000002",
			Region:   "Europe",
			Nickname: &nick,
		},
		Members: []teamsvc.MemberDetail{
			{
				Member: domain.TeamMember{SlotNumber: 1},
				Build: &domain.AgentBuild{
					AgentName: "Koleda",
					BuildData: []byte(`{"w_engine": {"name": "Hellfire Gears"}}`),
				},
			},
			{
				Member: domain.TeamMember{SlotNumber: 2},
				Build: &domain.AgentBuild{
					AgentName: "Burnice",
					BuildData: []byte(`{"w_engine": {"name": "Flamemaker Shaker"}}`),
				},
			},
		},
	}

	t.Run("Russian (default and explicit)", func(t *testing.T) {
		for _, l := range []string{"", "ru", "ru-RU"} {
			title, desc := teamMetaForTeam(detail, l)
			if !strings.Contains(title, "Отряд игрока ProxyLeader (UID 1500000002)") {
				t.Errorf("expected Russian team title, got %q", title)
			}
			if !strings.Contains(desc, "Состав: Koleda (Hellfire Gears), Burnice (Flamemaker Shaker)") {
				t.Errorf("expected Russian lineup label, got %q", desc)
			}
			if !strings.Contains(desc, "Заметка: Fast fire stun rotation") {
				t.Errorf("expected Russian note label, got %q", desc)
			}
		}
	})

	t.Run("English", func(t *testing.T) {
		for _, l := range []string{"en", "en-US", "en-GB"} {
			title, desc := teamMetaForTeam(detail, l)
			if !strings.Contains(title, "Squad by ProxyLeader (UID 1500000002)") {
				t.Errorf("expected English team title, got %q", title)
			}
			if !strings.Contains(desc, "Lineup: Koleda (Hellfire Gears), Burnice (Flamemaker Shaker)") {
				t.Errorf("expected English lineup label, got %q", desc)
			}
			if !strings.Contains(desc, "Note: Fast fire stun rotation") {
				t.Errorf("expected English note label, got %q", desc)
			}
		}
	})
}

func TestOpenGraph_HTTPEndpoints_Localization(t *testing.T) {
	f := newFixture(t)
	session := f.login(t)

	f.fetcher.agent = &fairy.Agent{
		Name: "Miyabi",
		WEngine: &fairy.WEngine{
			Name: "Asasumaru",
		},
		DriveDiscs: fairy.DriveDiscs{
			SetBonuses: []fairy.DriveDiscSetBonus{
				{
					Count: 4,
					Set:   fairy.Set{Name: "Woodpecker Electro"},
				},
			},
		},
		UIStats: fairy.UIStats{
			ATK:      fairy.FormattedStatBreakdown{Total: "2840"},
			CritRate: fairy.FormattedStatBreakdown{Total: "68.4%"},
			CritDMG:  fairy.FormattedStatBreakdown{Total: "142.0%"},
		},
	}

	// Create account and build
	accRec := f.do(t, http.MethodPost, "/api/v1/accounts", map[string]string{"uid": "1500000003"}, session)
	if accRec.Code != http.StatusCreated {
		t.Fatalf("failed to create account: %d", accRec.Code)
	}
	accData := decodeBody(t, accRec)
	accID := accData["id"].(string)

	buildPayload := map[string]any{
		"id": 1511, "name": "Miyabi", "level": 60,
		"w_engine":    map[string]any{"id": 15110, "uid": "1511_eng", "name": "Asasumaru"},
		"drive_discs": map[string]any{"slots": []any{map[string]any{"uid": "32700_1", "slot": 1}}},
	}
	buildID := saveBuildViaAPI(t, f, session, accID, buildPayload)

	// Make public
	_ = f.do(t, http.MethodPatch, "/api/v1/builds/"+buildID, map[string]any{"is_public": true}, session)

	// Create public team
	teamRec := f.do(t, http.MethodPost, "/api/v1/teams", map[string]any{
		"game_account_id": accID,
		"name":            "Ice Duo",
		"description":     "Team strategy",
		"is_public":       true,
		"build_ids":       []string{buildID},
	}, session)
	if teamRec.Code != http.StatusCreated {
		t.Fatalf("failed to create team: %d", teamRec.Code)
	}
	teamID := decodeBody(t, teamRec)["id"].(string)

	t.Run("Build OpenGraph with ?lang=en", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/b/"+buildID+"?lang=en", nil)
		rec := httptest.NewRecorder()
		f.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		body := rec.Body.String()
		if !strings.Contains(body, "Build by") {
			t.Errorf("expected HTML to contain 'Build by', got: %s", body[:600])
		}
		if !strings.Contains(body, "W-Engine:") {
			t.Errorf("expected HTML to contain 'W-Engine:', got: %s", body[:600])
		}
	})

	t.Run("Build OpenGraph with Accept-Language: en-US,en;q=0.9", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/b/"+buildID, nil)
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")
		rec := httptest.NewRecorder()
		f.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		body := rec.Body.String()
		if !strings.Contains(body, "Build by") {
			t.Errorf("expected HTML to contain 'Build by'")
		}
	})

	t.Run("Build OpenGraph default Russian", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/b/"+buildID, nil)
		rec := httptest.NewRecorder()
		f.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		body := rec.Body.String()
		if !strings.Contains(body, "Сборка игрока") {
			t.Errorf("expected HTML to contain 'Сборка игрока'")
		}
		if !strings.Contains(body, "Амплификатор:") {
			t.Errorf("expected HTML to contain 'Амплификатор:'")
		}
	})

	t.Run("Build OpenGraph with weighted Accept-Language ru over en", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/b/"+buildID, nil)
		req.Header.Set("Accept-Language", "en;q=0.5, ru;q=0.9")
		rec := httptest.NewRecorder()
		f.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		body := rec.Body.String()
		if !strings.Contains(body, "Сборка игрока") {
			t.Errorf("expected HTML to contain 'Сборка игрока' when Russian is prioritized, got %s", body[:600])
		}
	})

	t.Run("Build OpenGraph ?lang=en overrides Russian Accept-Language", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/b/"+buildID+"?lang=en", nil)
		req.Header.Set("Accept-Language", "ru-RU,ru;q=0.9")
		rec := httptest.NewRecorder()
		f.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		body := rec.Body.String()
		if !strings.Contains(body, "Build by") {
			t.Errorf("expected HTML to contain 'Build by' when ?lang=en overrides Accept-Language")
		}
	})

	t.Run("Team OpenGraph with ?lang=en", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/t/"+teamID+"?lang=en", nil)
		rec := httptest.NewRecorder()
		f.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		body := rec.Body.String()
		if !strings.Contains(body, "Squad by") {
			t.Errorf("expected HTML to contain 'Squad by'")
		}
		if !strings.Contains(body, "Lineup:") {
			t.Errorf("expected HTML to contain 'Lineup:'")
		}
		if !strings.Contains(body, "Note:") {
			t.Errorf("expected HTML to contain 'Note:'")
		}
	})

	t.Run("Team OpenGraph default Russian", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/t/"+teamID, nil)
		rec := httptest.NewRecorder()
		f.router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rec.Code)
		}
		body := rec.Body.String()
		if !strings.Contains(body, "Отряд игрока") {
			t.Errorf("expected HTML to contain 'Отряд игрока'")
		}
		if !strings.Contains(body, "Состав:") {
			t.Errorf("expected HTML to contain 'Состав:'")
		}
		if !strings.Contains(body, "Заметка:") {
			t.Errorf("expected HTML to contain 'Заметка:'")
		}
	})
}
