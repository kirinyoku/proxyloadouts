package http

import (
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

const (
	defaultMaxIPEntries = 10000
)

type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// IPRateLimiter provides per-IP token-bucket rate limiting for HTTP endpoints.
type IPRateLimiter struct {
	mu         sync.Mutex
	ips        map[string]*ipLimiter
	rate       rate.Limit
	burst      int
	ttl        time.Duration
	maxEntries int
	stopChan   chan struct{}
	stopOnce   sync.Once
}

// NewIPRateLimiter creates a new rate limiter that tracks client IPs.
// Inactive IPs are purged after ttl has elapsed since their last request.
func NewIPRateLimiter(r rate.Limit, burst int, ttl time.Duration, cleanupInterval ...time.Duration) *IPRateLimiter {
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	interval := time.Minute
	if len(cleanupInterval) > 0 && cleanupInterval[0] > 0 {
		interval = cleanupInterval[0]
	}

	limiter := &IPRateLimiter{
		ips:        make(map[string]*ipLimiter),
		rate:       r,
		burst:      burst,
		ttl:        ttl,
		maxEntries: defaultMaxIPEntries,
		stopChan:   make(chan struct{}),
	}

	go limiter.startCleanup(interval)
	return limiter
}

// Close stops the background eviction goroutine and releases resources.
func (l *IPRateLimiter) Close() {
	l.stopOnce.Do(func() {
		close(l.stopChan)
	})
}

// LimiterStats reports runtime metrics and configuration of an IPRateLimiter.
type LimiterStats struct {
	ActiveIPs     int     `json:"active_ips"`
	MaxEntries    int     `json:"max_entries"`
	RatePerMinute float64 `json:"rate_per_minute"`
	Burst         int     `json:"burst"`
	TTLSeconds    int     `json:"ttl_seconds"`
}

// Stats returns a snapshot of the rate limiter's current state.
func (l *IPRateLimiter) Stats() LimiterStats {
	l.mu.Lock()
	active := len(l.ips)
	l.mu.Unlock()

	return LimiterStats{
		ActiveIPs:     active,
		MaxEntries:    l.maxEntries,
		RatePerMinute: math.Round(float64(l.rate)*60.0*100) / 100,
		Burst:         l.burst,
		TTLSeconds:    int(l.ttl.Seconds()),
	}
}

// Clear removes all tracked IP buckets from the rate limiter.
func (l *IPRateLimiter) Clear() {
	l.mu.Lock()
	l.ips = make(map[string]*ipLimiter)
	l.mu.Unlock()
}

// DeleteIP removes a specific IP bucket from the rate limiter.
func (l *IPRateLimiter) DeleteIP(ip string) {
	l.mu.Lock()
	delete(l.ips, strings.TrimSpace(ip))
	l.mu.Unlock()
}

// Handler returns a Chi-compatible HTTP middleware that enforces the rate limit.
func (l *IPRateLimiter) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ip := getClientIP(r)
		lim := l.getLimiter(ip)

		if !lim.Allow() {
			missing := 1.0 - lim.Tokens()
			if missing < 0 {
				missing = 1.0
			}
			waitSec := missing / float64(l.rate)
			retryAfter := int(math.Ceil(waitSec))
			if retryAfter < 1 {
				retryAfter = 1
			}

			w.Header().Set("Retry-After", strconv.Itoa(retryAfter))
			w.Header().Set("RateLimit-Limit", strconv.Itoa(l.burst))
			w.Header().Set("RateLimit-Remaining", "0")
			w.Header().Set("RateLimit-Reset", strconv.Itoa(retryAfter))

			respondError(w, http.StatusTooManyRequests, "rate limit exceeded: please slow down")
			return
		}

		tokens := int(math.Floor(lim.Tokens()))
		if tokens < 0 {
			tokens = 0
		}
		w.Header().Set("RateLimit-Limit", strconv.Itoa(l.burst))
		w.Header().Set("RateLimit-Remaining", strconv.Itoa(tokens))

		next.ServeHTTP(w, r)
	})
}

func (l *IPRateLimiter) getLimiter(ip string) *rate.Limiter {
	l.mu.Lock()
	defer l.mu.Unlock()

	entry, exists := l.ips[ip]
	if !exists {
		if l.maxEntries > 0 && len(l.ips) >= l.maxEntries {
			now := time.Now()
			for k, e := range l.ips {
				if now.Sub(e.lastSeen) > l.ttl {
					delete(l.ips, k)
				}
			}
			if len(l.ips) >= l.maxEntries {
				for k := range l.ips {
					delete(l.ips, k)
					break
				}
			}
		}

		entry = &ipLimiter{
			limiter:  rate.NewLimiter(l.rate, l.burst),
			lastSeen: time.Now(),
		}
		l.ips[ip] = entry
		return entry.limiter
	}

	entry.lastSeen = time.Now()
	return entry.limiter
}

func (l *IPRateLimiter) cleanup() {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	for ip, entry := range l.ips {
		if now.Sub(entry.lastSeen) > l.ttl {
			delete(l.ips, ip)
		}
	}
}

func (l *IPRateLimiter) startCleanup(interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			l.cleanup()
		case <-l.stopChan:
			return
		}
	}
}

// getClientIP extracts the client IP address from HTTP request headers or RemoteAddr.
func getClientIP(r *http.Request) string {
	// 1. Cloudflare header
	if cfIP := strings.TrimSpace(r.Header.Get("CF-Connecting-IP")); cfIP != "" {
		if parsed := net.ParseIP(cfIP); parsed != nil {
			return parsed.String()
		}
	}

	// 2. X-Forwarded-For: client, proxy1, proxy2...
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		first := strings.TrimSpace(parts[0])
		if parsed := net.ParseIP(first); parsed != nil {
			return parsed.String()
		}
	}

	// 3. X-Real-IP
	if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
		if parsed := net.ParseIP(xri); parsed != nil {
			return parsed.String()
		}
	}

	// 4. RemoteAddr: host:port
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		if parsed := net.ParseIP(host); parsed != nil {
			return parsed.String()
		}
		return host
	}

	trimmed := strings.TrimSpace(r.RemoteAddr)
	if trimmed != "" {
		return trimmed
	}

	return "127.0.0.1"
}
