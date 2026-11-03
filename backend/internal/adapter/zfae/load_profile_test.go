package zfae

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestLoadProfileExistingUsesOneGET(t *testing.T) {
	var methods []string
	c, store := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		methods = append(methods, r.Method)
		_, _ = w.Write([]byte(profileDocument(rankedCard)))
	})
	p, err := c.LoadProfile(context.Background(), "uid")
	if err != nil || p.Current == nil || p.Ratings()[1611] == nil {
		t.Fatalf("LoadProfile(existing) = %+v, %v, want observed rank", p, err)
	}
	if !reflect.DeepEqual(methods, []string{http.MethodGet}) {
		t.Errorf("LoadProfile(existing) methods = %v, want [GET]", methods)
	}
	saved, err := store.ReadProfile(context.Background(), "uid")
	if err != nil || saved.Current == nil || !saved.Current.ObservedAt.Equal(p.Current.ObservedAt) {
		t.Errorf("ReadProfile(after load) = %+v, %v, want saved observation", saved, err)
	}
}

func TestLoadProfileMissingBootstrapsOnce(t *testing.T) {
	var calls []string
	c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.Method)
		if len(calls) == 1 {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.Method == http.MethodPost {
			if err := r.ParseForm(); err != nil || r.Form.Get("task") != "fetchShowcase" || r.Form.Get("userUid") != "uid" {
				t.Errorf("bootstrap form = %v, %v, want fetchShowcase for uid", r.Form, err)
			}
			return
		}
		_, _ = w.Write([]byte(profileDocument(rankedCard)))
	})
	p, err := c.LoadProfile(context.Background(), "uid")
	if err != nil || p.Current == nil || p.Ratings()[1611] == nil {
		t.Fatalf("LoadProfile(missing) = %+v, %v, want observed rank", p, err)
	}
	if !reflect.DeepEqual(calls, []string{http.MethodGet, http.MethodPost, http.MethodGet}) {
		t.Errorf("LoadProfile(missing) calls = %v, want [GET POST GET]", calls)
	}
}

func TestLoadProfileNormalizesExistingWithoutFetchShowcase(t *testing.T) {
	var calls []string
	c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			calls = append(calls, r.Method)
			_, _ = w.Write([]byte(profileDocument(selectedCard(4))))
			return
		}
		if err := r.ParseForm(); err != nil {
			t.Error(err)
		}
		calls = append(calls, r.Form.Get("task"))
		if r.Form.Get("leaderboardId") != "0" {
			t.Errorf("normalization leaderboardId = %q, want 0", r.Form.Get("leaderboardId"))
		}
		_, _ = w.Write([]byte(selectedCard(0)))
	})
	p, err := c.LoadProfile(context.Background(), "uid")
	if err != nil || p.Current == nil || p.Ratings()[1611] == nil || *p.Ratings()[1611].Rank != 4 {
		t.Fatalf("LoadProfile(selected bracket) = %+v, %v, want normalized rank 4", p, err)
	}
	if !reflect.DeepEqual(calls, []string{http.MethodGet, "switchLeaderboard"}) {
		t.Errorf("LoadProfile(selected bracket) calls = %v, want [GET switchLeaderboard]", calls)
	}
}

