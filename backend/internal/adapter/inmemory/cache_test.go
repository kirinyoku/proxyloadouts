package inmemory

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestCache_SetAndGet(t *testing.T) {
	c := NewCache[string](100, 0)
	defer c.Close()

	c.Set("user_1", "Alice", 100*time.Millisecond)

	val, found := c.Get("user_1")
	if !found {
		t.Fatalf("expected key to be found")
	}
	if val != "Alice" {
		t.Fatalf("expected Alice, got %s", val)
	}

	c.Delete("user_1")
	_, found = c.Get("user_1")
	if found {
		t.Fatalf("expected key to be deleted")
	}
}

func TestCache_Expiration(t *testing.T) {
	c := NewCache[string](100, 0)
	defer c.Close()

	c.Set("temp", "value", 20*time.Millisecond)

	val, found := c.Get("temp")
	if !found || val != "value" {
		t.Fatalf("expected key to exist before expiry")
	}

	time.Sleep(30 * time.Millisecond)

	_, found = c.Get("temp")
	if found {
		t.Fatalf("expected key to expire")
	}
}

func TestCache_GetWithRemainingTTL(t *testing.T) {
	c := NewCache[string](100, 0)
	defer c.Close()

	c.Set("k1", "v1", 200*time.Millisecond)

	val, rem, found := c.GetWithRemainingTTL("k1")
	if !found || val != "v1" {
		t.Fatalf("expected key to be found")
	}
	if rem <= 0 || rem > 200*time.Millisecond {
		t.Fatalf("unexpected remaining TTL: %v", rem)
	}

	time.Sleep(210 * time.Millisecond)
	_, _, found = c.GetWithRemainingTTL("k1")
	if found {
		t.Fatalf("expected expired key not to be found")
	}
}

func TestCache_PeriodicCleanup(t *testing.T) {
	c := NewCache[string](100, 20*time.Millisecond)
	defer c.Close()

	c.Set("short_lived", "data", 10*time.Millisecond)
	if c.Len() != 1 {
		t.Fatalf("expected len 1, got %d", c.Len())
	}

	time.Sleep(50 * time.Millisecond)

	if c.Len() != 0 {
		t.Fatalf("expected item to be pruned by background cleanup, got len %d", c.Len())
	}
}

func TestCache_ConcurrentAccess(t *testing.T) {
	c := NewCache[int](100, 0)
	defer c.Close()

	var wg sync.WaitGroup
	for i := range 50 {
		wg.Add(2)
		val := i
		go func() {
			defer wg.Done()
			c.Set("num", val, 500*time.Millisecond)
		}()
		go func() {
			defer wg.Done()
			_, _ = c.Get("num")
		}()
	}
	wg.Wait()
}

func TestSingleflightService_GetOrFetch(t *testing.T) {
	svc := NewSingleflightService[string](100, 0)
	defer svc.Close()

	var fetchCount atomic.Int32

	fetchFn := func(ctx context.Context) (string, time.Duration, error) {
		fetchCount.Add(1)
		time.Sleep(20 * time.Millisecond)
		return "fetched-data", 100 * time.Millisecond, nil
	}

	ctx := context.Background()

	// Launch 10 concurrent requests for the exact same key
	var wg sync.WaitGroup
	results := make([]FetchResult[string], 10)
	errorsList := make([]error, 10)

	for i := range 10 {
		idx := i
		wg.Add(1)
		go func() {
			defer wg.Done()
			res, err := svc.GetOrFetch(ctx, "uid_12345", 100*time.Millisecond, fetchFn)
			results[idx] = res
			errorsList[idx] = err
		}()
	}

	wg.Wait()

	// Verify all returned success and data
	for i, err := range errorsList {
		if err != nil {
			t.Fatalf("request %d returned error: %v", i, err)
		}
		if results[i].Data != "fetched-data" {
			t.Fatalf("request %d returned unexpected data: %s", i, results[i].Data)
		}
	}

	// fetchFn should only have been called ONCE due to singleflight
	if count := fetchCount.Load(); count != 1 {
		t.Fatalf("expected fetchFn to be called once, got %d", count)
	}

	// Next call should come directly from cache
	res, err := svc.GetOrFetch(ctx, "uid_12345", 100*time.Millisecond, fetchFn)
	if err != nil {
		t.Fatalf("cached call returned error: %v", err)
	}
	if !res.FromCache {
		t.Fatalf("expected result to be from cache")
	}
	if fetchCount.Load() != 1 {
		t.Fatalf("expected fetchCount to still be 1, got %d", fetchCount.Load())
	}
}

