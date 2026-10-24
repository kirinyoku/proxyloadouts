package config

import (
	"errors"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all configuration parameters for the application.
type Config struct {
	Port                  string
	AdminPort             string
	Env                   string
	DatabasePath          string
	DiscordClientID       string
	DiscordClientSecret   string
	DiscordRedirectURI    string
	SessionSecret         string
	FrontendURL           string
	EnkaTimeout           time.Duration
	ShowcaseRateLimit     int
	ShowcaseBurst         int
	ProfileCacheMaxItems  int
	NegativeCacheMaxItems int
	BuildEnrichMaxItems   int
	BuildEnrichTTL        time.Duration
	TelegramBotToken      string
	TelegramChatID        string
	TelegramThreadID      int
	LogLevel              string
}

// Load reads configuration from .env file (if present) and environment variables.
func Load(filenames ...string) (*Config, error) {
	// If specific filenames are provided, load them (erroring if specified file missing).
	// If no filename is provided, try loading default .env silently ignoring missing file.
	if len(filenames) > 0 {
		if err := godotenv.Load(filenames...); err != nil {
			return nil, err
		}
	} else {
		_ = godotenv.Load()
	}

	cfg := &Config{
		Port:                  getEnv("PORT", "8080"),
		AdminPort:             getEnv("ADMIN_PORT", "8081"),
		Env:                   getEnv("ENV", "development"),
		DatabasePath:          getEnv("DATABASE_PATH", "./data/proxyloadouts.db"),
		DiscordClientID:       getEnv("DISCORD_CLIENT_ID", ""),
		DiscordClientSecret:   getEnv("DISCORD_CLIENT_SECRET", ""),
		DiscordRedirectURI:    getEnv("DISCORD_REDIRECT_URI", "http://localhost:8080/api/v1/auth/discord/callback"),
		SessionSecret:         getEnv("SESSION_SECRET", "default-dev-secret-change-me"),
		FrontendURL:           getEnv("FRONTEND_URL", "http://localhost:5173"),
		EnkaTimeout:           time.Duration(getEnvInt("ENKA_TIMEOUT", 15)) * time.Second,
		ShowcaseRateLimit:     getEnvInt("SHOWCASE_RATE_LIMIT_PER_MINUTE", 20),
		ShowcaseBurst:         getEnvInt("SHOWCASE_RATE_LIMIT_BURST", 5),
		ProfileCacheMaxItems:  getEnvInt("PROFILE_CACHE_MAX_ITEMS", 1000),
		NegativeCacheMaxItems: getEnvInt("NEGATIVE_CACHE_MAX_ITEMS", 5000),
		// Localized build payloads are derived from immutable raw_data, so a
		// cached entry can never disagree with the database. The TTL is only a
		// memory bound for builds that are never read again.
		BuildEnrichMaxItems: getEnvInt("BUILD_ENRICH_CACHE_MAX_ITEMS", 2000),
		BuildEnrichTTL:      time.Duration(getEnvInt("BUILD_ENRICH_CACHE_TTL_SECONDS", 900)) * time.Second,
		TelegramBotToken:    getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramChatID:      getEnv("TELEGRAM_CHAT_ID", ""),
		TelegramThreadID:    getEnvInt("TELEGRAM_THREAD_ID", 0),
		LogLevel:            getEnv("LOG_LEVEL", "info"),
	}

	return cfg, nil
}

// ValidateProduction checks that critical secrets and origins are set when running in production.
func (c *Config) ValidateProduction() error {
	if c.Env == "production" {
		if c.DiscordClientID == "" {
			return errors.New("DISCORD_CLIENT_ID is required in production")
		}
		if c.DiscordClientSecret == "" {
			return errors.New("DISCORD_CLIENT_SECRET is required in production")
		}
		if c.SessionSecret == "" || c.SessionSecret == "default-dev-secret-change-me" {
			return errors.New("SESSION_SECRET must be securely configured in production")
		}
		if c.FrontendURL == "" || c.FrontendURL == "http://localhost:5173" || c.FrontendURL == "http://localhost:8080" {
			return errors.New("FRONTEND_URL must be configured to the production origin (not localhost)")
		}
		if c.DiscordRedirectURI == "" || c.DiscordRedirectURI == "http://localhost:8080/api/v1/auth/discord/callback" {
			return errors.New("DISCORD_REDIRECT_URI must be configured to the production callback URL (not localhost)")
		}
	}
	return nil
}

func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

func getEnvInt(key string, defaultVal int) int {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		if parsed, err := strconv.Atoi(val); err == nil && parsed > 0 {
			return parsed
		}
	}
	return defaultVal
}
