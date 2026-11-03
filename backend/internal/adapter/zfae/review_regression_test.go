package zfae

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestClientRejectsIncompleteProfileCards(t *testing.T) {
	for name, body := range map[string]string{
		"missing rank":          profileDocument(strings.Replace(rankedCard, ` data-rank="4"`, "", 1)),
		"invalid rank":          profileDocument(strings.Replace(rankedCard, `data-rank="4"`, `data-rank="bad"`, 1)),
		"negative rank":         profileDocument(strings.Replace(rankedCard, `data-rank="4"`, `data-rank="-1"`, 1)),
		"truncated opening":     `<div class="agent-card" data-agent-slug="claret"`,
		"truncated ranked card": strings.TrimSuffix(rankedCard, "</div>"),
	} {
		t.Run(name, func(t *testing.T) {
			var gets int
			c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodGet {
					return
				}
				gets++
				response := profileDocument(rankedCard)
				if gets == 2 {
					response = body
				}
				_, _ = w.Write([]byte(response))
			})
			p, err := c.RefreshProfile(context.Background(), "uid")
			if err != nil || p.Outcome != domain.FaeRefreshFailed || p.Ratings()[1611] == nil || p.Ratings()[1611].Rank == nil || *p.Ratings()[1611].Rank != 4 {
				t.Fatalf("RefreshProfile(%q) = %+v, %v, want failed with previous rank 4", name, p, err)
			}
		})
	}
}

func selectedCard(leaderboardID int) string {
	return strings.Replace(rankedCard, "</div>", fmt.Sprintf(`<li class="active"><span onclick="switchLeaderboard(this, 5511555, %d)">Bracket</span></li></div>`, leaderboardID), 1)
}

func TestClientRequiresExplicitDefaultSwitchResult(t *testing.T) {
	for name, body := range map[string]string{
		"absent selection":      rankedCard,
		"missing rank":          strings.Replace(selectedCard(0), ` data-rank="4"`, "", 1),
		"truncated opening":     `<div class="agent-card" data-agent-slug="claret" data-assessment-id="5511555"`,
		"truncated ranked card": strings.TrimSuffix(selectedCard(0), "</div>"),
		"other bracket":         selectedCard(-1),
		"partial extra card":    selectedCard(0) + `<div class="agent-card" data-agent-slug="claret"`,
	} {
		t.Run(name, func(t *testing.T) {
			var requests atomic.Int32
			c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
				n := requests.Add(1)
				response := rankedCard
				if n == 3 {
					response = selectedCard(4)
				}
				if n == 4 {
					response = body
				}
				if r.Method == http.MethodGet {
					response = profileDocument(response)
				}
				_, _ = w.Write([]byte(response))
			})
			p, err := c.RefreshProfile(context.Background(), "uid")
			if err != nil || p.Outcome != domain.FaeRefreshFailed || p.Ratings()[1611] == nil || p.Ratings()[1611].Rank == nil || *p.Ratings()[1611].Rank != 4 || requests.Load() != 4 {
				t.Fatalf("RefreshProfile(%q switch) = %+v, %v, requests %d, want failed with previous rank 4 after 4 requests", name, p, err, requests.Load())
			}
		})
	}
}

func TestClientNormalizesAnyWeaponBracket(t *testing.T) {
	var requests atomic.Int32
	c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		body := selectedCard(0)
		if r.Method == http.MethodGet {
			body = profileDocument(selectedCard(-1))
		}
		_, _ = w.Write([]byte(body))
	})
	p, err := c.RefreshProfile(context.Background(), "uid")
	if err != nil || p.Outcome != domain.FaeRefreshUpdated || requests.Load() != 5 {
		t.Fatalf("RefreshProfile(any weapon) = %+v, %v, requests %d, want updated after 5 requests", p, err, requests.Load())
	}
}

func TestClientPreservesUnassessedObservation(t *testing.T) {
	body, err := os.ReadFile("testdata/unranked_card.html")
	if err != nil {
		t.Fatal(err)
	}
	c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(profileDocument(string(body))))
	})
	p, err := c.RefreshProfile(context.Background(), "uid")
	if err != nil {
		t.Fatal(err)
	}
	rating := p.Ratings()[1261]
	if p.Outcome != domain.FaeRefreshUpdated || rating == nil || rating.Status != domain.FaeStatusUnassessed || rating.Rank != nil || rating.ObservedAt == nil || !rating.ObservedAt.Equal(p.Current.ObservedAt) {
		t.Fatalf("RefreshProfile(unassessed) = %+v, rating %+v, want dated unassessed", p, rating)
	}
	saved, err := s.ReadProfile(context.Background(), "uid")
	if err != nil || saved.Ratings()[1261].Status != domain.FaeStatusUnassessed {
		t.Fatalf("ReadProfile(unassessed) = %+v, %v, want persisted unassessed", saved, err)
	}
}