func TestSingleflightService_ErrorPropagation(t *testing.T) {
	svc := NewSingleflightService[string](100, 0)
	defer svc.Close()

	expectedErr := errors.New("upstream enka rate limit")
	fetchFn := func(ctx context.Context) (string, time.Duration, error) {
		return "", 0, expectedErr
	}

	_, err := svc.GetOrFetch(context.Background(), "err_key", 100*time.Millisecond, fetchFn)
	if !errors.Is(err, expectedErr) {
		t.Fatalf("expected error %v, got %v", expectedErr, err)
	}

	// Cache should NOT store failed fetches
	_, found := svc.Cache().Get("err_key")
	if found {
		t.Fatalf("expected failed fetch not to be stored in cache")
	}
}

func TestSingleflightService_FirstCallerCancelDoesNotAffectOthers(t *testing.T) {
	svc := NewSingleflightService[string](100, 0)
	defer svc.Close()

	started := make(chan struct{})
	fetchFn := func(ctx context.Context) (string, time.Duration, error) {
		close(started)
		// Simulates slow upstream network fetch (e.g. 50ms)
		select {
		case <-time.After(50 * time.Millisecond):
			return "success-data", 100 * time.Millisecond, nil
		case <-ctx.Done():
			return "", 0, ctx.Err()
		}
	}

	// Caller 1 has a short timeout that will cancel while fetchFn is running
	ctx1, cancel1 := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel1()

	// Caller 2 has an ample timeout
	ctx2, cancel2 := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel2()

	var wg sync.WaitGroup
	var res2 FetchResult[string]
	var err1, err2 error

	wg.Add(1)
	go func() {
		defer wg.Done()
		_, err1 = svc.GetOrFetch(ctx1, "key_shared", 100*time.Millisecond, fetchFn)
	}()

	// Wait until fetchFn actually starts
	<-started

	wg.Add(1)
	go func() {
		defer wg.Done()
		res2, err2 = svc.GetOrFetch(ctx2, "key_shared", 100*time.Millisecond, fetchFn)
	}()

	wg.Wait()

	// Caller 1 should fail because its own context expired
	if !errors.Is(err1, context.DeadlineExceeded) {
		t.Errorf("expected caller 1 to get DeadlineExceeded, got %v", err1)
	}

	// Caller 2 should succeed despite caller 1 cancelling
	if err2 != nil {
		t.Fatalf("expected caller 2 to succeed, got error: %v", err2)
	}
	if res2.Data != "success-data" {
		t.Errorf("expected caller 2 to get 'success-data', got %q", res2.Data)
	}

	// The cache should be populated now
	val, found := svc.Cache().Get("key_shared")
	if !found || val != "success-data" {
		t.Errorf("expected cache to contain 'success-data', found: %v, val: %q", found, val)
	}
}

