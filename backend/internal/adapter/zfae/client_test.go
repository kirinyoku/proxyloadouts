package zfae

import (
	"compress/gzip"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
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

func testClient(t *testing.T, handler http.HandlerFunc) (*Client, *sqlite.FaeStore) {
	t.Helper()
	db, err := sqlite.NewDB(filepath.Join(t.TempDir(), "fae.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := sqlite.Migrate(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	store := sqlite.NewFaeStore(db)
	client := NewClient(store, WithBaseURL(server.URL))
	client.pacing = 0
	nextRequestStart = time.Time{}
	return client, store
}

const rankedCard = `<div class="agent-card" data-agent-slug="claret" data-assessment-id="5511555" data-rank="4" data-date-updated="1793393915"><span class="rank-of">10556</span></div>`
const switchMarkup = `<li class="active"><span onclick="switchLeaderboard(this, 5511555, 4)">Other</span></li></div>`

func TestClientLocalReadsAndPersistentCooldown(t *testing.T) {
	var requests atomic.Int32
	c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.Method == http.MethodGet {
			_, _ = w.Write([]byte(profileDocument(rankedCard)))
		}
	})
	ctx := context.Background()
	cold, err := s.ReadProfile(ctx, "uid")
	if err != nil || cold.Current != nil {
		t.Fatalf("cold = %+v, %v", cold, err)
	}
	if requests.Load() != 0 {
		t.Fatal("cold local read contacted upstream")
	}
	p, err := c.RefreshProfile(ctx, "uid")
	if err != nil || p.Outcome != domain.FaeRefreshUpdated || p.Ratings()[1611] == nil {
		t.Fatalf("refresh = %+v, %v", p, err)
	}
	observed := p.Current.ObservedAt
	for range 3 {
		p, err = s.ReadProfile(ctx, "uid")
		if err != nil || !p.Current.ObservedAt.Equal(observed) {
			t.Fatalf("local observation time = %+v, %v", p, err)
		}
	}
	restarted := NewClient(s, WithBaseURL(c.baseURL))
	p, err = restarted.RefreshProfile(ctx, "uid")
	if err != nil || p.Outcome != domain.FaeRefreshCooldown {
		t.Fatalf("restart cooldown = %+v, %v", p, err)
	}
	if requests.Load() != 3 {
		t.Errorf("all requests = %d, want unchanged 3", requests.Load())
	}
}

func TestClientPersistsHistoryBeforeShowcaseMutation(t *testing.T) {
	var store *sqlite.FaeStore
	var gets int
	c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			gets++
			html := rankedCard
			if gets > 1 {
				html = strings.Replace(html, `data-rank="4"`, `data-rank="8"`, 1)
			}
			_, _ = w.Write([]byte(profileDocument(html)))
			return
		}
		p, err := store.ReadProfile(r.Context(), "uid")
		if err != nil || p.Ratings()[1611] == nil || *p.Ratings()[1611].Rank != 4 {
			t.Errorf("pre snapshot before POST = %+v, %v", p, err)
		}
	})
	store = s
	p, err := c.RefreshProfile(context.Background(), "uid")
	if err != nil {
		t.Fatal(err)
	}
	if len(p.History) != 1 || *p.History[0].Agents[1611].Rank != 4 || *p.Ratings()[1611].Rank != 8 {
		t.Fatalf("history = %+v", p)
	}
}

func TestClientBackoffEveryRequestKind(t *testing.T) {
	for _, step := range []int32{1, 2, 3, 4} {
		t.Run(strconv.Itoa(int(step)), func(t *testing.T) {
			var requests atomic.Int32
			c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) {
				n := requests.Add(1)
				if n == step {
					w.Header().Set("Retry-After", "120")
					w.WriteHeader(http.StatusTooManyRequests)
					return
				}
				html := rankedCard
				if step == 4 && n == 3 {
					html = strings.Replace(html, "</div>", switchMarkup, 1)
				}
				if r.Method == http.MethodGet {
					html = profileDocument(html)
				}
				_, _ = w.Write([]byte(html))
			})
			p, err := c.RefreshProfile(context.Background(), "uid")
			if err != nil || p.Outcome != domain.FaeRefreshBackoff {
				t.Fatalf("backoff = %+v, %v", p, err)
			}
			if requests.Load() != step {
				t.Errorf("requests = %d, want %d", requests.Load(), step)
			}
			restart := NewClient(s, WithBaseURL(c.baseURL))
			p, err = restart.RefreshProfile(context.Background(), "other")
			if err != nil || p.Outcome != domain.FaeRefreshBackoff || requests.Load() != step {
				t.Fatalf("shared backoff = %+v, %v, requests %d", p, err, requests.Load())
			}
			deadline, err := s.HostBackoff(context.Background())
			if err != nil || time.Until(deadline) < 119*time.Second {
				t.Errorf("retry deadline = %v, %v", deadline, err)
			}
		})
	}
}

