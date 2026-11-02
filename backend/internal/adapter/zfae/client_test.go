package zfae

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestParseCardHTML_Ranked(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("testdata", "card_sample.html"))
	if err != nil {
		t.Fatalf("failed to read testdata/card_sample.html: %v", err)
	}

	result, ok := ParseCardHTML(string(data))
	if !ok {
		t.Fatal("expected card to parse successfully")
	}

	if result.AgentID != 1611 {
		t.Errorf("expected AgentID 1611 (Claret), got %d", result.AgentID)
	}
	if result.AssessmentID != "5511555" {
		t.Errorf("expected assessment ID '5511555', got %q", result.AssessmentID)
	}

	rating := result.Rating
	if rating == nil {
		t.Fatal("expected non-nil rating")
	}
	if rating.Status != domain.FaeStatusLive {
		t.Errorf("expected status live, got %q", rating.Status)
	}
	if rating.Outdated {
		t.Error("expected outdated to be false")
	}
	if rating.Rank == nil || *rating.Rank != 4 {
		t.Errorf("expected rank 4, got %v", rating.Rank)
	}
	if rating.RankOf == nil || *rating.RankOf != 10556 {
		t.Errorf("expected rankOf 10556, got %v", rating.RankOf)
	}
	if rating.Score == nil || *rating.Score != 85.1 {
		t.Errorf("expected score 85.1, got %v", rating.Score)
	}
	if rating.TopPercentile == nil || *rating.TopPercentile != 0.00038 {
		t.Errorf("expected topPercentile 0.00038, got %v", rating.TopPercentile)
	}
	if rating.Slug == nil || *rating.Slug != "claret" {
		t.Errorf("expected slug 'claret', got %v", rating.Slug)
	}
	if rating.BracketName == nil || *rating.BracketName != "S Rank Limited W-Engines" {
		t.Errorf("expected bracket 'S Rank Limited W-Engines', got %v", rating.BracketName)
	}
	if rating.TimeAssessed == nil || *rating.TimeAssessed != 1793393915 {
		t.Errorf("expected timeAssessed 1793393915, got %v", rating.TimeAssessed)
	}

	if rating.Breakdown == nil {
		t.Fatal("expected non-nil breakdown")
	}
	if rating.Breakdown.WeaponPercent == nil || *rating.Breakdown.WeaponPercent != 100 {
		t.Errorf("expected weapon percent 100, got %v", rating.Breakdown.WeaponPercent)
	}
	if rating.Breakdown.DiscSetPercent == nil || *rating.Breakdown.DiscSetPercent != 100 {
		t.Errorf("expected disc set percent 100, got %v", rating.Breakdown.DiscSetPercent)
	}
	if rating.Breakdown.MainstatPercent == nil || *rating.Breakdown.MainstatPercent != 100 {
		t.Errorf("expected mainstat percent 100, got %v", rating.Breakdown.MainstatPercent)
	}
	if rating.Breakdown.SubstatPercent == nil || *rating.Breakdown.SubstatPercent != 86 {
		t.Errorf("expected substat percent 86, got %v", rating.Breakdown.SubstatPercent)
	}
}

func TestParseCardHTML_Unranked(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("testdata", "unranked_card.html"))
	if err != nil {
		t.Fatalf("failed to read testdata/unranked_card.html: %v", err)
	}

	result, ok := ParseCardHTML(string(data))
	if !ok {
		t.Fatal("expected unranked card to parse successfully")
	}

	if result.AgentID != 1261 {
		t.Errorf("expected AgentID 1261 (Jane), got %d", result.AgentID)
	}

	rating := result.Rating
	if rating == nil {
		t.Fatal("expected non-nil rating")
	}
	if rating.Status != domain.FaeStatusUnassessed {
		t.Errorf("expected status unassessed, got %q", rating.Status)
	}
	if rating.Rank != nil {
		t.Errorf("expected nil rank for unranked card, got %v", *rating.Rank)
	}
	if rating.Score != nil {
		t.Errorf("expected nil score for unranked card, got %v", *rating.Score)
	}
	if rating.TimeAssessed == nil || *rating.TimeAssessed != 1793481598 {
		t.Errorf("expected timeAssessed 1793481598, got %v", rating.TimeAssessed)
	}
	if rating.Slug == nil || *rating.Slug != "jane" {
		t.Errorf("expected slug 'jane', got %v", rating.Slug)
	}
}