func TestSingleflightService_Set(t *testing.T) {
	svc := NewSingleflightService[string](10, time.Minute)
	defer svc.Close()

	svc.Set("manual_key", "manual_val", time.Minute)

	res, err := svc.GetOrFetch(context.Background(), "manual_key", time.Minute, func(ctx context.Context) (string, time.Duration, error) {
		t.Fatal("fetchFn should not be called for pre-cached entry")
		return "", 0, nil
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !res.FromCache || res.Data != "manual_val" {
		t.Errorf("expected cached manual_val, got %+v", res)
	}
}

func TestProfileCache_Set(t *testing.T) {
	pc := NewProfileCache[string](10, time.Minute)
	defer pc.Close()

	pc.Set("prof_1", "profile_payload", time.Minute)

	data, fromCache, _, err := pc.GetOrFetch(context.Background(), "prof_1", time.Minute, func(ctx context.Context) (string, time.Duration, error) {
		t.Fatal("fetchFn should not be called when profile is present")
		return "", 0, nil
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !fromCache || data != "profile_payload" {
		t.Errorf("expected cached profile_payload, got data=%q, fromCache=%v", data, fromCache)
	}
}

func TestNegativeCache(t *testing.T) {
	nc := NewNegativeCache(100, time.Minute)
	defer nc.Close()

	if nc.Has("uid:9999999999") {
		t.Error("expected key to not be in negative cache initially")
	}

	nc.Set("uid:9999999999", 50*time.Millisecond)

	if !nc.Has("uid:9999999999") {
		t.Error("expected key to be in negative cache after Set")
	}

	// Wait for expiration
	time.Sleep(60 * time.Millisecond)

	if nc.Has("uid:9999999999") {
		t.Error("expected key to expire from negative cache")
	}

	// Test explicit delete
	nc.Set("uid:8888888888", time.Minute)
	if !nc.Has("uid:8888888888") {
		t.Error("expected key to be present")
	}
	nc.Delete("uid:8888888888")
	if nc.Has("uid:8888888888") {
		t.Error("expected key to be deleted")
	}
}

func TestCache_LRUEviction(t *testing.T) {
	c := NewCache[int](3, 0)
	defer c.Close()

	c.Set("k1", 1, 0)
	c.Set("k2", 2, 0)
	c.Set("k3", 3, 0)

	if c.Len() != 3 {
		t.Fatalf("expected len 3, got %d", c.Len())
	}

	// Insert 4th element; should evict k1 (oldest)
	c.Set("k4", 4, 0)

	if c.Len() != 3 {
		t.Fatalf("expected len to remain 3 after eviction, got %d", c.Len())
	}

	if _, found := c.Get("k1"); found {
		t.Errorf("expected k1 to be evicted")
	}
	for _, k := range []string{"k2", "k3", "k4"} {
		if _, found := c.Get(k); !found {
			t.Errorf("expected %s to be present", k)
		}
	}

	// Insert 5th element; at this point order was k2, k3, k4. But we just did Get(k2), Get(k3), Get(k4)!
	// The oldest is now k2!
	// Let's verify by inserting k5
	c.Set("k5", 5, 0)
	if _, found := c.Get("k2"); found {
		t.Errorf("expected k2 to be evicted as least recently used")
	}
	if _, found := c.Get("k5"); !found {
		t.Errorf("expected k5 to be present")
	}
}

func TestCache_LRUUpdateOnGet(t *testing.T) {
	c := NewCache[int](3, 0)
	defer c.Close()

	c.Set("k1", 1, 0)
	c.Set("k2", 2, 0)
	c.Set("k3", 3, 0)

	// Access k1, making it MRU. State becomes: [k1, k3, k2]
	if _, found := c.Get("k1"); !found {
		t.Fatalf("expected k1 to be found")
	}

	// Adding k4 should evict k2 (the LRU element)
	c.Set("k4", 4, 0)

	if _, found := c.Get("k2"); found {
		t.Errorf("expected k2 to be evicted")
	}
	if _, found := c.Get("k1"); !found {
		t.Errorf("expected k1 to still be present because it was accessed")
	}
	if _, found := c.Get("k3"); !found {
		t.Errorf("expected k3 to still be present")
	}
	if _, found := c.Get("k4"); !found {
		t.Errorf("expected k4 to be present")
	}
}

func TestCache_LRUUpdateOnGetWithRemainingTTL(t *testing.T) {
	c := NewCache[int](3, 0)
	defer c.Close()

	c.Set("k1", 1, time.Hour)
	c.Set("k2", 2, time.Hour)
	c.Set("k3", 3, time.Hour)

	// Access k1 via GetWithRemainingTTL
	val, rem, found := c.GetWithRemainingTTL("k1")
	if !found || val != 1 || rem <= 0 {
		t.Fatalf("expected k1 found with valid TTL")
	}

	// Insert k4, should evict k2
	c.Set("k4", 4, time.Hour)

	if _, found := c.Get("k2"); found {
		t.Errorf("expected k2 to be evicted")
	}
	if _, found := c.Get("k1"); !found {
		t.Errorf("expected k1 to be retained")
	}
}

func TestCache_UpdateExistingKey(t *testing.T) {
	c := NewCache[string](2, 0)
	defer c.Close()

	c.Set("a", "alpha", 0)
	c.Set("b", "beta", 0)

	// Update existing key "a"
	c.Set("a", "alpha-updated", 0)

	if c.Len() != 2 {
		t.Fatalf("expected len 2, got %d", c.Len())
	}

	// Adding "c" should evict "b" because "a" was updated and promoted to MRU
	c.Set("c", "gamma", 0)

	if _, found := c.Get("b"); found {
		t.Errorf("expected 'b' to be evicted")
	}
	valA, foundA := c.Get("a")
	if !foundA || valA != "alpha-updated" {
		t.Errorf("expected 'a' to be 'alpha-updated', got %s", valA)
	}
	valC, foundC := c.Get("c")
	if !foundC || valC != "gamma" {
		t.Errorf("expected 'c' to be 'gamma', got %s", valC)
	}
}

func TestCache_PeekDoesNotAffectLRU(t *testing.T) {
	c := NewCache[string](2, 0)
	defer c.Close()

	c.Set("a", "alpha", 0)
	c.Set("b", "beta", 0)

	// Peek "a" without updating recency
	valA, foundA := c.Peek("a")
	if !foundA || valA != "alpha" {
		t.Fatalf("expected 'a' peeked")
	}

	// Adding "c" should evict "a" since "a" is still the oldest!
	c.Set("c", "gamma", 0)

	if _, found := c.Get("a"); found {
		t.Errorf("expected 'a' to be evicted since Peek must not update LRU recency")
	}
	if _, found := c.Get("b"); !found {
		t.Errorf("expected 'b' to be present")
	}
	if _, found := c.Get("c"); !found {
		t.Errorf("expected 'c' to be present")
	}
}

func TestCache_DefaultMaxItems(t *testing.T) {
	c1 := NewCache[string](0, 0)
	defer c1.Close()
	if c1.Capacity() != DefaultMaxItems {
		t.Errorf("expected default capacity %d, got %d", DefaultMaxItems, c1.Capacity())
	}

	c2 := NewCache[string](-10, 0)
	defer c2.Close()
	if c2.Capacity() != DefaultMaxItems {
		t.Errorf("expected default capacity %d, got %d", DefaultMaxItems, c2.Capacity())
	}
}

func TestCache_ConcurrentLRU(t *testing.T) {
	const capacity = 20
	c := NewCache[int](capacity, 0)
	defer c.Close()

	var wg sync.WaitGroup
	for i := range 30 {
		wg.Add(3)
		workerID := i

		// Writer
		go func() {
			defer wg.Done()
			for j := range 50 {
				key := "k_" + string(rune('a'+(j%15)))
				c.Set(key, workerID*100+j, 500*time.Millisecond)
			}
		}()

		// Reader
		go func() {
			defer wg.Done()
			for j := range 50 {
				key := "k_" + string(rune('a'+(j%15)))
				_, _ = c.Get(key)
			}
		}()

		// Peeker
		go func() {
			defer wg.Done()
			for j := range 50 {
				key := "k_" + string(rune('a'+(j%15)))
				_, _ = c.Peek(key)
			}
		}()
	}

	wg.Wait()

	if l := c.Len(); l > capacity {
		t.Errorf("expected cache len <= %d under concurrent load, got %d", capacity, l)
	}
}