func TestClientBodyReadFailureSetsSharedBackoff(t *testing.T) {
	for _, step := range []int32{1, 2, 3, 4} {
		t.Run(strconv.Itoa(int(step)), func(t *testing.T) {
			var requests atomic.Int32
			c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) {
				n := requests.Add(1)
				if n == step {
					w.Header().Set("Content-Length", "1000")
					_, _ = w.Write([]byte("incomplete"))
					return
				}
				body := rankedCard
				if step == 4 && n == 3 {
					body = selectedCard(4)
				}
				if r.Method == http.MethodGet {
					body = profileDocument(body)
				}
				_, _ = w.Write([]byte(body))
			})
			ctx := context.Background()
			observed := time.Now().Add(-time.Hour).UTC()
			if _, err := s.ReserveRefresh(ctx, "uid", observed, time.Minute, 1000); err != nil {
				t.Fatal(err)
			}
			rank := 2
			if err := s.SaveObservation(ctx, "uid", domain.FaeObservation{ObservedAt: observed, Agents: map[int]*domain.FaeRating{1611: {Rank: &rank, ObservedAt: &observed}}}); err != nil {
				t.Fatal(err)
			}
			p, err := c.RefreshProfile(ctx, "uid")
			if err != nil || p.Outcome != domain.FaeRefreshFailed || p.Current == nil {
				t.Fatalf("RefreshProfile(body failure %d) = %+v, %v", step, p, err)
			}
			if step == 1 && (*p.Ratings()[1611].Rank != 2 || !p.Current.ObservedAt.Equal(observed)) {
				t.Errorf("body failure replaced previous observation = %+v", p.Current)
			}
			if step > 1 && *p.Ratings()[1611].Rank != 4 {
				t.Errorf("body failure lost pre-refresh rank = %+v", p.Current)
			}
			deadline, err := s.HostBackoff(ctx)
			if err != nil || time.Until(deadline) < 9*time.Second {
				t.Errorf("HostBackoff(body failure) = %v, %v, want short shared backoff", deadline, err)
			}
			other := NewClient(s, WithBaseURL(c.baseURL))
			blocked, err := other.RefreshProfile(ctx, "other")
			if err != nil || blocked.Outcome != domain.FaeRefreshBackoff || requests.Load() != step {
				t.Errorf("RefreshProfile(other after body failure) = %+v, %v, requests %d, want backoff and %d", blocked, err, requests.Load(), step)
			}
		})
	}
}

func TestClientCapacityRefusalIncludesRetryDeadline(t *testing.T) {
	var requests atomic.Int32
	c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) { requests.Add(1) })
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Millisecond)
	for i := range 1000 {
		if _, err := s.ReserveRefresh(ctx, strconv.Itoa(i), now, time.Hour+time.Duration(i)*time.Second, 1000); err != nil {
			t.Fatal(err)
		}
	}
	p, err := c.RefreshProfile(ctx, "new")
	if err != nil || p.Outcome != domain.FaeRefreshCapacity || p.RefreshAvailableAt == nil || !p.RefreshAvailableAt.Equal(now.Add(time.Hour)) || requests.Load() != 0 {
		t.Fatalf("RefreshProfile(full store) = %+v, %v, requests %d, want capacity until %v and no requests", p, err, requests.Load(), now.Add(time.Hour))
	}
}

func TestClientBodyReadFailureBackoffPersistenceFailsClosed(t *testing.T) {
	ctx := context.Background()
	db, err := sqlite.NewDB(filepath.Join(t.TempDir(), "fae.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := sqlite.Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `CREATE TRIGGER reject_backoff BEFORE UPDATE ON fae_host_policy BEGIN SELECT RAISE(FAIL, 'policy unavailable'); END`); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Length", "1000")
		_, _ = w.Write([]byte("incomplete"))
	}))
	t.Cleanup(server.Close)
	c := NewClient(sqlite.NewFaeStore(db), WithBaseURL(server.URL))
	c.pacing = 0
	p, err := c.RefreshProfile(ctx, "uid")
	if err == nil || p != nil || errors.Is(err, domain.ErrSourceUnavailable) {
		t.Fatalf("RefreshProfile(body error, failed policy write) = %+v, %v, want persistence error", p, err)
	}
}

type bodyCancellingTransport struct{ cancel context.CancelFunc }

func (t bodyCancellingTransport) RoundTrip(r *http.Request) (*http.Response, error) {
	return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header), Body: cancellingBody(t), Request: r}, nil
}

