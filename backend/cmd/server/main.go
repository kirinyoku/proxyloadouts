package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime/debug"
	"strings"
	"syscall"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	"golang.org/x/time/rate"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/adminhttp"
	discordadapter "github.com/kirinyoku/proxyloadouts/backend/internal/adapter/discord"
	fairyadapter "github.com/kirinyoku/proxyloadouts/backend/internal/adapter/fairy"
	httpadapter "github.com/kirinyoku/proxyloadouts/backend/internal/adapter/http"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/inmemory"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/telegram"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/accountsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/authsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildenrich"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/config"
)

// gitSha is optionally populated at compile time via -ldflags="-X main.gitSha=...".
var gitSha string

func main() {
	if err := run(); err != nil {
		slog.Error("server fatal error", "error", err)
		os.Exit(1)
	}
}

func run() error {
	// 1. Load Configuration
	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("failed to load configuration: %w", err)
	}

	// 2. Initialize Logger with configured level
	var logLevel slog.Level
	switch strings.ToLower(cfg.LogLevel) {
	case "debug":
		logLevel = slog.LevelDebug
	case "warn":
		logLevel = slog.LevelWarn
	case "error":
		logLevel = slog.LevelError
	default:
		logLevel = slog.LevelInfo
	}

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: logLevel,
	}))
	slog.SetDefault(logger)

	slog.Info("configuration loaded",
		"port", cfg.Port,
		"env", cfg.Env,
		"log_level", cfg.LogLevel,
		"db_path", cfg.DatabasePath,
		"frontend_url", cfg.FrontendURL,
		"enka_timeout", cfg.EnkaTimeout.String(),
	)

	if err := cfg.ValidateProduction(); err != nil {
		return fmt.Errorf("invalid production configuration: %w", err)
	}

	// 2.1 Initialize Telegram alert notifier if configured
	release := resolveRelease(cfg.Env)

	alertNotifier := telegram.NewNotifier(telegram.Options{
		BotToken:    cfg.TelegramBotToken,
		ChatID:      cfg.TelegramChatID,
		ThreadID:    cfg.TelegramThreadID,
		Environment: cfg.Env,
		Release:     release,
	})
	defer func() {
		flushCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		if flushErr := alertNotifier.Close(flushCtx); flushErr != nil {
			slog.Warn("telegram alert notifier flush timed out", "error", flushErr)
		}
	}()
	if alertNotifier.Enabled() {
		slog.Info("telegram alert notifier initialized", "env", cfg.Env, "release", release)
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
	startedAt := time.Now()
	users := sqlite.NewUserRepo(db)
	accounts := sqlite.NewAccountRepo(db)
	buildsRepo := sqlite.NewBuildRepo(db)
	teamsRepo := sqlite.NewTeamRepo(db)
	adminRepo := sqlite.NewAdminRepo(db)

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
	accountSvc := accountsvc.New(accounts, accountsvc.WithUsers(users), accountsvc.WithScanner(scanner))

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

	buildSvc := buildsvc.New(buildsRepo, accounts, buildsvc.WithScanner(scanner), buildsvc.WithEnricher(localizer), buildsvc.WithUsers(users))
	teamSvc := teamsvc.New(teamsRepo, buildsRepo, accounts, teamsvc.WithEnricher(localizer), teamsvc.WithUsers(users))
	slog.Info("application services initialized",
		"build_enrich_cache_items", cfg.BuildEnrichMaxItems,
		"build_enrich_cache_ttl", cfg.BuildEnrichTTL.String())

	// 7. Setup Router
	ratePerSec := float64(cfg.ShowcaseRateLimit) / 60.0
	showcaseLimiter := httpadapter.NewIPRateLimiter(rate.Limit(ratePerSec), cfg.ShowcaseBurst, 10*time.Minute)
	defer showcaseLimiter.Close()

	authLimiter := httpadapter.NewIPRateLimiter(rate.Limit(20.0/60.0), 10, 10*time.Minute)
	defer authLimiter.Close()

	telemetryLimiter := httpadapter.NewIPRateLimiter(rate.Limit(6.0/60.0), 3, 10*time.Minute)
	defer telemetryLimiter.Close()

	router := httpadapter.NewRouter(
		httpadapter.Options{
			FrontendURL:          cfg.FrontendURL,
			SecureCookies:        cfg.Env == "production",
			ShowcaseRateLimiter:  showcaseLimiter,
			AuthRateLimiter:      authLimiter,
			TelemetryRateLimiter: telemetryLimiter,
		},
		httpadapter.Deps{
			DB:       db,
			Auth:     authSvc,
			Scanner:  scanner,
			Users:    users,
			Accounts: accountSvc,
			Builds:   buildSvc,
			Teams:    teamSvc,
			Alerts:   alertNotifier,
		},
	)

	// 8. Start HTTP Server (and internal Admin Console if enabled)
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	var adminServer *http.Server
	if cfg.AdminPort != "" && cfg.AdminPort != "0" && !strings.EqualFold(cfg.AdminPort, "off") {
		adminRouter := adminhttp.NewRouter(adminhttp.Deps{
			AdminRepo:        adminRepo,
			Users:            users,
			Accounts:         accounts,
			Builds:           buildsRepo,
			Teams:            teamsRepo,
			ProfileCache:     scanCache,
			NegativeCache:    negCache,
			EnrichCache:      enrichStore,
			ShowcaseLimiter:  showcaseLimiter,
			AuthLimiter:      authLimiter,
			TelemetryLimiter: telemetryLimiter,
			Alerts:           alertNotifier,
			DatabasePath:     cfg.DatabasePath,
			Env:              cfg.Env,
			Release:          release,
			StartedAt:        startedAt,
		})
		adminServer = &http.Server{
			Addr:              ":" + cfg.AdminPort,
			Handler:           adminRouter,
			ReadHeaderTimeout: 5 * time.Second,
			ReadTimeout:       15 * time.Second,
			WriteTimeout:      60 * time.Second,
			IdleTimeout:       60 * time.Second,
		}
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM, syscall.SIGINT)

	serverErrChan := make(chan error, 2)
	go func() {
		slog.Info("HTTP server starting", "port", cfg.Port)
		alertNotifier.NotifyLifecycle("Server Started", "HTTP listener active on port "+cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrChan <- err
		}
	}()

	if adminServer != nil {
		go func() {
			slog.Info("Admin Console HTTP server starting", "admin_port", cfg.AdminPort)
			if err := adminServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
				serverErrChan <- fmt.Errorf("admin server: %w", err)
			}
		}()
	}

	select {
	case sig := <-stopChan:
		slog.Info("shutdown signal received", "signal", sig.String())
		alertNotifier.NotifyLifecycle("Server Stopping", "Signal received: "+sig.String())
	case err := <-serverErrChan:
		alertNotifier.NotifyLifecycle("Server Fatal Error", err.Error())
		return fmt.Errorf("HTTP server error: %w", err)
	}

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if adminServer != nil {
		if err := adminServer.Shutdown(shutdownCtx); err != nil {
			slog.Error("admin server forced to shutdown", "error", err)
		} else {
			slog.Info("admin server gracefully stopped")
		}
	}

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
	} else {
		slog.Info("server gracefully stopped")
	}

	return nil
}