func TestEquipmentFingerprint_ExactMatchWithDomain(t *testing.T) {
	data, err := os.ReadFile(filepath.Join("testdata", "card_sample.html"))
	if err != nil {
		t.Fatalf("failed to read testdata/card_sample.html: %v", err)
	}

	cardFP := ExtractCardEquipmentFingerprint(string(data))
	expectedCardFP := "w:r1|s1:CDMG+1,CR+2,DEF%+1,PEN+0|s2:CDMG+0,CR+2,DEF%+2,PEN+0|s3:CDMG+1,CR+3,DEF%+1,PEN+0|s4:CDMG+2,DEF%+2,HP%+0,PEN+0|s5:CR+1,DEF%+3,DEF+0,HP%+1|s6:CDMG+0,CR+3,DEF+1,PEN+1"
	if cardFP != expectedCardFP {
		t.Fatalf("card fingerprint mismatch:\ngot:  %s\nwant: %s", cardFP, expectedCardFP)
	}

	avatar := &zzz.AvatarData{
		Weapon: &zzz.Weapon{UpgradeLevel: 1},
		EquippedList: []zzz.EquippedItem{
			{
				Slot: 1,
				Equipment: &zzz.Equipment{
					RandomPropertyList: []zzz.Property{
						{PropertyID: 13102, PropertyLevel: 2}, // DEF% +1
						{PropertyID: 23203, PropertyLevel: 1}, // PEN +0
						{PropertyID: 21103, PropertyLevel: 2}, // CDMG +1
						{PropertyID: 20103, PropertyLevel: 3}, // CR +2
					},
				},
			},
			{
				Slot: 2,
				Equipment: &zzz.Equipment{
					RandomPropertyList: []zzz.Property{
						{PropertyID: 23203, PropertyLevel: 1}, // PEN +0
						{PropertyID: 13102, PropertyLevel: 3}, // DEF% +2
						{PropertyID: 21103, PropertyLevel: 1}, // CDMG +0
						{PropertyID: 20103, PropertyLevel: 3}, // CR +2
					},
				},
			},
			{
				Slot: 3,
				Equipment: &zzz.Equipment{
					RandomPropertyList: []zzz.Property{
						{PropertyID: 21103, PropertyLevel: 2}, // CDMG +1
						{PropertyID: 23203, PropertyLevel: 1}, // PEN +0
						{PropertyID: 13102, PropertyLevel: 2}, // DEF% +1
						{PropertyID: 20103, PropertyLevel: 4}, // CR +3
					},
				},
			},
			{
				Slot: 4,
				Equipment: &zzz.Equipment{
					RandomPropertyList: []zzz.Property{
						{PropertyID: 11102, PropertyLevel: 1}, // HP% +0
						{PropertyID: 21103, PropertyLevel: 3}, // CDMG +2
						{PropertyID: 13102, PropertyLevel: 3}, // DEF% +2
						{PropertyID: 23203, PropertyLevel: 1}, // PEN +0
					},
				},
			},
			{
				Slot: 5,
				Equipment: &zzz.Equipment{
					RandomPropertyList: []zzz.Property{
						{PropertyID: 11102, PropertyLevel: 2}, // HP% +1
						{PropertyID: 13103, PropertyLevel: 1}, // DEF +0
						{PropertyID: 13102, PropertyLevel: 4}, // DEF% +3
						{PropertyID: 20103, PropertyLevel: 2}, // CR +1
					},
				},
			},
			{
				Slot: 6,
				Equipment: &zzz.Equipment{
					RandomPropertyList: []zzz.Property{
						{PropertyID: 20103, PropertyLevel: 4}, // CR +3
						{PropertyID: 21103, PropertyLevel: 1}, // CDMG +0
						{PropertyID: 23203, PropertyLevel: 2}, // PEN +1
						{PropertyID: 13103, PropertyLevel: 2}, // DEF +1
					},
				},
			},
		},
	}

	domainFP := domain.ComputeEquipmentFingerprint(avatar)
	if domainFP != cardFP {
		t.Fatalf("domain fingerprint does not match card fingerprint:\ndomain: %s\ncard:   %s", domainFP, cardFP)
	}
}