func TestClientFailedRefreshRetainsDatedNumbers(t *testing.T) {
	for _, failure := range []string{"post", "missing", "malformed", "partial", "oversized", "switch"} {
		t.Run(failure, func(t *testing.T) {
			var gets int
			c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Method == http.MethodPost {
					_ = r.ParseForm()
					if failure == "post" || r.FormValue("task") == "switchLeaderboard" {
						w.WriteHeader(http.StatusServiceUnavailable)
					}
					return
				}
				gets++
				if gets == 1 {
					_, _ = w.Write([]byte(profileDocument(rankedCard)))
					return
				}
				switch failure {
				case "missing":
					http.NotFound(w, r)
				case "malformed":
					_, _ = w.Write([]byte("bad html"))
				case "partial":
					_, _ = w.Write([]byte(profileDocument(strings.Replace(rankedCard, `data-rank="4"`, `data-rank="8"`, 1) + `<div class="agent-card" data-agent-slug="unknown-agent"></div>`)))
				case "oversized":
					_, _ = w.Write([]byte(strings.Repeat("x", 1025)))
				case "switch":
					_, _ = w.Write([]byte(profileDocument(strings.Replace(rankedCard, "</div>", switchMarkup, 1))))
				}
			})
			c.profileLimit = 1024
			p, err := c.RefreshProfile(context.Background(), "uid")
			if err != nil || p.Outcome != domain.FaeRefreshFailed || p.Ratings()[1611] == nil || *p.Ratings()[1611].Rank != 4 || p.Ratings()[1611].ObservedAt == nil {
				t.Fatalf("retained fallback = %+v, %v", p, err)
			}
		})
	}
}

func TestClientBootstrapEmptyAndNormalization(t *testing.T) {
	var requests atomic.Int32
	c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		if r.Method == http.MethodGet {
			http.NotFound(w, r)
		}
	})
	p, err := c.RefreshProfile(context.Background(), "uid")
	if err != nil || p.Outcome != domain.FaeRefreshUpdated || p.Current == nil || len(p.Ratings()) != 0 || requests.Load() != 3 {
		t.Fatalf("404 bootstrap = %+v, %v, requests %d", p, err, requests.Load())
	}
	requests.Store(0)
	c, _ = testClient(t, func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		html := selectedCard(0)
		if r.Method == http.MethodGet {
			html = profileDocument(strings.Replace(rankedCard, "</div>", switchMarkup, 1))
		}
		_, _ = w.Write([]byte(html))
	})
	p, err = c.RefreshProfile(context.Background(), "uid")
	if err != nil || p.Outcome != domain.FaeRefreshUpdated || *p.Ratings()[1611].Rank != 4 {
		t.Fatalf("normalized = %+v, %v", p, err)
	}
	if requests.Load() != 5 {
		t.Errorf("normalized pre/post requests = %d, want 3+2 switches", requests.Load())
	}
}

func TestClientCancellationWhilePipelineBusy(t *testing.T) {
	c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) { t.Error("cancelled refresh contacted upstream") })
	pipeline <- struct{}{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := c.RefreshProfile(ctx, "uid")
	<-pipeline
	if !errors.Is(err, context.Canceled) {
		t.Errorf("cancelled wait = %v", err)
	}
}

func TestRetryAfter(t *testing.T) {
	now := time.Now().UTC().Truncate(time.Second)
	for _, value := range []string{"120", now.Add(2 * time.Minute).Format(http.TimeFormat)} {
		deadline, ok := retryAfter(value, now)
		if !ok || !deadline.Equal(now.Add(2*time.Minute)) {
			t.Errorf("retryAfter(%q) = %v, %t", value, deadline, ok)
		}
	}
}

func TestClientPacesAndSerializesDifferentUIDs(t *testing.T) {
	var starts []time.Time
	var mu sync.Mutex
	var inFlight atomic.Int32
	c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if inFlight.Add(1) != 1 {
			t.Error("overlapping upstream requests")
		}
		defer inFlight.Add(-1)
		mu.Lock()
		starts = append(starts, time.Now())
		mu.Unlock()
		if r.Method == http.MethodGet {
			_, _ = w.Write([]byte(profileDocument(rankedCard)))
		}
	})
	c.pacing = 500 * time.Millisecond
	var wg sync.WaitGroup
	for _, uid := range []string{"one", "two", "one"} {
		wg.Go(func() {
			p, err := c.RefreshProfile(context.Background(), uid)
			if err != nil {
				t.Error(err)
			}
			if p == nil {
				t.Error("missing refresh result")
			}
		})
	}
	wg.Wait()
	mu.Lock()
	defer mu.Unlock()
	if len(starts) != 6 {
		t.Fatalf("concurrent request starts = %d, want6", len(starts))
	}
	for i := 1; i < len(starts); i++ {
		if delta := starts[i].Sub(starts[i-1]); delta < 490*time.Millisecond {
			t.Errorf("request start spacing = %v, want at least500ms allowing scheduler jitter", delta)
		}
	}
}