func TestLoadProfileStoredObservationsSurviveRestart(t *testing.T) {
	for _, empty := range []bool{false, true} {
		t.Run(map[bool]string{false: "ranked", true: "empty"}[empty], func(t *testing.T) {
			var requests atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { requests.Add(1) }))
			t.Cleanup(server.Close)
			path := filepath.Join(t.TempDir(), "fae.db")
			db, err := sqlite.NewDB(path)
			if err != nil {
				t.Fatal(err)
			}
			if err := sqlite.Migrate(context.Background(), db); err != nil {
				t.Fatal(err)
			}
			store := sqlite.NewFaeStore(db)
			observed := time.Now().Add(-48 * time.Hour).UTC().Truncate(time.Millisecond)
			if _, err := store.ReserveRefresh(context.Background(), "uid", observed, time.Minute, 1000); err != nil {
				t.Fatal(err)
			}
			agents := make(map[int]*domain.FaeRating)
			if !empty {
				rank := 4
				agents[1611] = &domain.FaeRating{Rank: &rank, ObservedAt: &observed}
			}
			if err := store.SaveObservation(context.Background(), "uid", domain.FaeObservation{ObservedAt: observed, Agents: agents}); err != nil {
				t.Fatal(err)
			}
			assertStored := func(c *Client) {
				t.Helper()
				for range 2 {
					p, err := c.LoadProfile(context.Background(), "uid")
					if err != nil || p.Current == nil || !p.Current.ObservedAt.Equal(observed) || len(p.Ratings()) != len(agents) || p.Outcome != domain.FaeRefreshSaved {
						t.Fatalf("LoadProfile(stale stored) = %+v, %v, want original observation %v", p, err, observed)
					}
				}
			}
			assertStored(NewClient(store, WithBaseURL(server.URL)))
			if err := db.Close(); err != nil {
				t.Fatal(err)
			}
			db, err = sqlite.NewDB(path)
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = db.Close() })
			assertStored(NewClient(sqlite.NewFaeStore(db), WithBaseURL(server.URL)))
			if requests.Load() != 0 {
				t.Errorf("LoadProfile(stored and restarted) requests = %d, want 0", requests.Load())
			}
		})
	}
}

func TestLoadProfileConcurrentClientsShareColdFetch(t *testing.T) {
	var requests atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	c, store := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if requests.Add(1) == 1 {
			close(started)
			<-release
		}
		_, _ = w.Write([]byte(profileDocument(rankedCard)))
	})
	reads := make(chan struct{}, 9)
	shared := loadReadStore{FaeStore: store, reads: reads}
	c.store = shared
	other := NewClient(shared, WithBaseURL(c.baseURL))
	other.pacing = 0
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var wg sync.WaitGroup
	for i := range 8 {
		wg.Go(func() {
			client := c
			if i%2 == 1 {
				client = other
			}
			p, err := client.LoadProfile(ctx, "uid")
			if err != nil || p.Current == nil || p.Ratings()[1611] == nil || p.Outcome == domain.FaeRefreshCooldown {
				t.Errorf("LoadProfile(concurrent) = %+v, %v, want observation without duplicate admission", p, err)
			}
		})
	}
	select {
	case <-started:
	case <-ctx.Done():
		t.Error("LoadProfile(concurrent) did not start HTTP request")
	}
	for range 9 {
		select {
		case <-reads:
		case <-ctx.Done():
			t.Error("LoadProfile(concurrent) callers did not all observe the cold cache")
		}
	}
	close(release)
	wg.Wait()
	if requests.Load() != 1 {
		t.Errorf("LoadProfile(concurrent) requests = %d, want 1", requests.Load())
	}
}

func TestLoadProfileAdmittedColdFetchSurvivesCallerCancellation(t *testing.T) {
	var requests atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	var releaseOnce sync.Once
	c, store := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		if requests.Add(1) == 1 {
			close(started)
			<-release
		}
		_, _ = w.Write([]byte(profileDocument(rankedCard)))
	})
	t.Cleanup(func() { releaseOnce.Do(func() { close(release) }) })
	reads := make(chan struct{}, 3)
	c.store = loadReadStore{FaeStore: store, reads: reads}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	waitCtx, stopWaiting := context.WithTimeout(context.Background(), 5*time.Second)
	defer stopWaiting()
	type result struct {
		profile *domain.FaeProfile
		err     error
	}
	first := make(chan result, 1)
	follower := make(chan result, 1)
	go func() {
		p, err := c.LoadProfile(ctx, "uid")
		first <- result{p, err}
	}()
	select {
	case <-started:
	case <-waitCtx.Done():
		t.Fatal("LoadProfile(cold) did not start upstream request")
	}
	for range 2 {
		<-reads
	}
	go func() {
		p, err := c.LoadProfile(waitCtx, "uid")
		follower <- result{p, err}
	}()
	select {
	case <-reads:
	case <-waitCtx.Done():
		t.Fatal("LoadProfile(follower) did not observe the cold cache")
	}
	cancel()
	releaseOnce.Do(func() { close(release) })
	for name, done := range map[string]<-chan result{"cancelled caller": first, "follower": follower} {
		select {
		case got := <-done:
			if got.err != nil || got.profile == nil || got.profile.Current == nil || got.profile.Ratings()[1611] == nil || got.profile.Outcome == domain.FaeRefreshCooldown {
				t.Errorf("LoadProfile(%s) = %+v, %v, want saved observation", name, got.profile, got.err)
			}
		case <-waitCtx.Done():
			t.Fatalf("LoadProfile(%s) did not finish", name)
		}
	}
	saved, err := store.ReadProfile(context.Background(), "uid")
	if err != nil || saved.Current == nil || saved.Ratings()[1611] == nil {
		t.Errorf("ReadProfile(after caller cancellation) = %+v, %v, want durable observation", saved, err)
	}
	if requests.Load() != 1 {
		t.Errorf("LoadProfile(cancelled caller and follower) requests = %d, want 1", requests.Load())
	}
}