func TestClient_SwitchLeaderboard(t *testing.T) {
	v2CardHTML := `<div class="agent-card" data-agent-slug="claret" data-assessment-id="5511555" data-rank="12" data-date-updated="1793393915" data-top-percentile="0.001">
		<img src="/img/agent_mindscapes/Mindscape_1611_3.webp">
		<ul class="dropdown-menu filter-menu">
			<li class="active"> <span onclick="switchLeaderboard(this, 5511555, 4)">Team Sandwich</span> </li>
		</ul>
		<span class="rank-of">5000</span>
		Total score:</span> <span>75.5</span>
		<div class="disc-details"><div class="stat-list slot1"><ul><li class="sub stat vertical impact3 Def_Ratio"><span class="label">DEF%</span></li></ul></div></div>
	</div>`

	v1CardHTML := `<div class="agent-card" data-agent-slug="claret" data-assessment-id="5511555" data-rank="4" data-date-updated="1793393915" data-top-percentile="0.00038">
		<img src="/img/agent_mindscapes/Mindscape_1611_3.webp">
		<ul class="dropdown-menu filter-menu">
			<li class="active"> <span onclick="switchLeaderboard(this, 5511555, 0)">Solo Bracket</span> </li>
		</ul>
		<span class="rank-of">10556</span>
		Total score:</span> <span>85.1</span>
	</div>`

	var switchCalled atomic.Bool

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/profile/1503562965" {
			_, _ = w.Write([]byte(v2CardHTML))
			return
		}
		if r.Method == http.MethodPost && r.URL.Path == "/profile" {
			_ = r.ParseForm()
			if r.FormValue("task") == "switchLeaderboard" && r.FormValue("assessmentId") == "5511555" && r.FormValue("leaderboardId") == "0" {
				switchCalled.Store(true)
				_, _ = w.Write([]byte(v1CardHTML))
				return
			}
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := NewClient(WithBaseURL(server.URL))
	ratings, err := client.FetchProfileRatings(context.Background(), "1503562965", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !switchCalled.Load() {
		t.Error("expected switchLeaderboard to be called for v2 leaderboard")
	}

	claretRating := ratings[1611]
	if claretRating == nil {
		t.Fatal("expected Claret rating to be present")
	}
	if claretRating.Rank == nil || *claretRating.Rank != 4 {
		t.Errorf("expected switched rank 4, got %v", claretRating.Rank)
	}
	if claretRating.Score == nil || *claretRating.Score != 85.1 {
		t.Errorf("expected switched score 85.1, got %v", claretRating.Score)
	}
}

func TestClient_ColdProfileAndCooldown(t *testing.T) {
	cardHTML := `<div class="agent-card" data-agent-slug="claret" data-assessment-id="5511555" data-rank="4" data-date-updated="1793393915" data-top-percentile="0.00038">
		<img src="/img/agent_mindscapes/Mindscape_1611_3.webp">
		<span class="rank-of">10556</span>
		Total score:</span> <span>85.1</span>
	</div>`

	var (
		fetchShowcaseCount atomic.Int32
		getProfileCount    atomic.Int32
	)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/profile/1500000000" {
			getProfileCount.Add(1)
			if fetchShowcaseCount.Load() == 0 {
				// Cold profile before fetchShowcase
				_, _ = w.Write([]byte(`<div>No agents yet</div>`))
				return
			}
			_, _ = w.Write([]byte(cardHTML))
			return
		}
		if r.Method == http.MethodPost && r.URL.Path == "/profile" {
			_ = r.ParseForm()
			if r.FormValue("task") == "fetchShowcase" && r.FormValue("userUid") == "1500000000" {
				fetchShowcaseCount.Add(1)
				_, _ = w.Write([]byte("success"))
				return
			}
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := NewClient(
		WithBaseURL(server.URL),
		WithCooldown(100*time.Millisecond),
	)

	// First fetch: cold profile (0 cards) triggers fetchShowcase
	ratings, err := client.FetchProfileRatings(context.Background(), "1500000000", false)
	if err != nil {
		t.Fatalf("first fetch failed: %v", err)
	}
	if ratings[1611] == nil {
		t.Fatal("expected Claret rating after cold fetch")
	}
	if fetchShowcaseCount.Load() != 1 {
		t.Errorf("expected 1 fetchShowcase call, got %d", fetchShowcaseCount.Load())
	}

	// Immediate second fetch with forceRefresh=true: cooldown is active, so fetchShowcase should NOT be called again
	_, err = client.FetchProfileRatings(context.Background(), "1500000000", true)
	if err != nil {
		t.Fatalf("second fetch failed: %v", err)
	}
	if fetchShowcaseCount.Load() != 1 {
		t.Errorf("expected fetchShowcase count to remain 1 due to cooldown, got %d", fetchShowcaseCount.Load())
	}

	// Wait for cooldown to expire
	time.Sleep(120 * time.Millisecond)

	// Third fetch with forceRefresh=true: cooldown expired, fetchShowcase should be called again
	_, err = client.FetchProfileRatings(context.Background(), "1500000000", true)
	if err != nil {
		t.Fatalf("third fetch failed: %v", err)
	}
	if fetchShowcaseCount.Load() != 2 {
		t.Errorf("expected 2 fetchShowcase calls after cooldown, got %d", fetchShowcaseCount.Load())
	}
}

func TestClient_ExistingProfileRefreshesShowcase(t *testing.T) {
	const uid = "1504687050"
	const claretHTML = `<div class="agent-card" data-agent-slug="claret" data-assessment-id="5511555" data-rank="4"><span class="rank-of">10556</span></div>`
	const phoenixHTML = `<div class="agent-card" data-agent-slug="phoenix" data-assessment-id="5511556" data-rank="352"><span class="rank-of">5667</span></div>`
	var getCount, refreshCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/profile/"+uid {
			getCount.Add(1)
			html := claretHTML
			if refreshCount.Load() > 0 {
				html += phoenixHTML
			}
			_, _ = w.Write([]byte(html))
			return
		}
		if r.Method == http.MethodPost && r.URL.Path == "/profile" {
			if err := r.ParseForm(); err != nil {
				t.Errorf("ParseForm() = %v, want nil", err)
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			if r.FormValue("task") == "fetchShowcase" && r.FormValue("userUid") == uid {
				refreshCount.Add(1)
				_, _ = w.Write([]byte("success"))
				return
			}
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(server.Close)
	client := NewClient(WithBaseURL(server.URL), WithCooldown(time.Hour))

	ratings, err := client.FetchProfileRatings(context.Background(), uid, false)
	if err != nil {
		t.Fatalf("FetchProfileRatings(%q, false) error = %v, want nil", uid, err)
	}
	if ratings[1641] == nil {
		t.Errorf("FetchProfileRatings(%q, false)[1641] = nil, want Phoenix rating after showcase refresh", uid)
	}
	if ratings[1611] == nil {
		t.Errorf("FetchProfileRatings(%q, false)[1611] = nil, want existing Claret rating", uid)
	}
	if got := refreshCount.Load(); got != 1 {
		t.Errorf("FetchProfileRatings(%q, false) showcase requests = %d, want 1", uid, got)
	}

	_, err = client.FetchProfileRatings(context.Background(), uid, false)
	if err != nil {
		t.Fatalf("FetchProfileRatings(%q, false) cached error = %v, want nil", uid, err)
	}
	if got := getCount.Load(); got != 2 {
		t.Errorf("FetchProfileRatings(%q, false) cached profile requests = %d, want 2", uid, got)
	}
	if got := refreshCount.Load(); got != 1 {
		t.Errorf("FetchProfileRatings(%q, false) cached showcase requests = %d, want 1", uid, got)
	}

	client.mu.Lock()
	client.cache[uid].expiresAt = time.Now().Add(-time.Second)
	client.mu.Unlock()
	_, err = client.FetchProfileRatings(context.Background(), uid, false)
	if err != nil {
		t.Fatalf("FetchProfileRatings(%q, false) expired cache error = %v, want nil", uid, err)
	}
	if got := getCount.Load(); got != 3 {
		t.Errorf("FetchProfileRatings(%q, false) expired cache profile requests = %d, want 3", uid, got)
	}
	if got := refreshCount.Load(); got != 1 {
		t.Errorf("FetchProfileRatings(%q, false) during cooldown showcase requests = %d, want 1", uid, got)
	}
}

func TestClient_ExistingProfileSurvivesRefreshFailure(t *testing.T) {
	const uid = "1504687050"
	const cardHTML = `<div class="agent-card" data-agent-slug="claret" data-assessment-id="5511555" data-rank="4"><span class="rank-of">10556</span></div>`
	var refreshCount atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/profile/"+uid {
			_, _ = w.Write([]byte(cardHTML))
			return
		}
		if r.Method == http.MethodPost && r.URL.Path == "/profile" {
			refreshCount.Add(1)
			http.Error(w, "unavailable", http.StatusServiceUnavailable)
			return
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(server.Close)
	client := NewClient(WithBaseURL(server.URL))

	ratings, err := client.FetchProfileRatings(context.Background(), uid, false)
	if err != nil {
		t.Fatalf("FetchProfileRatings(%q, false) error = %v, want nil after refresh failure", uid, err)
	}
	if ratings[1611] == nil || ratings[1611].Rank == nil || *ratings[1611].Rank != 4 {
		t.Errorf("FetchProfileRatings(%q, false)[1611] = %+v, want existing Claret rank 4", uid, ratings[1611])
	}
	if got := refreshCount.Load(); got != 1 {
		t.Errorf("FetchProfileRatings(%q, false) showcase requests = %d, want 1", uid, got)
	}
}
