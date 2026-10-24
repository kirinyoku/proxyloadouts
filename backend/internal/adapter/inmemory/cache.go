package inmemory

import (
	"context"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// DefaultMaxItems is the fallback capacity for Cache when maxItems <= 0.
const DefaultMaxItems = 1000

type lruNode[T any] struct {
	key       string
	value     T
	expiresAt time.Time
	prev      *lruNode[T]
	next      *lruNode[T]
}

func (node *lruNode[T]) isExpired(now time.Time) bool {
	if node.expiresAt.IsZero() {
		return false
	}
	return now.After(node.expiresAt)
}

// Cache is a thread-safe generic in-memory LRU key-value store with TTL and bounded capacity.
type Cache[T any] struct {
	mu         sync.Mutex
	maxItems   int
	items      map[string]*lruNode[T]
	head       *lruNode[T] // sentinel head: MRU is head.next
	tail       *lruNode[T] // sentinel tail: LRU is tail.prev
	stopChan   chan struct{}
	closeOnce  sync.Once
	hasCleanup bool
}

// NewCache creates a new Cache with bounded capacity and LRU eviction.
// If maxItems <= 0, DefaultMaxItems is used.
// If cleanupInterval > 0, a background goroutine periodically removes expired entries.
func NewCache[T any](maxItems int, cleanupInterval time.Duration) *Cache[T] {
	if maxItems <= 0 {
		maxItems = DefaultMaxItems
	}

	head := &lruNode[T]{}
	tail := &lruNode[T]{}
	head.next = tail
	tail.prev = head

	c := &Cache[T]{
		maxItems: maxItems,
		items:    make(map[string]*lruNode[T]),
		head:     head,
		tail:     tail,
		stopChan: make(chan struct{}),
	}

	if cleanupInterval > 0 {
		c.hasCleanup = true
		go c.startCleanup(cleanupInterval)
	}

	return c
}

// Set stores a value in the cache with the given TTL. If ttl <= 0, the item does not expire.
// If inserting a new key causes the cache to exceed maxItems, the least recently used item is evicted.
func (c *Cache[T]) Set(key string, value T, ttl time.Duration) {
	var expiresAt time.Time
	if ttl > 0 {
		expiresAt = time.Now().Add(ttl)
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if node, found := c.items[key]; found {
		node.value = value
		node.expiresAt = expiresAt
		c.moveToFront(node)
		return
	}

	if c.maxItems > 0 && len(c.items) >= c.maxItems {
		c.evictOldest()
	}

	node := &lruNode[T]{
		key:       key,
		value:     value,
		expiresAt: expiresAt,
	}
	c.items[key] = node
	c.pushFront(node)
}

// Get retrieves a value from the cache and marks it as most recently used.
// Returns false if key does not exist or has expired.
func (c *Cache[T]) Get(key string) (T, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	node, found := c.items[key]
	if !found {
		var zero T
		return zero, false
	}

	if node.isExpired(time.Now()) {
		c.removeNode(node)
		var zero T
		return zero, false
	}

	c.moveToFront(node)
	return node.value, true
}

// Peek returns the value without updating the LRU order.
func (c *Cache[T]) Peek(key string) (T, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	node, found := c.items[key]
	if !found {
		var zero T
		return zero, false
	}

	if node.isExpired(time.Now()) {
		c.removeNode(node)
		var zero T
		return zero, false
	}

	return node.value, true
}

// GetWithRemainingTTL retrieves the value along with its remaining TTL duration,
// marking it as most recently used.
func (c *Cache[T]) GetWithRemainingTTL(key string) (T, time.Duration, bool) {
	now := time.Now()

	c.mu.Lock()
	defer c.mu.Unlock()

	node, found := c.items[key]
	if !found {
		var zero T
		return zero, 0, false
	}

	if node.isExpired(now) {
		c.removeNode(node)
		var zero T
		return zero, 0, false
	}

	c.moveToFront(node)

	var remaining time.Duration
	if !node.expiresAt.IsZero() {
		remaining = node.expiresAt.Sub(now)
		if remaining < 0 {
			remaining = 0
		}
	}

	return node.value, remaining, true
}

// Delete removes a key from the cache.
func (c *Cache[T]) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if node, found := c.items[key]; found {
		c.removeNode(node)
	}
}

// Clear removes all keys from the cache.
func (c *Cache[T]) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]*lruNode[T])
	c.head.next = c.tail
	c.tail.prev = c.head
}

