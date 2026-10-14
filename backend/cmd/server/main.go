package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	"golang.org/x/time/rate"

	discordadapter "github.com/kirinyoku/proxyloadouts/backend/internal/adapter/discord"
	fairyadapter "github.com/kirinyoku/proxyloadouts/backend/internal/adapter/fairy"
	httpadapter "github.com/kirinyoku/proxyloadouts/backend/internal/adapter/http"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/inmemory"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/accountsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/authsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildenrich"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/config"
)

func main() {
	if err := run(); err != nil {
		slog.Error("server fatal error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	// 1. Initialize Logger
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	// 2. Load Configuration
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	slog.Info("configuration loaded",
		"port", cfg.Port,
		"env", cfg.Env,
		"db_path", cfg.DatabasePath,
		"frontend_url", cfg.FrontendURL,
		"enka_timeout", cfg.EnkaTimeout.String(),
	)

	if err := cfg.ValidateProduction(); err != nil {
		return fmt.Errorf("invalid production configuration: %w", err)
	}

	// 2.1 Initialize Sentry if configured
	if cfg.SentryDSN != "" {
		if err := sentry.Init(sentry.ClientOptions{
			Dsn:              cfg.SentryDSN,
			Environment:      cfg.Env,
			TracesSampleRate: 0.2,
		}); err != nil {
			slog.Warn("failed to initialize sentry", "error", err)
		} else {
			slog.Info("sentry error monitoring initialized", "env", cfg.Env)
			defer sentry.Flush(2 * time.Second)
		}
	}

	if cfg.DiscordClientID == "" || cfg.DiscordClientSecret == "" {
		slog.Warn("discord oauth is not configured; /api/v1/auth endpoints will not work",
			"hint", "set DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET in .env")
	}

	// 3. Connect to SQLite and apply migrations
	db, err := sqlite.NewDB(cfg.DatabasePath)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer func() {
		if closeErr := db.Close(); closeErr != nil {
			slog.Error("error closing database", "error", closeErr)
		}
	}()
	if err := sqlite.Migrate(context.Background(), db); err != nil {
		return fmt.Errorf("failed to apply database migrations: %w", err)
	}
	slog.Info("sqlite database connected and migrated")

	// 4. Initialize repositories
	users := sqlite.NewUserRepo(db)
	accounts := sqlite.NewAccountRepo(db)
	buildsRepo := sqlite.NewBuildRepo(db)
	teamsRepo := sqlite.NewTeamRepo(db)

	// 5. Initialize fairy adapter and Scanner Service
	fairyClient, err := fairyadapter.NewClient(fairyadapter.Options{
		Timeout:   cfg.EnkaTimeout,
		UserAgent: "proxyloadouts/0.1",
	})
	if err != nil {
		return fmt.Errorf("failed to initialize fairy client: %w", err)
	}

	scanCache := inmemory.NewProfileCache[*zzz.Profile](cfg.ProfileCacheMaxItems, 5*time.Minute)
	defer scanCache.Close()

	negCache := inmemory.NewNegativeCache(cfg.NegativeCacheMaxItems, time.Minute)
	defer negCache.Close()

	scanner := scannersvc.New(fairyClient, scanCache, scannersvc.Options{
		NegativeCache: negCache,
		NegativeTTL:   60 * time.Second,
	})

	// 6. Initialize Discord adapter and application services
	discordClient := discordadapter.NewClient(discordadapter.Options{
		ClientID:     cfg.DiscordClientID,
		ClientSecret: cfg.DiscordClientSecret,
		RedirectURI:  cfg.DiscordRedirectURI,
	})

	authSvc, err := authsvc.New(users, discordClient, authsvc.Options{
		SessionSecret: cfg.SessionSecret,
	})
	if err != nil {
		return fmt.Errorf("failed to initialize auth service: %w", err)
	}
	accountSvc := accountsvc.New(accounts)

	// Localizing a build is pure but expensive (the fairy SDK rebuilds the full
	// agent from the game catalog). Both buildsvc and teamsvc need it on every
	// list response, so wrap the scanner once in a memoizing localizer shared by
	// them: a repeated request for the same build and language is then served
	// from memory instead of re-running enrichment per build.
	enrichStore := inmemory.NewSingleflightService[buildenrich.Localized](
		cfg.BuildEnrichMaxItems, time.Minute)
	defer enrichStore.Close()

	localizer := buildenrich.New(scanner, func(
		ctx context.Context,
		key string,
		compute func(context.Context) (buildenrich.Localized, time.Duration, error),
	) (buildenrich.Localized, error) {
		return inmemory.GetOrFetchValue(ctx, enrichStore, key, cfg.BuildEnrichTTL, compute)
	}, cfg.BuildEnrichTTL)

	buildSvc := buildsvc.New(buildsRepo, accounts, buildsvc.WithScanner(scanner), buildsvc.WithEnricher(localizer))
	teamSvc := teamsvc.New(teamsRepo, buildsRepo, accounts, teamsvc.WithEnricher(localizer))
	slog.Info("application services initialized",
		"build_enrich_cache_items", cfg.BuildEnrichMaxItems,
		"build_enrich_cache_ttl", cfg.BuildEnrichTTL.String())

	// 7. Setup Router
	ratePerSec := float64(cfg.ShowcaseRateLimit) / 60.0
	showcaseLimiter := httpadapter.NewIPRateLimiter(rate.Limit(ratePerSec), cfg.ShowcaseBurst, 10*time.Minute)
	defer showcaseLimiter.Close()

	router := httpadapter.NewRouter(
		httpadapter.Options{
			FrontendURL:         cfg.FrontendURL,
			SecureCookies:       cfg.Env == "production",
			ShowcaseRateLimiter: showcaseLimiter,
		},
		httpadapter.Deps{
			DB:       db,
			Auth:     authSvc,
			Scanner:  scanner,
			Users:    users,
			Accounts: accountSvc,
			Builds:   buildSvc,
			Teams:    teamSvc,
		},
	)

	// 8. Start HTTP Server
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	serverErrChan := make(chan error, 1)
	go func() {
		slog.Info("HTTP server starting", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrChan <- err
		}
	}()

	select {
	case sig := <-stopChan:
		slog.Info("shutdown signal received", "signal", sig.String())
	case err := <-serverErrChan:
		return fmt.Errorf("HTTP server error: %w", err)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	} else {
		slog.Info("server gracefully stopped")
	}

	return nil
}
