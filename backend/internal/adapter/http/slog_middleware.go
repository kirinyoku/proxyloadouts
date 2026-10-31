package http

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5/middleware"
)

func safeRequestURI(r *http.Request) string {
	for _, prefix := range []string{"/api/v1/shared/builds/", "/api/v1/shared/rosters/", "/shared/build/", "/shared/roster/"} {
		if strings.HasPrefix(r.URL.Path, prefix) {
			return prefix + "[redacted]"
		}
	}
	return r.URL.RequestURI()
}

func safeRequestPath(r *http.Request) string {
	uri := safeRequestURI(r)
	if i := strings.IndexByte(uri, '?'); i >= 0 {
		return uri[:i]
	}
	return uri
}

// SlogRequestLogger returns a Chi HTTP middleware that logs incoming requests
// as structured JSON using the standard library log/slog package.
func SlogRequestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			defer func() {
				duration := time.Since(start)
				status := ww.Status()
				if status == 0 {
					status = http.StatusOK
				}

				// Silence successful health check pings to avoid log saturation in production.
				// Health checks are still logged if they return non-200 statuses.
				isHealthPath := r.URL.Path == "/health" || r.URL.Path == "/api/v1/health"
				if isHealthPath && status < http.StatusBadRequest {
					return
				}

				level := slog.LevelInfo
				switch {
				case status >= http.StatusInternalServerError:
					level = slog.LevelError
				case status >= http.StatusBadRequest:
					level = slog.LevelWarn
				}

				clientIP := getClientIP(r)

				logger.LogAttrs(
					r.Context(),
					level,
					"http request",
					slog.String("request_id", middleware.GetReqID(r.Context())),
					slog.String("method", r.Method),
					slog.String("path", safeRequestPath(r)),
					slog.Int("status", status),
					slog.Float64("duration_ms", float64(duration.Microseconds())/1000.0),
					slog.Int("bytes", ww.BytesWritten()),
					slog.String("ip", clientIP),
					slog.String("user_agent", r.UserAgent()),
				)
			}()

			next.ServeHTTP(ww, r)
		})
	}
}
