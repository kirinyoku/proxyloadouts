package buildenrich

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	fairy "github.com/kirinyoku/fairy"
)

// countingEnricher records how many times enrichment actually ran and returns
// a language-dependent name so cached results can be told apart.
type countingEnricher struct {
	calls    atomic.Int64
	failWith error
}

func (c *countingEnricher) EnrichAgent(raw *zzz.AvatarData, lang fairy.Language) (*fairy.Agent, error) {
	c.calls.Add(1)
	if c.failWith != nil {
		return nil, c.failWith
	}
	name := "Агент RU"
	if lang == fairy.LangEN {
		name = "Agent EN"
	}
	return &fairy.Agent{ID: raw.ID, Name: name}, nil
}

// memCache is a minimal TTL map standing in for inmemory.SingleflightService,
// so the app-layer contract can be tested without the adapter.
type memCache struct {
	mu      sync.Mutex
	entries map[string]memEntry
}

type memEntry struct {
	value     Localized
	expiresAt time.Time
	ttl       time.Duration
}

func newMemCache() *memCache { return &memCache{entries: map[string]memEntry{}} }

// get models the contract buildenrich.Cache promises: a hit is served from
// memory, and concurrent misses for the same key are coalesced into a single
// compute. The lock is deliberately held across compute to reproduce the
// singleflight guarantee of the production adapter.
func (m *memCache) get(
	ctx context.Context,
	key string,
	compute func(context.Context) (Localized, time.Duration, error),
) (Localized, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if e, ok := m.entries[key]; ok && time.Now().Before(e.expiresAt) {
		return e.value, nil
	}

	value, ttl, err := compute(ctx)
	if err != nil {
		return Localized{}, err
	}
	m.entries[key] = memEntry{value: value, expiresAt: time.Now().Add(ttl), ttl: ttl}
	return value, nil
}

func rawAvatarJSON(t *testing.T, id int) json.RawMessage {
	t.Helper()
	data, err := json.Marshal(zzz.AvatarData{ID: id})
	if err != nil {
		t.Fatalf("marshal raw avatar: %v", err)
	}
	return data
}

func TestLocalize_MemoizesPerBuildAndLanguage(t *testing.T) {
	enricher := &countingEnricher{}
	cache := newMemCache()
	svc := New(enricher, cache.get, time.Minute)
	ctx := context.Background()
	raw := rawAvatarJSON(t, 1511)

	first, ok := svc.Localize(ctx, raw, fairy.LangRU)
	if !ok {
		t.Fatal("expected first Localize to succeed")
	}
	if first.AgentName != "Агент RU" {
		t.Errorf("expected Агент RU, got %s", first.AgentName)
	}

	// A second request for the same build and language must be served from
	// cache: no second enrichment, identical payload.
	second, ok := svc.Localize(ctx, raw, fairy.LangRU)
	if !ok {
		t.Fatal("expected second Localize to succeed")
	}
	if got := enricher.calls.Load(); got != 1 {
		t.Errorf("expected 1 enrichment for a repeated (build, lang), got %d", got)
	}
	if string(second.Data) != string(first.Data) {
		t.Error("expected cached payload to be byte-identical to the first result")
	}
	if second.AgentName != first.AgentName {
		t.Errorf("expected cached name %q, got %q", first.AgentName, second.AgentName)
	}
}

func TestLocalize_LanguageIsPartOfTheKey(t *testing.T) {
	enricher := &countingEnricher{}
	cache := newMemCache()
	svc := New(enricher, cache.get, time.Minute)
	ctx := context.Background()
	raw := rawAvatarJSON(t, 1511)

	ru, ok := svc.Localize(ctx, raw, fairy.LangRU)
	if !ok {
		t.Fatal("expected ru Localize to succeed")
	}
	en, ok := svc.Localize(ctx, raw, fairy.LangEN)
	if !ok {
		t.Fatal("expected en Localize to succeed")
	}

	if ru.AgentName != "Агент RU" {
		t.Errorf("ru: expected Агент RU, got %s", ru.AgentName)
	}
	if en.AgentName != "Agent EN" {
		t.Errorf("en: expected Agent EN, got %s", en.AgentName)
	}
	if got := enricher.calls.Load(); got != 2 {
		t.Errorf("expected 2 enrichments (one per language), got %d", got)
	}
}

