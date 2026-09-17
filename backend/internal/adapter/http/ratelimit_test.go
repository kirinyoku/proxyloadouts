package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"golang.org/x/time/rate"
)

func TestIPRateLimiter_BurstAndThrottle(t *testing.T) {
	// Limit: 1 request per second, burst of 3
	limiter := NewIPRateLimiter(rate.Limit(1.0), 3, time.Minute)
	defer limiter.Close()

	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	handler := limiter.Handler(dummyHandler)

	// First 3 requests should pass (consuming burst)
	for i := 1; i <= 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = "192.168.1.100:12345"
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("request %d: expected 200 OK, got %d", i, rec.Code)
		}
		limitHdr := rec.Header().Get("RateLimit-Limit")
		if limitHdr != "3" {
			t.Errorf("request %d: expected RateLimit-Limit 3, got %s", i, limitHdr)
		}
		remHdr := rec.Header().Get("RateLimit-Remaining")
		expectedRem := strconv.Itoa(3 - i)
		if remHdr != expectedRem {
			t.Errorf("request %d: expected RateLimit-Remaining %s, got %s", i, expectedRem, remHdr)
		}
	}

	// 4th request must immediately trigger 429 Too Many Requests
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "192.168.1.100:12345"
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("expected 429 Too Many Requests, got %d", rec.Code)
	}

	// Verify IETF RateLimit and Retry-After headers
	if retryAfter := rec.Header().Get("Retry-After"); retryAfter == "" {
		t.Error("expected non-empty Retry-After header")
	}
	if rem := rec.Header().Get("RateLimit-Remaining"); rem != "0" {
		t.Errorf("expected RateLimit-Remaining 0, got %s", rem)
	}
	if reset := rec.Header().Get("RateLimit-Reset"); reset == "" {
		t.Error("expected non-empty RateLimit-Reset header")
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode json body: %v", err)
	}
	if body["error"] != "rate limit exceeded: please slow down" {
		t.Errorf("unexpected error message: %v", body["error"])
	}
}

func TestIPRateLimiter_IPIsolation(t *testing.T) {
	// Limit: 1 req/sec, burst 2
	limiter := NewIPRateLimiter(rate.Limit(1.0), 2, time.Minute)
	defer limiter.Close()

	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := limiter.Handler(dummyHandler)

	// IP 1: exhaust burst
	for i := range 2 {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("X-Forwarded-For", "203.0.113.1")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("IP 1 request %d failed with %d", i, rec.Code)
		}
	}

	// IP 1: 3rd request blocked
	req1Blocked := httptest.NewRequest(http.MethodGet, "/test", nil)
	req1Blocked.Header.Set("X-Forwarded-For", "203.0.113.1")
	rec1Blocked := httptest.NewRecorder()
	handler.ServeHTTP(rec1Blocked, req1Blocked)
	if rec1Blocked.Code != http.StatusTooManyRequests {
		t.Errorf("IP 1 expected 429, got %d", rec1Blocked.Code)
	}

	// IP 2: must still pass freely!
	req2 := httptest.NewRequest(http.MethodGet, "/test", nil)
	req2.Header.Set("X-Forwarded-For", "203.0.113.2")
	rec2 := httptest.NewRecorder()
	handler.ServeHTTP(rec2, req2)
	if rec2.Code != http.StatusOK {
		t.Errorf("IP 2 expected 200, got %d", rec2.Code)
	}
}

func TestIPRateLimiter_GetClientIP(t *testing.T) {
	tests := []struct {
		name       string
		cf         string
		xff        string
		xri        string
		remoteAddr string
		want       string
	}{
		{
			name:       "CF-Connecting-IP takes highest priority",
			cf:         "1.1.1.1",
			xff:        "2.2.2.2, 3.3.3.3",
			xri:        "4.4.4.4",
			remoteAddr: "5.5.5.5:8080",
			want:       "1.1.1.1",
		},
		{
			name:       "X-Forwarded-For first client IP",
			xff:        "203.0.113.195, 70.41.3.18, 150.172.238.178",
			xri:        "4.4.4.4",
			remoteAddr: "5.5.5.5:8080",
			want:       "203.0.113.195",
		},
		{
			name:       "X-Real-IP fallback",
			xri:        "198.51.100.1",
			remoteAddr: "5.5.5.5:8080",
			want:       "198.51.100.1",
		},
		{
			name:       "RemoteAddr host:port fallback",
			remoteAddr: "192.0.2.1:54321",
			want:       "192.0.2.1",
		},
		{
			name:       "Invalid headers fallback to RemoteAddr",
			cf:         "not-an-ip",
			xff:        "also-invalid",
			remoteAddr: "192.0.2.2:1234",
			want:       "192.0.2.2",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/", nil)
			if tt.cf != "" {
				req.Header.Set("CF-Connecting-IP", tt.cf)
			}
			if tt.xff != "" {
				req.Header.Set("X-Forwarded-For", tt.xff)
			}
			if tt.xri != "" {
				req.Header.Set("X-Real-IP", tt.xri)
			}
			req.RemoteAddr = tt.remoteAddr

			got := getClientIP(req)
			if got != tt.want {
				t.Errorf("getClientIP() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestIPRateLimiter_Cleanup(t *testing.T) {
	// Limiter with short TTL of 50ms and fast cleanup interval of 20ms
	limiter := NewIPRateLimiter(rate.Limit(10.0), 10, 50*time.Millisecond, 20*time.Millisecond)
	defer limiter.Close()

	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := limiter.Handler(dummyHandler)

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.RemoteAddr = "10.10.10.10:1234"
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	limiter.mu.Lock()
	countBefore := len(limiter.ips)
	limiter.mu.Unlock()
	if countBefore != 1 {
		t.Fatalf("expected 1 tracked IP before cleanup, got %d", countBefore)
	}

	// Wait for cleanup sweep
	time.Sleep(100 * time.Millisecond)

	limiter.mu.Lock()
	countAfter := len(limiter.ips)
	limiter.mu.Unlock()
	if countAfter != 0 {
		t.Errorf("expected 0 tracked IPs after cleanup sweep, got %d", countAfter)
	}
}

func TestIPRateLimiter_MaxCapacity(t *testing.T) {
	limiter := NewIPRateLimiter(rate.Limit(10.0), 10, time.Hour)
	limiter.maxEntries = 5
	defer limiter.Close()

	for i := range 10 {
		lim := limiter.getLimiter(strconv.Itoa(i))
		if lim == nil {
			t.Fatalf("expected non-nil limiter for %d", i)
		}
	}

	limiter.mu.Lock()
	count := len(limiter.ips)
	limiter.mu.Unlock()

	if count > 5 {
		t.Errorf("expected count <= 5, got %d", count)
	}
}
