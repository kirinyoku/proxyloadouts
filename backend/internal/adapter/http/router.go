package http

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"golang.org/x/time/rate"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/accountsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/authsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// Options holds transport-level settings.
type Options struct {
	// FrontendURL is the allowed CORS origin and OAuth redirect target.
	FrontendURL string
	// SecureCookies marks session cookies Secure (production, HTTPS).
	SecureCookies bool
	// ShowcaseRateLimiter optionally provides the rate limiter for public showcase scans.
	// If nil, a default limiter of 20 req/min with burst 5 is created.
	ShowcaseRateLimiter *IPRateLimiter
	// AuthRateLimiter optionally provides the rate limiter for OAuth2 login, callback, and logout endpoints.
	// If nil, a default limiter of 20 req/min with burst 10 is created.
	AuthRateLimiter *IPRateLimiter
	// TelemetryRateLimiter optionally provides the rate limiter for client error reports.
	// If nil, a default limiter of 60 req/min with burst 3 is created.
	TelemetryRateLimiter *IPRateLimiter
	// PublicReadRateLimiter optionally provides the rate limiter for public build/team endpoints.
	// If nil, a default limiter of 60 req/min with burst 15 is created.
	PublicReadRateLimiter *IPRateLimiter
}

// Pinger verifies database connectivity for health probes.
type Pinger interface {
	PingContext(ctx context.Context) error
}

// Deps wires the application services into the transport layer.
type Deps struct {
	DB       Pinger
	Auth     *authsvc.Service
	Scanner  *scannersvc.Service
	Users    domain.UserRepository
	Accounts *accountsvc.Service
	Builds   *buildsvc.Service
	Teams    *teamsvc.Service
	Alerts   AlertNotifier
}