func TestLocalize_DistinctBuildsDoNotShareAnEntry(t *testing.T) {
	enricher := &countingEnricher{}
	cache := newMemCache()
	svc := New(enricher, cache.get, time.Minute)
	ctx := context.Background()

	first, _ := svc.Localize(ctx, rawAvatarJSON(t, 1511), fairy.LangRU)
	second, _ := svc.Localize(ctx, rawAvatarJSON(t, 1601), fairy.LangRU)

	if got := enricher.calls.Load(); got != 2 {
		t.Errorf("expected 2 enrichments for 2 distinct builds, got %d", got)
	}
	if string(first.Data) == string(second.Data) {
		t.Error("expected different payloads for different builds")
	}
}

func TestLocalize_EmptyPayloadIsNotCached(t *testing.T) {
	enricher := &countingEnricher{}
	cache := newMemCache()
	svc := New(enricher, cache.get, time.Minute)

	if _, ok := svc.Localize(context.Background(), nil, fairy.LangRU); ok {
		t.Error("expected ok=false for an empty payload")
	}
	if _, ok := svc.Localize(context.Background(), json.RawMessage{}, fairy.LangRU); ok {
		t.Error("expected ok=false for an empty payload")
	}
	if got := enricher.calls.Load(); got != 0 {
		t.Errorf("expected no enrichment for empty payloads, got %d", got)
	}
	if len(cache.entries) != 0 {
		t.Errorf("expected empty cache, got %d entries", len(cache.entries))
	}
}

func TestLocalize_EnrichmentFailureIsNotCached(t *testing.T) {
	enricher := &countingEnricher{failWith: errors.New("catalog unavailable")}
	cache := newMemCache()
	svc := New(enricher, cache.get, time.Minute)
	raw := rawAvatarJSON(t, 1511)

	if _, ok := svc.Localize(context.Background(), raw, fairy.LangRU); ok {
		t.Error("expected ok=false when enrichment fails")
	}
	if len(cache.entries) != 0 {
		t.Errorf("failures must not be cached, got %d entries", len(cache.entries))
	}

	// A later success must be able to populate the entry.
	enricher.failWith = nil
	if _, ok := svc.Localize(context.Background(), raw, fairy.LangRU); !ok {
		t.Error("expected Localize to succeed once enrichment recovers")
	}
}

func TestLocalize_NilCacheFallsBackToDirectEnrichment(t *testing.T) {
	enricher := &countingEnricher{}
	svc := New(enricher, nil, 0)

	if _, ok := svc.Localize(context.Background(), rawAvatarJSON(t, 1511), fairy.LangRU); !ok {
		t.Fatal("expected Localize to succeed without a cache")
	}
	if got := enricher.calls.Load(); got != 1 {
		t.Errorf("expected 1 enrichment without a cache, got %d", got)
	}
}

func TestLocalize_NilServiceAndNilEnricherAreSafe(t *testing.T) {
	var nilSvc *Service
	if _, ok := nilSvc.Localize(context.Background(), rawAvatarJSON(t, 1), fairy.LangRU); ok {
		t.Error("expected ok=false from a nil Service")
	}

	empty := New(nil, nil, 0)
	if _, ok := empty.Localize(context.Background(), rawAvatarJSON(t, 1), fairy.LangRU); ok {
		t.Error("expected ok=false without an enricher")
	}
}