type loadReadStore struct {
	domain.FaeStore
	reads chan<- struct{}
}

func (s loadReadStore) ReadProfile(ctx context.Context, uid string) (*domain.FaeProfile, error) {
	p, err := s.FaeStore.ReadProfile(ctx, uid)
	if err == nil && p.Current == nil {
		select {
		case s.reads <- struct{}{}:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	return p, err
}

func TestLoadProfileNegativeResultsSuppressFurtherRequests(t *testing.T) {
	for _, status := range []int{http.StatusInternalServerError, http.StatusTooManyRequests, http.StatusNotFound} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			var requests atomic.Int32
			c, store := testClient(t, func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				if r.Method == http.MethodPost {
					return
				}
				w.Header().Set("Retry-After", "3600")
				w.WriteHeader(status)
			})
			p, err := c.LoadProfile(context.Background(), "uid")
			if err != nil || p.RefreshAvailableAt == nil {
				t.Fatalf("LoadProfile(%d) = %+v, %v, want persisted retry deadline", status, p, err)
			}
			wantOutcome := domain.FaeRefreshFailed
			if status == http.StatusTooManyRequests {
				wantOutcome = domain.FaeRefreshBackoff
			}
			if status == http.StatusNotFound {
				wantOutcome = domain.FaeRefreshUpdated
			}
			if p.Outcome != wantOutcome {
				t.Errorf("LoadProfile(%d) outcome = %s, want %s", status, p.Outcome, wantOutcome)
			}
			wantCalls := int32(1)
			if status == http.StatusNotFound {
				wantCalls = 3
				if p.Current == nil || len(p.Ratings()) != 0 {
					t.Errorf("LoadProfile(not created) = %+v, want observed empty profile", p)
				}
			} else if p.Current != nil {
				t.Errorf("LoadProfile(%d) current = %+v, want nil", status, p.Current)
			}
			deadline := *p.RefreshAvailableAt
			restarted := NewClient(store, WithBaseURL(c.baseURL))
			for range 2 {
				p, err = restarted.LoadProfile(context.Background(), "uid")
				if err != nil || p.RefreshAvailableAt == nil || !p.RefreshAvailableAt.Equal(deadline) {
					t.Fatalf("LoadProfile(negative hit %d) = %+v, %v, want original deadline %v", status, p, err, deadline)
				}
			}
			if requests.Load() != wantCalls {
				t.Errorf("LoadProfile(%d repeated) requests = %d, want %d", status, requests.Load(), wantCalls)
			}
			if status == http.StatusTooManyRequests {
				other, err := restarted.LoadProfile(context.Background(), "other")
				if err != nil || other.Current != nil || other.RefreshAvailableAt == nil || !other.RefreshAvailableAt.Equal(deadline) || requests.Load() != wantCalls {
					t.Errorf("LoadProfile(other during host backoff) = %+v, %v, requests %d, want original host deadline and no request", other, err, requests.Load())
				}
			}
		})
	}
}

