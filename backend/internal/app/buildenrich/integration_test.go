package buildenrich_test

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	fairy "github.com/kirinyoku/fairy"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/inmemory"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildenrich"
)

// countingEnricher stands in for the real fairy client. The real one walks the
// bundled game catalog for the agent, its skills, its W-Engine and every Drive
// Disc; sleeping here stands in for that per-build cost.
type countingEnricher struct {
	calls atomic.Int64
	delay time.Duration
}

func (c *countingEnricher) EnrichAgent(raw *zzz.AvatarData, lang fairy.Language) (*fairy.Agent, error) {
	c.calls.Add(1)
	time.Sleep(c.delay)
	name := "Агент RU"
	if lang == fairy.LangEN {
		name = "Agent EN"
	}
	return &fairy.Agent{ID: raw.ID, Name: name}, nil
}

// TestEnrichmentIsMemoizedAcrossRequests measures the actual effect of the
// production wiring: the first pass over N builds pays enrichment, every
// subsequent pass is served from the singleflight cache.
func TestEnrichmentIsMemoizedAcrossRequests(t *testing.T) {
	const (
		builds   = 45 // a maxed-out account: 15 teams x 3 members
		perBuild = 2 * time.Millisecond
	)

	enricher := &countingEnricher{delay: perBuild}
	store := inmemory.NewSingleflightService[buildenrich.Localized](2000, time.Minute)
	t.Cleanup(store.Close)

	svc := buildenrich.New(enricher, func(
		ctx context.Context,
		key string,
		compute func(context.Context) (buildenrich.Localized, time.Duration, error),
	) (buildenrich.Localized, error) {
		return inmemory.GetOrFetchValue(ctx, store, key, 15*time.Minute, compute)
	}, 15*time.Minute)

	raws := make([]json.RawMessage, builds)
	for i := range raws {
		data, err := json.Marshal(zzz.AvatarData{ID: 1000 + i})
		if err != nil {
			t.Fatalf("marshal raw avatar %d: %v", i, err)
		}
		raws[i] = data
	}

	pass := func(lang fairy.Language) time.Duration {
		start := time.Now()
		for _, raw := range raws {
			if _, ok := svc.Localize(context.Background(), raw, lang); !ok {
				t.Fatalf("expected Localize to succeed for lang %s", lang)
			}
		}
		return time.Since(start)
	}

	cold := pass(fairy.LangRU)
	callsAfterCold := enricher.calls.Load()

	warm := pass(fairy.LangRU)
	callsAfterWarm := enricher.calls.Load()

	if callsAfterCold != builds {
		t.Errorf("cold pass: expected %d enrichments, got %d", builds, callsAfterCold)
	}
	if callsAfterWarm != builds {
		t.Errorf("warm pass: expected 0 additional enrichments, got %d", callsAfterWarm-callsAfterCold)
	}

	// A different language is a different key and must be enriched on demand.
	pass(fairy.LangEN)
	if got := enricher.calls.Load(); got != 2*builds {
		t.Errorf("after switching language: expected %d total enrichments, got %d", 2*builds, got)
	}

	// Back to the first language: still fully cached.
	pass(fairy.LangRU)
	if got := enricher.calls.Load(); got != 2*builds {
		t.Errorf("expected no re-enrichment when returning to a cached language, got %d", got)
	}

	fmt.Printf("builds=%d cold=%v warm=%v speedup=%.1fx\n", builds, cold, warm,
		float64(cold)/float64(max(warm, time.Nanosecond)))
}

// TestConcurrentRequestsShareOneEnrichment covers the singleflight guarantee
// across parallel HTTP requests for the same build.
func TestConcurrentRequestsShareOneEnrichment(t *testing.T) {
	enricher := &countingEnricher{delay: 5 * time.Millisecond}
	store := inmemory.NewSingleflightService[buildenrich.Localized](2000, time.Minute)
	t.Cleanup(store.Close)

	svc := buildenrich.New(enricher, func(
		ctx context.Context,
		key string,
		compute func(context.Context) (buildenrich.Localized, time.Duration, error),
	) (buildenrich.Localized, error) {
		return inmemory.GetOrFetchValue(ctx, store, key, 15*time.Minute, compute)
	}, 15*time.Minute)

	raw, err := json.Marshal(zzz.AvatarData{ID: 1511})
	if err != nil {
		t.Fatalf("marshal raw avatar: %v", err)
	}

	const requests = 50
	done := make(chan bool, requests)
	for range requests {
		go func() {
			_, ok := svc.Localize(context.Background(), raw, fairy.LangRU)
			done <- ok
		}()
	}
	for range requests {
		if !<-done {
			t.Fatal("expected every concurrent Localize to succeed")
		}
	}

	if got := enricher.calls.Load(); got != 1 {
		t.Errorf("expected concurrent misses to coalesce into 1 enrichment, got %d", got)
	}
}