// Len returns the current count of items (including any unpruned expired items).
func (c *Cache[T]) Len() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.items)
}

// Capacity returns the maximum capacity of the cache.
func (c *Cache[T]) Capacity() int {
	return c.maxItems
}

// Close stops the background cleanup goroutine and releases resources.
func (c *Cache[T]) Close() {
	c.closeOnce.Do(func() {
		if c.hasCleanup {
			close(c.stopChan)
		}
	})
}

// DeleteExpired sweeps through all cache entries and removes expired ones.
func (c *Cache[T]) DeleteExpired() {
	now := time.Now()
	c.mu.Lock()
	defer c.mu.Unlock()

	for _, node := range c.items {
		if node.isExpired(now) {
			c.removeNode(node)
		}
	}
}

func (c *Cache[T]) pushFront(node *lruNode[T]) {
	node.prev = c.head
	node.next = c.head.next
	c.head.next.prev = node
	c.head.next = node
}

func (c *Cache[T]) detach(node *lruNode[T]) {
	node.prev.next = node.next
	node.next.prev = node.prev
}

func (c *Cache[T]) moveToFront(node *lruNode[T]) {
	c.detach(node)
	c.pushFront(node)
}

func (c *Cache[T]) removeNode(node *lruNode[T]) {
	c.detach(node)
	delete(c.items, node.key)
}

func (c *Cache[T]) evictOldest() {
	if c.tail.prev == c.head {
		return
	}
	c.removeNode(c.tail.prev)
}

func (c *Cache[T]) startCleanup(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			c.DeleteExpired()
		case <-c.stopChan:
			return
		}
	}
}

// SingleflightService combines Cache and singleflight.Group for request coalescing and caching.
type SingleflightService[T any] struct {
	cache *Cache[T]
	group singleflight.Group
}

// NewSingleflightService creates a new SingleflightService with an underlying TTL Cache.
func NewSingleflightService[T any](maxItems int, cleanupInterval time.Duration) *SingleflightService[T] {
	return &SingleflightService[T]{
		cache: NewCache[T](maxItems, cleanupInterval),
	}
}

// Cache returns the underlying Cache instance.
func (s *SingleflightService[T]) Cache() *Cache[T] {
	return s.cache
}

// Close closes the underlying cache.
func (s *SingleflightService[T]) Close() {
	s.cache.Close()
}

// Len returns the current number of entries in the underlying cache.
func (s *SingleflightService[T]) Len() int {
	return s.cache.Len()
}

// Capacity returns the maximum capacity of the underlying cache.
func (s *SingleflightService[T]) Capacity() int {
	return s.cache.Capacity()
}

// Clear removes all entries from the underlying cache.
func (s *SingleflightService[T]) Clear() {
	s.cache.Clear()
}

// Delete removes a specific key from the underlying cache.
func (s *SingleflightService[T]) Delete(key string) {
	s.cache.Delete(key)
}

// FetchResult contains the returned data and cache metadata.
type FetchResult[T any] struct {
	Data         T
	FromCache    bool
	RemainingTTL time.Duration
	Shared       bool
}

// GetOrFetch retrieves the cached value if present and valid.
// If absent or expired, it uses singleflight to execute fetchFn, caches the result on success, and returns it.
func (s *SingleflightService[T]) GetOrFetch(
	ctx context.Context,
	key string,
	ttl time.Duration,
	fetchFn func(ctx context.Context) (T, time.Duration, error),
) (FetchResult[T], error) {
	if val, rem, ok := s.cache.GetWithRemainingTTL(key); ok {
		return FetchResult[T]{
			Data:         val,
			FromCache:    true,
			RemainingTTL: rem,
			Shared:       false,
		}, nil
	}

	ch := s.group.DoChan(key, func() (any, error) {
		// Double check cache in singleflight callback
		if val, rem, ok := s.cache.GetWithRemainingTTL(key); ok {
			return FetchResult[T]{
				Data:         val,
				FromCache:    true,
				RemainingTTL: rem,
				Shared:       false,
			}, nil
		}

		// Detach from the initiating caller's context cancellation so that one client
		// aborting their connection does not fail in-flight fetches for other concurrent callers.
		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 60*time.Second)
		defer cancel()

		data, dynamicTTL, fetchErr := fetchFn(fetchCtx)
		if fetchErr != nil {
			return nil, fetchErr
		}

		effectiveTTL := ttl
		if dynamicTTL > 0 {
			effectiveTTL = dynamicTTL
		}

		if effectiveTTL > 0 {
			s.cache.Set(key, data, effectiveTTL)
		}

		return FetchResult[T]{
			Data:         data,
			FromCache:    false,
			RemainingTTL: effectiveTTL,
			Shared:       false,
		}, nil
	})

	select {
	case <-ctx.Done():
		var zero T
		return FetchResult[T]{Data: zero}, ctx.Err()
	case res := <-ch:
		if res.Err != nil {
			var zero T
			return FetchResult[T]{Data: zero}, res.Err
		}

		result := res.Val.(FetchResult[T])
		result.Shared = res.Shared
		return result, nil
	}
}