// resolveRelease determines the current build/commit identifier from compile-time
// ldflags, the GIT_SHA environment variable, Go's embedded VCS build info, or the
// local .git directory (when running via `go run` where -buildvcs defaults to false).
func resolveRelease(env string) string {
	for _, candidate := range []string{gitSha, os.Getenv("GIT_SHA")} {
		trimmed := strings.TrimSpace(candidate)
		if trimmed != "" && trimmed != "prod" {
			return trimmed
		}
	}

	if info, ok := debug.ReadBuildInfo(); ok {
		for _, setting := range info.Settings {
			if setting.Key == "vcs.revision" && setting.Value != "" {
				return shortSHA(setting.Value)
			}
		}
	}

	if sha := readGitHeadSHA(); sha != "" {
		return sha
	}

	if strings.TrimSpace(gitSha) != "" && strings.TrimSpace(gitSha) != "prod" {
		return strings.TrimSpace(gitSha)
	}
	if strings.TrimSpace(env) != "" {
		return "proxyloadouts@" + strings.TrimSpace(env)
	}
	return "proxyloadouts@dev"
}

func readGitHeadSHA() string {
	for _, gitDir := range []string{".git", filepath.Join("..", ".git")} {
		headBytes, err := os.ReadFile(filepath.Join(gitDir, "HEAD")) //nolint:gosec // static relative paths to local .git metadata
		if err != nil {
			continue
		}
		head := strings.TrimSpace(string(headBytes))
		if ref, ok := strings.CutPrefix(head, "ref:"); ok {
			refPath := filepath.Join(gitDir, filepath.FromSlash(strings.TrimSpace(ref)))
			if refBytes, err := os.ReadFile(refPath); err == nil { //nolint:gosec // ref path inside local .git directory
				return shortSHA(strings.TrimSpace(string(refBytes)))
			}
			continue
		}
		if len(head) >= 7 {
			return shortSHA(head)
		}
	}
	return ""
}

func shortSHA(sha string) string {
	if len(sha) > 7 {
		return sha[:7]
	}
	return sha
}
