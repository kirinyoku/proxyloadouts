package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoad_Defaults(t *testing.T) {
	// Clear relevant env vars
	_ = os.Unsetenv("PORT")
	_ = os.Unsetenv("ENV")
	_ = os.Unsetenv("DATABASE_PATH")
	_ = os.Unsetenv("DISCORD_CLIENT_ID")
	_ = os.Unsetenv("DISCORD_CLIENT_SECRET")
	_ = os.Unsetenv("DISCORD_REDIRECT_URI")
	_ = os.Unsetenv("SESSION_SECRET")
	_ = os.Unsetenv("FRONTEND_URL")
	_ = os.Unsetenv("SENTRY_DSN")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned unexpected error: %v", err)
	}

	if cfg.Port != "8080" {
		t.Errorf("expected default Port 8080, got %s", cfg.Port)
	}
	if cfg.Env != "development" {
		t.Errorf("expected default Env development, got %s", cfg.Env)
	}
	if cfg.DatabasePath != "./data/proxyloadouts.db" {
		t.Errorf("expected default DatabasePath ./data/proxyloadouts.db, got %s", cfg.DatabasePath)
	}
	if cfg.FrontendURL != "http://localhost:5173" {
		t.Errorf("expected default FrontendURL http://localhost:5173, got %s", cfg.FrontendURL)
	}
	if cfg.SentryDSN != "" {
		t.Errorf("expected default SentryDSN empty, got %s", cfg.SentryDSN)
	}
	if cfg.ShowcaseRateLimit != 20 {
		t.Errorf("expected default ShowcaseRateLimit 20, got %d", cfg.ShowcaseRateLimit)
	}
	if cfg.ShowcaseBurst != 5 {
		t.Errorf("expected default ShowcaseBurst 5, got %d", cfg.ShowcaseBurst)
	}
	if cfg.ProfileCacheMaxItems != 1000 {
		t.Errorf("expected default ProfileCacheMaxItems 1000, got %d", cfg.ProfileCacheMaxItems)
	}
	if cfg.NegativeCacheMaxItems != 5000 {
		t.Errorf("expected default NegativeCacheMaxItems 5000, got %d", cfg.NegativeCacheMaxItems)
	}
}

func TestLoad_CustomEnv(t *testing.T) {
	t.Setenv("PORT", "9090")
	t.Setenv("DATABASE_PATH", "/tmp/test.db")
	t.Setenv("DISCORD_CLIENT_ID", "test_id")
	t.Setenv("DISCORD_CLIENT_SECRET", "test_secret")
	t.Setenv("SHOWCASE_RATE_LIMIT_PER_MINUTE", "30")
	t.Setenv("SHOWCASE_RATE_LIMIT_BURST", "10")
	t.Setenv("PROFILE_CACHE_MAX_ITEMS", "2500")
	t.Setenv("NEGATIVE_CACHE_MAX_ITEMS", "8000")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned unexpected error: %v", err)
	}

	if cfg.Port != "9090" {
		t.Errorf("expected Port 9090, got %s", cfg.Port)
	}
	if cfg.DatabasePath != "/tmp/test.db" {
		t.Errorf("expected DatabasePath /tmp/test.db, got %s", cfg.DatabasePath)
	}
	if cfg.DiscordClientID != "test_id" {
		t.Errorf("expected DiscordClientID test_id, got %s", cfg.DiscordClientID)
	}
	if cfg.DiscordClientSecret != "test_secret" {
		t.Errorf("expected DiscordClientSecret test_secret, got %s", cfg.DiscordClientSecret)
	}
	if cfg.ShowcaseRateLimit != 30 {
		t.Errorf("expected ShowcaseRateLimit 30, got %d", cfg.ShowcaseRateLimit)
	}
	if cfg.ShowcaseBurst != 10 {
		t.Errorf("expected ShowcaseBurst 10, got %d", cfg.ShowcaseBurst)
	}
	if cfg.ProfileCacheMaxItems != 2500 {
		t.Errorf("expected ProfileCacheMaxItems 2500, got %d", cfg.ProfileCacheMaxItems)
	}
	if cfg.NegativeCacheMaxItems != 8000 {
		t.Errorf("expected NegativeCacheMaxItems 8000, got %d", cfg.NegativeCacheMaxItems)
	}
}

func TestLoad_FromEnvFile(t *testing.T) {
	tmpDir := t.TempDir()
	envPath := filepath.Join(tmpDir, ".env")
	envContent := "PORT=7070\nENV=staging\nDATABASE_PATH=./staging.db\n"

	if err := os.WriteFile(envPath, []byte(envContent), 0600); err != nil {
		t.Fatalf("failed to create temp .env file: %v", err)
	}

	cfg, err := Load(envPath)
	if err != nil {
		t.Fatalf("Load(envPath) returned error: %v", err)
	}

	if cfg.Port != "7070" {
		t.Errorf("expected Port 7070, got %s", cfg.Port)
	}
	if cfg.Env != "staging" {
		t.Errorf("expected Env staging, got %s", cfg.Env)
	}
	if cfg.DatabasePath != "./staging.db" {
		t.Errorf("expected DatabasePath ./staging.db, got %s", cfg.DatabasePath)
	}
}

func TestConfig_ValidateProduction(t *testing.T) {
	cfg := &Config{
		Env:                 "production",
		DiscordClientID:     "",
		DiscordClientSecret: "",
		SessionSecret:       "default-dev-secret-change-me",
	}

	if err := cfg.ValidateProduction(); err == nil {
		t.Error("expected error when validating invalid production config, got nil")
	}

	cfg.DiscordClientID = "client-id"
	cfg.DiscordClientSecret = "client-secret"
	cfg.SessionSecret = "strong-random-session-secret"

	if err := cfg.ValidateProduction(); err != nil {
		t.Errorf("expected valid production config, got error: %v", err)
	}
}