func TestClientFailedPreDoesNotOverwriteSavedObservation(t *testing.T) {
	var gets atomic.Int32
	c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		gets.Add(1)
		body := strings.Replace(rankedCard, "</div>", switchMarkup, 1)
		if r.Method == http.MethodGet {
			body = profileDocument(body)
		}
		_, _ = w.Write([]byte(body))
	})
	ctx := context.Background()
	now := time.Now().Add(-time.Hour)
	if _, err := s.ReserveRefresh(ctx, "uid", now, time.Minute, 1000); err != nil {
		t.Fatal(err)
	}
	rank := 2
	observed := domain.FaeObservation{ObservedAt: now, Agents: map[int]*domain.FaeRating{1611: {Rank: &rank, ObservedAt: &now}}}
	if err := s.SaveObservation(ctx, "uid", observed); err != nil {
		t.Fatal(err)
	}
	p, err := c.RefreshProfile(ctx, "uid")
	if err != nil || p.Outcome != domain.FaeRefreshFailed || *p.Ratings()[1611].Rank != 2 || !p.Current.ObservedAt.Equal(now) {
		t.Fatalf("failed normalization fallback = %+v, %v", p, err)
	}
	if gets.Load() != 2 {
		t.Errorf("failed pre normalization calls = %d, want2 with no showcase mutation", gets.Load())
	}
}

type cancellingTransport struct{ cancel context.CancelFunc }

func (t cancellingTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	t.cancel()
	return &http.Response{StatusCode: http.StatusTooManyRequests, Header: http.Header{"Retry-After": []string{"120"}}, Body: io.NopCloser(strings.NewReader("")), Request: r}, nil
}

func TestClientPersistsRetryAfterWhenCallerCancelsAfterHeaders(t *testing.T) {
	c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) { t.Error("unexpected fixture request") })
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.httpClient = &http.Client{Transport: cancellingTransport{cancel: cancel}}
	_, err := c.RefreshProfile(ctx, "uid")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled refresh = %v", err)
	}
	deadline, err := s.HostBackoff(context.Background())
	if err != nil || time.Until(deadline) < 119*time.Second {
		t.Fatalf("cancelled Retry-After = %v, %v", deadline, err)
	}
}

func TestClientServiceUnavailableHonorsHTTPDate(t *testing.T) {
	deadline := time.Now().Add(5 * time.Minute).UTC().Truncate(time.Second)
	c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", deadline.Format(http.TimeFormat))
		w.WriteHeader(http.StatusServiceUnavailable)
	})
	p, err := c.RefreshProfile(context.Background(), "uid")
	if err != nil || p.Outcome != domain.FaeRefreshFailed {
		t.Fatalf("503 refresh = %+v, %v", p, err)
	}
	got, err := s.HostBackoff(context.Background())
	if err != nil || !got.Equal(deadline) {
		t.Errorf("503 deadline = %v, %v, want%v", got, err, deadline)
	}
}

func TestClientBoundedDecodedCardResponse(t *testing.T) {
	c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			_, _ = w.Write([]byte(profileDocument(rankedCard)))
			return
		}
		w.Header().Set("Content-Encoding", "gzip")
		compressed := gzip.NewWriter(w)
		_, _ = compressed.Write([]byte(strings.Repeat("x", 2048)))
		_ = compressed.Close()
	})
	c.cardLimit = 1024
	p, err := c.RefreshProfile(context.Background(), "uid")
	if err != nil || p.Outcome != domain.FaeRefreshFailed || *p.Ratings()[1611].Rank != 4 {
		t.Fatalf("oversized decoded card = %+v, %v", p, err)
	}
}

func TestClientRateLimitWithoutRetryAfterUsesFallback(t *testing.T) {
	c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusTooManyRequests) })
	p, err := c.RefreshProfile(context.Background(), "uid")
	if err != nil || p.Outcome != domain.FaeRefreshBackoff {
		t.Fatalf("429 fallback = %+v, %v", p, err)
	}
	deadline, err := s.HostBackoff(context.Background())
	if err != nil || time.Until(deadline) < 59*time.Second {
		t.Errorf("fallback deadline = %v, %v", deadline, err)
	}
}