func TestLocalize_CancelledContextDoesNotEnrich(t *testing.T) {
	// Without a cache the caller's context reaches compute directly, so a
	// cancelled request must short-circuit before the expensive enrichment.
	// (With a cache the adapter deliberately detaches from the caller context
	// per the project's singleflight invariant, so this check does not apply.)
	enricher := &countingEnricher{}
	svc := New(enricher, nil, 0)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, ok := svc.Localize(ctx, rawAvatarJSON(t, 1511), fairy.LangRU); ok {
		t.Error("expected ok=false for a cancelled context")
	}
	if got := enricher.calls.Load(); got != 0 {
		t.Errorf("expected no enrichment for a cancelled context, got %d", got)
	}
}

func TestLocalize_ConcurrentMissesAreCoalescedByTheCache(t *testing.T) {
	enricher := &countingEnricher{}
	cache := newMemCache()
	svc := New(enricher, cache.get, time.Minute)
	raw := rawAvatarJSON(t, 1511)

	const goroutines = 32
	var wg sync.WaitGroup
	results := make([]Localized, goroutines)
	oks := make([]bool, goroutines)
	for i := range goroutines {
		wg.Add(1)
		go func() {
			defer wg.Done()
			results[i], oks[i] = svc.Localize(context.Background(), raw, fairy.LangRU)
		}()
	}
	wg.Wait()

	for i := range goroutines {
		if !oks[i] {
			t.Fatalf("goroutine %d: expected Localize to succeed", i)
		}
		if results[i].AgentName != "Агент RU" {
			t.Errorf("goroutine %d: unexpected name %q", i, results[i].AgentName)
		}
	}
	// The stub cache serializes compute, so exactly one enrichment must run.
	if got := enricher.calls.Load(); got != 1 {
		t.Errorf("expected 1 enrichment across %d concurrent misses, got %d", goroutines, got)
	}
}

func TestCacheKey_DistinguishesPayloadAndLanguage(t *testing.T) {
	rawA := rawAvatarJSON(t, 1511)
	rawB := rawAvatarJSON(t, 1601)

	if CacheKey(rawA, fairy.LangRU) == CacheKey(rawB, fairy.LangRU) {
		t.Error("expected different keys for different payloads")
	}
	if CacheKey(rawA, fairy.LangRU) == CacheKey(rawA, fairy.LangEN) {
		t.Error("expected different keys for different languages")
	}
}

func TestCacheKey_IsDeterministicAndNamespacedByLanguage(t *testing.T) {
	raw := rawAvatarJSON(t, 1511)

	first := CacheKey(raw, fairy.LangRU)
	second := CacheKey(raw, fairy.LangRU)
	if first != second {
		t.Errorf("expected a deterministic key, got %q then %q", first, second)
	}

	// The key must be namespaced by language and carry a full SHA-256 digest,
	// so two languages can never collide on the same payload.
	lang, digest, found := strings.Cut(first, ":")
	if !found {
		t.Fatalf("expected a language-prefixed key, got %q", first)
	}
	if lang != string(fairy.LangRU) {
		t.Errorf("expected the key to start with %q, got %q", fairy.LangRU, lang)
	}
	if len(digest) != sha256.Size*2 {
		t.Errorf("expected a %d-char hex digest, got %d", sha256.Size*2, len(digest))
	}
	if _, err := hex.DecodeString(digest); err != nil {
		t.Errorf("expected a hex digest, got %q: %v", digest, err)
	}
}

func TestLocalize_InvalidLanguageFallsBackToRussian(t *testing.T) {
	enricher := &countingEnricher{}
	svc := New(enricher, newMemCache().get, time.Minute)

	result, ok := svc.Localize(context.Background(), rawAvatarJSON(t, 1511), fairy.Language("klingon"))
	if !ok {
		t.Fatal("expected Localize to succeed for an unsupported language")
	}
	if result.AgentName != "Агент RU" {
		t.Errorf("expected the RU fallback name, got %s", result.AgentName)
	}
}