// GetOrFetchValue is a value-only convenience wrapper over GetOrFetch for
// callers that do not need the cache metadata. It exists so that an
// application-layer cache interface can stay non-generic: methods cannot
// introduce type parameters, so the generic FetchResult return type would
// otherwise force every consumer to depend on this package.
func GetOrFetchValue[T any](
	ctx context.Context,
	s *SingleflightService[T],
	key string,
	ttl time.Duration,
	fetchFn func(ctx context.Context) (T, time.Duration, error),
) (T, error) {
	res, err := s.GetOrFetch(ctx, key, ttl, fetchFn)
	if err != nil {
		var zero T
		return zero, err
	}
	return res.Data, nil
}

// ProfileCache wraps SingleflightService for *fairy.Profile.
type ProfileCache[T any] struct {
	sf *SingleflightService[T]
}

// NewProfileCache creates a SingleflightService adapter for profile data.
func NewProfileCache[T any](maxItems int, cleanupInterval time.Duration) *ProfileCache[T] {
	return &ProfileCache[T]{sf: NewSingleflightService[T](maxItems, cleanupInterval)}
}

// Close closes the underlying cache.
func (c *ProfileCache[T]) Close() {
	c.sf.Close()
}

// Len returns the current number of entries in the profile cache.
func (c *ProfileCache[T]) Len() int {
	return c.sf.Len()
}

// Capacity returns the maximum capacity of the profile cache.
func (c *ProfileCache[T]) Capacity() int {
	return c.sf.Capacity()
}

// Clear removes all entries from the profile cache.
func (c *ProfileCache[T]) Clear() {
	c.sf.Clear()
}

// Delete removes a specific key from the profile cache.
func (c *ProfileCache[T]) Delete(key string) {
	c.sf.Delete(key)
}

// GetOrFetch fetches or returns cached data.
func (c *ProfileCache[T]) GetOrFetch(
	ctx context.Context,
	key string,
	ttl time.Duration,
	fetchFn func(ctx context.Context) (T, time.Duration, error),
) (T, bool, time.Duration, error) {
	res, err := c.sf.GetOrFetch(ctx, key, ttl, fetchFn)
	if err != nil {
		var zero T
		return zero, false, 0, err
	}
	return res.Data, res.FromCache, res.RemainingTTL, nil
}

// NegativeCache tracks keys that previously resulted in ErrNotFound to shield upstream APIs.
type NegativeCache struct {
	cache *Cache[struct{}]
}

// NewNegativeCache creates an in-memory negative cache.
func NewNegativeCache(maxItems int, cleanupInterval time.Duration) *NegativeCache {
	return &NegativeCache{
		cache: NewCache[struct{}](maxItems, cleanupInterval),
	}
}

// Set stores a key in the negative cache for the specified duration.
func (n *NegativeCache) Set(key string, ttl time.Duration) {
	n.cache.Set(key, struct{}{}, ttl)
}

// Has checks whether a key is currently present and non-expired in the negative cache.
func (n *NegativeCache) Has(key string) bool {
	_, found := n.cache.Get(key)
	return found
}

// Delete removes a key from the negative cache.
func (n *NegativeCache) Delete(key string) {
	n.cache.Delete(key)
}

// Len returns the current number of entries in the negative cache.
func (n *NegativeCache) Len() int {
	return n.cache.Len()
}

// Capacity returns the maximum capacity of the negative cache.
func (n *NegativeCache) Capacity() int {
	return n.cache.Capacity()
}

// Clear removes all entries from the negative cache.
func (n *NegativeCache) Clear() {
	n.cache.Clear()
}

// Close stops the background cleanup goroutine of the underlying cache.
func (n *NegativeCache) Close() {
	n.cache.Close()
}
