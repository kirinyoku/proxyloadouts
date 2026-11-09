package sqlite

import (
	"context"
	"path/filepath"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestFaeStoreDurabilityAndAdmission(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "fae.db")
	db, err := NewDB(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	store := NewFaeStore(db)
	now := time.Now().UTC().Truncate(time.Millisecond)
	p, err := store.ReadProfile(ctx, "cold")
	if err != nil || p.Current != nil || p.RefreshAvailableAt != nil {
		t.Fatalf("cold read = %+v, %v", p, err)
	}
	var admitted atomic.Int32
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			out, err := store.ReserveRefresh(ctx, "uid", now, 20*time.Minute, 1000)
			if err != nil {
				t.Error(err)
			}
			if out.Outcome == domain.FaeRefreshUpdated {
				admitted.Add(1)
			}
		})
	}
	wg.Wait()
	if admitted.Load() != 1 {
		t.Errorf("admissions = %d, want 1", admitted.Load())
	}
	for i := range 5 {
		rank := i + 1
		observed := now.Add(time.Duration(i) * time.Second)
		o := domain.FaeObservation{ObservedAt: observed, Agents: map[int]*domain.FaeRating{1011: {Rank: &rank, ObservedAt: &observed}}}
		if err := store.SaveObservation(ctx, "uid", o); err != nil {
			t.Fatal(err)
		}
	}
	if err := store.ExtendHostBackoff(ctx, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := store.ExtendHostBackoff(ctx, now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	db, err = NewDB(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	store = NewFaeStore(db)
	p, err = store.ReadProfile(ctx, "uid")
	if err != nil {
		t.Fatal(err)
	}
	if len(p.History) != 2 || *p.Current.Agents[1011].Rank != 5 || !p.Current.ObservedAt.Equal(now.Add(4*time.Second)) {
		t.Fatalf("reopened profile = %+v", p)
	}
	if !p.RefreshAvailableAt.Equal(now.Add(time.Hour)) {
		t.Errorf("deadline = %v, want host deadline", p.RefreshAvailableAt)
	}
	out, err := store.ReserveRefresh(ctx, "other", now, 20*time.Minute, 1000)
	if err != nil || out.Outcome != domain.FaeRefreshBackoff {
		t.Fatalf("host refusal = %+v, %v", out, err)
	}
}

func TestFaeStoreRetentionAndEmpty(t *testing.T) {
	ctx := context.Background()
	db, err := NewDB(filepath.Join(t.TempDir(), "fae.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := Migrate(ctx, db); err != nil {
		t.Fatal(err)
	}
	s := NewFaeStore(db)
	now := time.Now().UTC()
	for i := range 3 {
		out, err := s.ReserveRefresh(ctx, strconv.Itoa(i), now, time.Minute, 2)
		if err != nil {
			t.Fatal(err)
		}
		if i == 2 && out.Outcome != domain.FaeRefreshCapacity {
			t.Fatalf("protected capacity = %+v", out)
		}
	}
	out, err := s.ReserveRefresh(ctx, "empty", now.Add(2*time.Minute), time.Minute, 2)
	if err != nil || out.Outcome != domain.FaeRefreshUpdated {
		t.Fatalf("expired eviction = %+v, %v", out, err)
	}
	if err := s.SaveObservation(ctx, "empty", domain.FaeObservation{ObservedAt: now, Agents: map[int]*domain.FaeRating{}}); err != nil {
		t.Fatal(err)
	}
	p, err := s.ReadProfile(ctx, "empty")
	if err != nil || p.Current == nil || len(p.Ratings()) != 0 {
		t.Fatalf("observed empty = %+v, %v", p, err)
	}
	p, err = s.ReadProfile(ctx, "0")
	if err != nil || p.Current != nil {
		t.Fatalf("evicted = %+v, %v", p, err)
	}
}

func TestFaeStoreAdmissionDeadlines(t *testing.T) {
	ctx := context.Background()
	s := NewFaeStore(newMigratedTestDB(t))
	now := time.Now().UTC().Truncate(time.Millisecond)
	for uid, interval := range map[string]time.Duration{"later": time.Hour, "earlier": time.Minute} {
		got, err := s.ReserveRefresh(ctx, uid, now, interval, 2)
		if err != nil || got.Outcome != domain.FaeRefreshUpdated || !got.AvailableAt.Equal(now.Add(interval)) {
			t.Fatalf("ReserveRefresh(%q) = %+v, %v, want updated until %v", uid, got, err, now.Add(interval))
		}
	}
	got, err := s.ReserveRefresh(ctx, "earlier", now, time.Hour, 2)
	if err != nil || got.Outcome != domain.FaeRefreshCooldown || !got.AvailableAt.Equal(now.Add(time.Minute)) {
		t.Errorf("ReserveRefresh(cooldown) = %+v, %v, want original deadline", got, err)
	}
	got, err = s.ReserveRefresh(ctx, "new", now, time.Hour, 2)
	if err != nil || got.Outcome != domain.FaeRefreshCapacity || !got.AvailableAt.Equal(now.Add(time.Minute)) {
		t.Errorf("ReserveRefresh(capacity) = %+v, %v, want earliest protected expiry", got, err)
	}
	host := now.Add(2 * time.Hour)
	if err := s.ExtendHostBackoff(ctx, host); err != nil {
		t.Fatal(err)
	}
	got, err = s.ReserveRefresh(ctx, "new", now, time.Hour, 2)
	if err != nil || got.Outcome != domain.FaeRefreshBackoff || !got.AvailableAt.Equal(host) {
		t.Errorf("ReserveRefresh(host backoff) = %+v, %v, want host deadline", got, err)
	}
}