// NewRouter builds the full HTTP router: middlewares, health checks,
// /api/v1 REST surface and the embedded SPA.
func NewRouter(opts Options, deps Deps) *chi.Mux {
	r := chi.NewRouter()

	r.Use(middleware.RequestID)
	r.Use(SlogRequestLogger(nil))
	r.Use(middleware.Recoverer)
	r.Use(alertMiddleware(deps.Alerts))
	r.Use(securityHeaders(opts))
	r.Use(middleware.RequestSize(1 << 20)) // 1 MiB maximum request body size (Anti-DoS)
	r.Use(middleware.Timeout(60 * time.Second))

	allowedOrigins := []string{opts.FrontendURL}
	if !opts.SecureCookies {
		allowedOrigins = append(allowedOrigins, "http://localhost:*", "http://127.0.0.1:*")
	}

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token", "X-Requested-With"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	health := func(w http.ResponseWriter, r *http.Request) {
		status := "ok"
		dbStatus := "connected"
		statusCode := http.StatusOK

		if deps.DB != nil {
			ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer cancel()

			if err := deps.DB.PingContext(ctx); err != nil {
				status = "degraded"
				dbStatus = "unreachable"
				statusCode = http.StatusServiceUnavailable
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":   status,
			"database": dbStatus,
			"time":     time.Now().UTC().Format(time.RFC3339),
		})
	}
	r.Get("/health", health)

	authHandler := NewAuthHandler(deps.Auth, deps.Users, deps.Accounts, opts)
	showcaseHandler := NewShowcaseHandler(deps.Scanner, deps.Accounts, deps.Builds, deps.Teams)
	accountHandler := NewAccountHandler(deps.Accounts)
	buildHandler := NewBuildHandler(deps.Builds)
	teamHandler := NewTeamHandler(deps.Teams)
	publicHandler := NewPublicHandler(deps.Builds, deps.Teams)
	telemetryHandler := NewTelemetryHandler(deps.Alerts)

	showcaseLimiter := opts.ShowcaseRateLimiter
	if showcaseLimiter == nil {
		showcaseLimiter = NewIPRateLimiter(rate.Limit(20.0/60.0), 5, 10*time.Minute)
	}

	authLimiter := opts.AuthRateLimiter
	if authLimiter == nil {
		authLimiter = NewIPRateLimiter(rate.Limit(20.0/60.0), 10, 10*time.Minute)
	}

	telemetryLimiter := opts.TelemetryRateLimiter
	if telemetryLimiter == nil {
		telemetryLimiter = NewIPRateLimiter(rate.Limit(6.0/60.0), 3, 10*time.Minute)
	}

	publicLimiter := opts.PublicReadRateLimiter
	if publicLimiter == nil {
		publicLimiter = NewIPRateLimiter(rate.Limit(1.0), 15, 10*time.Minute)
	}

	requireAuth := requireAuth(deps.Auth, deps.Users, opts)
	checkOrigin := verifyOrigin(opts)

	r.Route("/api/v1", func(api chi.Router) {
		api.Get("/health", health)
		api.With(checkOrigin, telemetryLimiter.Handler).Post("/telemetry/client-error", telemetryHandler.handleClientError)

		// Public endpoints: guests may scan showcases (SOW §4), view shared builds and teams.
		api.With(authLimiter.Handler).Get("/auth/discord/login", authHandler.handleLogin)
		api.With(authLimiter.Handler).Get("/auth/discord/callback", authHandler.handleCallback)
		api.With(checkOrigin, authLimiter.Handler).Post("/auth/logout", authHandler.handleLogout)
		api.With(showcaseLimiter.Handler).Get("/showcase/{uid}", showcaseHandler.handle)
		api.With(publicLimiter.Handler).Get("/showcase/{uid}/roster", showcaseHandler.handleRoster)

		api.With(publicLimiter.Handler).Get("/public/builds/{buildID}", publicHandler.handleGetBuild)
		api.With(publicLimiter.Handler).Get("/public/teams/{teamID}", publicHandler.handleGetTeam)

		api.With(requireAuth).Get("/auth/me", authHandler.handleMe)

		// Authenticated API surface.
		api.Group(func(private chi.Router) {
			private.Use(requireAuth)
			private.Use(checkOrigin)

			private.Delete("/auth/me", authHandler.handleDeleteMe)

			private.Get("/accounts", accountHandler.handleList)
			private.Post("/accounts", accountHandler.handleCreate)
			private.Patch("/accounts/{accountID}", accountHandler.handleUpdate)
			private.Delete("/accounts/{accountID}", accountHandler.handleDelete)
			private.Post("/accounts/{accountID}/verify/challenge", accountHandler.handleVerifyChallenge)
			private.Post("/accounts/{accountID}/verify/confirm", accountHandler.handleVerifyConfirm)

			private.Get("/builds", buildHandler.handleList)
			private.Post("/builds", buildHandler.handleCreate)
			private.Get("/builds/{buildID}", buildHandler.handleGet)
			private.Patch("/builds/{buildID}", buildHandler.handleUpdate)
			private.Delete("/builds/{buildID}", buildHandler.handleDelete)

			private.Get("/teams", teamHandler.handleList)
			private.Get("/teams/validate", teamHandler.handleValidate)
			private.Post("/teams", teamHandler.handleCreate)
			// Registered before the {teamID} route so the literal segment always
			// wins, keeping "count" from being parsed as a team UUID.
			private.Get("/teams/count", teamHandler.handleCount)
			private.Get("/teams/{teamID}", teamHandler.handleGet)
			private.Put("/teams/{teamID}", teamHandler.handleUpdate)
			private.Delete("/teams/{teamID}", teamHandler.handleDelete)
		})
	})

	// Embedded SPA with history-API fallback and dynamic OpenGraph injection.
	var metaProv PublicMetaProvider
	if deps.Builds != nil || deps.Teams != nil {
		metaProv = &metaProvider{builds: deps.Builds, teams: deps.Teams}
	}
	r.Handle("/*", spaHandler(metaProv))

	return r
}