func TestLoadProfileRejectsInvalidDocumentsAndSizes(t *testing.T) {
	for name, body := range map[string]string{
		"incomplete": strings.TrimSuffix(profileDocument(rankedCard), "</body></html>"),
		"oversized":  strings.Repeat("x", 1025),
	} {
		t.Run(name, func(t *testing.T) {
			var requests atomic.Int32
			c, _ := testClient(t, func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				_, _ = w.Write([]byte(body))
			})
			c.profileLimit = 1024
			p, err := c.LoadProfile(context.Background(), "uid")
			if err != nil || p.Current != nil || p.Outcome != domain.FaeRefreshFailed {
				t.Fatalf("LoadProfile(%s) = %+v, %v, want failed without observation", name, p, err)
			}
			if _, err := c.LoadProfile(context.Background(), "uid"); err != nil || requests.Load() != 1 {
				t.Errorf("LoadProfile(%s repeated) = %v, requests %d, want nil and 1", name, err, requests.Load())
			}
		})
	}
}

func TestLoadProfileCancellationWhilePipelineBusy(t *testing.T) {
	c, store := testClient(t, func(w http.ResponseWriter, r *http.Request) { t.Error("cancelled load contacted upstream") })
	pipeline <- struct{}{}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, err := c.LoadProfile(ctx, "uid")
	<-pipeline
	if !errors.Is(err, context.DeadlineExceeded) {
		t.Errorf("LoadProfile(blocked pipeline) error = %v, want deadline exceeded", err)
	}
	p, err := store.ReadProfile(context.Background(), "uid")
	if err != nil || p.RefreshAvailableAt != nil {
		t.Errorf("ReadProfile(cancelled load) = %+v, %v, want no admission", p, err)
	}
}

func TestLoadProfileAlreadyCancelledDoesNotReserveRefresh(t *testing.T) {
	var requests atomic.Int32
	c, store := testClient(t, func(w http.ResponseWriter, r *http.Request) { requests.Add(1) })
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := c.LoadProfile(ctx, "uid"); !errors.Is(err, context.Canceled) {
		t.Errorf("LoadProfile(already cancelled) error = %v, want context.Canceled", err)
	}
	p, err := store.ReadProfile(context.Background(), "uid")
	if err != nil || p.RefreshAvailableAt != nil {
		t.Errorf("ReadProfile(already cancelled load) = %+v, %v, want no admission", p, err)
	}
	if requests.Load() != 0 {
		t.Errorf("LoadProfile(already cancelled) requests = %d, want 0", requests.Load())
	}
}

func TestLoadProfilePolicyPersistenceFailsClosed(t *testing.T) {
	for name, statement := range map[string]string{
		"read":      `DROP TABLE fae_host_policy`,
		"admission": `CREATE TRIGGER reject_admission BEFORE INSERT ON fae_profiles BEGIN SELECT RAISE(FAIL, 'policy unavailable'); END`,
		"backoff":   `CREATE TRIGGER reject_backoff BEFORE UPDATE ON fae_host_policy BEGIN SELECT RAISE(FAIL, 'policy unavailable'); END`,
	} {
		t.Run(name, func(t *testing.T) {
			db, err := sqlite.NewDB(filepath.Join(t.TempDir(), "fae.db"))
			if err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { _ = db.Close() })
			ctx := context.Background()
			if err := sqlite.Migrate(ctx, db); err != nil {
				t.Fatal(err)
			}
			if _, err := db.ExecContext(ctx, statement); err != nil {
				t.Fatal(err)
			}
			var requests atomic.Int32
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				requests.Add(1)
				w.WriteHeader(http.StatusTooManyRequests)
			}))
			t.Cleanup(server.Close)
			c := NewClient(sqlite.NewFaeStore(db), WithBaseURL(server.URL))
			c.pacing = 0
			p, err := c.LoadProfile(ctx, "uid")
			if err == nil || p != nil || errors.Is(err, domain.ErrRateLimited) {
				t.Errorf("LoadProfile(%s policy failure) = %+v, %v, want persistence error", name, p, err)
			}
			wantRequests := int32(0)
			if name == "backoff" {
				wantRequests = 1
			}
			if requests.Load() != wantRequests {
				t.Errorf("LoadProfile(%s policy failure) requests = %d, want %d", name, requests.Load(), wantRequests)
			}
		})
	}
}
