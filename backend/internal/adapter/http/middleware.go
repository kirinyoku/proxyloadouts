package http

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/authsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// Session cookie names.
const (
	defaultSessionCookieName = "pl_session"
	hostSessionCookieName    = "__Host-pl_session"
	stateCookieName          = "pl_oauth_state"
)

// sessionCookieName returns the session cookie name based on whether secure cookies are enabled.
// In production (secure=true), the __Host- prefix eliminates subdomain injection and hijacking vectors (RFC 6265bis).
func sessionCookieName(secure bool) string {
	if secure {
		return hostSessionCookieName
	}
	return defaultSessionCookieName
}

type userContextKey struct{}

// UserFromContext returns the authenticated user injected by the auth middleware.
func UserFromContext(ctx context.Context) (*domain.User, bool) {
	user, ok := ctx.Value(userContextKey{}).(*domain.User)
	return user, ok
}

// MustUserFromContext returns the authenticated user or panics; for handlers
// mounted strictly behind the auth middleware.
func MustUserFromContext(ctx context.Context) *domain.User {
	user, ok := UserFromContext(ctx)
	if !ok {
		panic("auth middleware is missing on this route")
	}
	return user
}

// requireAuth validates the session cookie, resolves the current user and
// injects it into the request context. Any failure short-circuits with 401.
func requireAuth(auth *authsvc.Service, users domain.UserRepository, opts Options) func(http.Handler) http.Handler {
	cookieName := sessionCookieName(opts.SecureCookies)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(cookieName)
			if err != nil && opts.SecureCookies {
				// Fallback to legacy cookie name during rollout transition if present
				cookie, err = r.Cookie(defaultSessionCookieName)
			}
			if err != nil {
				respondError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			session, err := auth.VerifySession(cookie.Value)
			if err != nil {
				respondDomainError(w, r, err)
				return
			}

			user, err := users.GetByID(r.Context(), session.UserID)
			if err != nil {
				if errors.Is(err, domain.ErrNotFound) {
					respondError(w, http.StatusUnauthorized, "session invalid: user not found")
					return
				}
				respondDomainError(w, r, err)
				return
			}

			if session.Version != user.TokenVersion {
				respondError(w, http.StatusUnauthorized, "session revoked")
				return
			}

			next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userContextKey{}, user)))
		})
	}
}

// verifyOrigin guards state-changing HTTP methods (POST, PUT, PATCH, DELETE)
// against CSRF. Safe methods (GET, HEAD, OPTIONS) pass unconditionally.
func verifyOrigin(opts Options) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet, http.MethodHead, http.MethodOptions:
				next.ServeHTTP(w, r)
				return
			}

			// 1. If Sec-Fetch-Site indicates a cross-site request, categorically reject
			if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
				respondError(w, http.StatusForbidden, "cross-site request rejected")
				return
			}

			// 2. Check Origin or Referer header
			origin := r.Header.Get("Origin")
			if origin == "" {
				if ref := r.Header.Get("Referer"); ref != "" {
					if u, err := url.Parse(ref); err == nil {
						origin = u.Scheme + "://" + u.Host
					}
				}
			}

			if origin == "" {
				// State-changing requests without Origin or Referer are rejected
				// unless accompanied by a custom header that cannot be forged cross-origin
				// without a CORS preflight (e.g. X-Requested-With or X-CSRF-Token).
				if r.Header.Get("X-Requested-With") == "" && r.Header.Get("X-CSRF-Token") == "" {
					respondError(w, http.StatusForbidden, "missing origin header")
					return
				}
			} else if !isAllowedOrigin(origin, opts) {
				respondError(w, http.StatusForbidden, "untrusted request origin")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func isAllowedOrigin(origin string, opts Options) bool {
	if opts.FrontendURL != "" {
		if strings.TrimRight(origin, "/") == strings.TrimRight(opts.FrontendURL, "/") {
			return true
		}
	}
	if !opts.SecureCookies {
		// In development, permit localhost and 127.0.0.1 on any port
		if strings.HasPrefix(origin, "http://localhost:") || origin == "http://localhost" ||
			strings.HasPrefix(origin, "http://127.0.0.1:") || origin == "http://127.0.0.1" {
			return true
		}
	}
	return false
}

// securityHeaders sets baseline defense HTTP headers on all responses.
func securityHeaders(opts Options) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
			if opts.SecureCookies {
				w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
			}
			next.ServeHTTP(w, r)
		})
	}
}