type cancellingBody struct{ cancel context.CancelFunc }

func (b cancellingBody) Read([]byte) (int, error) {
	b.cancel()
	return 0, io.ErrUnexpectedEOF
}

func (cancellingBody) Close() error { return nil }

func TestClientCancelledBodyReadDoesNotPenalizeHost(t *testing.T) {
	c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) { t.Error("unexpected fixture request") })
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	c.httpClient = &http.Client{Transport: bodyCancellingTransport{cancel: cancel}}
	p, err := c.RefreshProfile(ctx, "uid")
	if p != nil || !errors.Is(err, context.Canceled) {
		t.Fatalf("RefreshProfile(cancelled body) = %+v, %v, want context.Canceled", p, err)
	}
	deadline, err := s.HostBackoff(context.Background())
	if err != nil || !deadline.IsZero() {
		t.Errorf("HostBackoff(cancelled body) = %v, %v, want no penalty", deadline, err)
	}
}

func TestClientCapacityResultUsesNewerHostDeadline(t *testing.T) {
	c, s := testClient(t, func(w http.ResponseWriter, r *http.Request) { t.Error("capacity result contacted upstream") })
	ctx := context.Background()
	capacityDeadline := time.Now().Add(time.Hour).UTC().Truncate(time.Millisecond)
	hostDeadline := capacityDeadline.Add(time.Hour)
	if err := s.ExtendHostBackoff(ctx, hostDeadline); err != nil {
		t.Fatal(err)
	}
	p, err := c.result(ctx, "new", domain.FaeRefreshAdmission{Outcome: domain.FaeRefreshCapacity, AvailableAt: capacityDeadline})
	if err != nil || p.Outcome != domain.FaeRefreshCapacity || p.RefreshAvailableAt == nil || !p.RefreshAvailableAt.Equal(hostDeadline) {
		t.Fatalf("capacity result after newer host backoff = %+v, %v, want retry at %v", p, err, hostDeadline)
	}
}

func profileDocument(cards string) string {
	return `<!DOCTYPE html><html lang="en"><head><title>Profile</title></head><body>` + cards + `</body></html>`
}

func TestClientRejectsIncompleteProfileDocument(t *testing.T) {
	secondCard := strings.Replace(rankedCard, `data-agent-slug="claret"`, `data-agent-slug="anby"`, 1)
	complete := profileDocument(rankedCard + secondCard)
	changed := strings.Replace(complete, `data-rank="4"`, `data-rank="8"`, 1)
	for name, body := range map[string]string{
		"missing document end":      strings.TrimSuffix(changed, `</body></html>`),
		"between complete cards":    changed[:reCardStart.FindAllStringIndex(changed, 2)[1][0]],
		"standalone complete cards": rankedCard + secondCard,
	} {
		for _, phase := range []string{"pre", "post"} {
			t.Run(name+"/"+phase, func(t *testing.T) {
				ctx := context.Background()
				var requests, gets int
				c, store := testClient(t, func(w http.ResponseWriter, r *http.Request) {
					requests++
					if r.Method != http.MethodGet {
						return
					}
					gets++
					response := complete
					if phase == "pre" || gets == 2 {
						response = body
					}
					_, _ = w.Write([]byte(response))
				})
				observed := time.Now().Add(-time.Hour).UTC()
				if _, err := store.ReserveRefresh(ctx, "uid", observed, time.Minute, 1000); err != nil {
					t.Fatal(err)
				}
				rank := 2
				if err := store.SaveObservation(ctx, "uid", domain.FaeObservation{ObservedAt: observed, Agents: map[int]*domain.FaeRating{1611: {Rank: &rank, ObservedAt: &observed}}}); err != nil {
					t.Fatal(err)
				}
				p, err := c.RefreshProfile(ctx, "uid")
				wantRank, wantCount, wantRequests := 2, 1, 1
				if phase == "post" {
					wantRank, wantCount, wantRequests = 4, 2, 3
				}
				if err != nil {
					t.Fatal(err)
				}
				rating := p.Ratings()[1611]
				if p.Outcome != domain.FaeRefreshFailed || rating == nil || rating.Rank == nil || *rating.Rank != wantRank || len(p.Ratings()) != wantCount || requests != wantRequests {
					t.Fatalf("incomplete %s document = outcome %s, rating %+v, agents %d, requests %d; want failed, rank %d, agents %d, requests %d", phase, p.Outcome, rating, len(p.Ratings()), requests, wantRank, wantCount, wantRequests)
				}
				if phase == "pre" && !p.Current.ObservedAt.Equal(observed) {
					t.Errorf("rejected pre document changed observed_at from %v to %v", observed, p.Current.ObservedAt)
				}
			})
		}
	}
}
