package adminhttp

import (
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"

	httpadapter "github.com/kirinyoku/proxyloadouts/backend/internal/adapter/http"
	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

//go:embed ui/index.html
var uiAssets embed.FS

// AdminCacheControl abstracts inspection and invalidation of an in-memory LRU/TTL cache.
type AdminCacheControl interface {
	Len() int
	Capacity() int
	Clear()
	Delete(key string)
}

// AdminRateLimiterControl abstracts inspection and reset of an IP rate limiter.
type AdminRateLimiterControl interface {
	Stats() httpadapter.LimiterStats
	Clear()
	DeleteIP(ip string)
}

// AdminAlertTester abstracts sending a diagnostic lifecycle notification to Telegram.
type AdminAlertTester interface {
	Enabled() bool
	NotifyLifecycle(event, details string)
}

// Deps holds dependencies for the internal Admin Dashboard HTTP server.
type Deps struct {
	AdminRepo        *sqlite.SQLiteAdminRepo
	Users            domain.UserRepository
	Accounts         domain.AccountRepository
	Builds           domain.BuildRepository
	Teams            domain.TeamRepository
	ProfileCache     AdminCacheControl
	NegativeCache    AdminCacheControl
	EnrichCache      AdminCacheControl
	ShowcaseLimiter  AdminRateLimiterControl
	AuthLimiter      AdminRateLimiterControl
	TelemetryLimiter AdminRateLimiterControl
	Alerts           AdminAlertTester
	DatabasePath     string
	Env              string
	Release          string
	StartedAt        time.Time
}

// NewRouter builds the HTTP router for the internal Admin Console (:8081).
func NewRouter(deps Deps) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.Compress(5))
	r.Use(middleware.RequestSize(1 << 20)) // 1 MiB body limit

	startedAt := deps.StartedAt
	if startedAt.IsZero() {
		startedAt = time.Now()
	}
	env := deps.Env
	if env == "" {
		env = "development"
	}
	release := deps.Release
	if release == "" {
		release = "local"
	}

	r.Get("/", func(w http.ResponseWriter, r *http.Request) {
		data, err := uiAssets.ReadFile("ui/index.html")
		if err != nil {
			http.Error(w, "failed to read admin UI", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(data)
	})

	r.Get("/api/admin/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{
			"status":         "ok",
			"env":            env,
			"release":        release,
			"uptime_seconds": int(time.Since(startedAt).Seconds()),
		})
	})

	r.Get("/api/admin/stats", func(w http.ResponseWriter, r *http.Request) {
		if deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "admin repository not configured")
			return
		}
		days := 30
		if raw := r.URL.Query().Get("days"); raw != "" {
			if parsed, err := strconv.Atoi(raw); err == nil {
				days = parsed
			}
		}
		stats, err := deps.AdminRepo.GetStats(r.Context(), days)
		if err != nil {
			slog.Error("admin stats failed", "error", err)
			writeError(w, http.StatusInternalServerError, "failed to load admin stats")
			return
		}
		writeJSON(w, http.StatusOK, stats)
	})

	// Stage 2: Users, Quotas & Moderation
	r.Get("/api/admin/users", func(w http.ResponseWriter, r *http.Request) {
		if deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "admin repository not configured")
			return
		}
		limit := parseIntParam(r.URL.Query().Get("limit"), 50)
		offset := parseIntParam(r.URL.Query().Get("offset"), 0)

		res, err := deps.AdminRepo.ListUsers(r.Context(), sqlite.AdminUserFilter{
			Query:  r.URL.Query().Get("q"),
			Filter: r.URL.Query().Get("filter"),
			Limit:  limit,
			Offset: offset,
		})
		if err != nil {
			slog.Error("admin list users failed", "error", err)
			writeError(w, http.StatusInternalServerError, "failed to list users")
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	r.Get("/api/admin/users/{userID}", func(w http.ResponseWriter, r *http.Request) {
		if deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "admin repository not configured")
			return
		}
		userID, ok := parseUUIDParam(w, chi.URLParam(r, "userID"), "userID")
		if !ok {
			return
		}
		detail, err := deps.AdminRepo.GetUserDetail(r.Context(), userID)
		if err != nil {
			writeDomainError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	r.Patch("/api/admin/users/{userID}/limits", func(w http.ResponseWriter, r *http.Request) {
		if deps.Users == nil || deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "user repository not configured")
			return
		}
		userID, ok := parseUUIDParam(w, chi.URLParam(r, "userID"), "userID")
		if !ok {
			return
		}
		var req struct {
			CustomMaxBuildsPerAgent *int `json:"custom_max_builds_per_agent"`
			CustomMaxTeams          *int `json:"custom_max_teams"`
			CustomMaxAccounts       *int `json:"custom_max_accounts"`
		}
		if err := decodeAdminJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		if req.CustomMaxBuildsPerAgent != nil && (*req.CustomMaxBuildsPerAgent < 1 || *req.CustomMaxBuildsPerAgent > 500) {
			writeError(w, http.StatusBadRequest, "custom_max_builds_per_agent must be between 1 and 500 (or null for default)")
			return
		}
		if req.CustomMaxTeams != nil && (*req.CustomMaxTeams < 1 || *req.CustomMaxTeams > 500) {
			writeError(w, http.StatusBadRequest, "custom_max_teams must be between 1 and 500 (or null for default)")
			return
		}
		if req.CustomMaxAccounts != nil && (*req.CustomMaxAccounts < 1 || *req.CustomMaxAccounts > 100) {
			writeError(w, http.StatusBadRequest, "custom_max_accounts must be between 1 and 100 (or null for default)")
			return
		}
		if err := deps.Users.UpdateLimits(r.Context(), userID, req.CustomMaxBuildsPerAgent, req.CustomMaxTeams, req.CustomMaxAccounts); err != nil {
			writeDomainError(w, err)
			return
		}
		detail, err := deps.AdminRepo.GetUserDetail(r.Context(), userID)
		if err != nil {
			writeDomainError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	r.Post("/api/admin/users/{userID}/revoke-sessions", func(w http.ResponseWriter, r *http.Request) {
		if deps.Users == nil || deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "user repository not configured")
			return
		}
		userID, ok := parseUUIDParam(w, chi.URLParam(r, "userID"), "userID")
		if !ok {
			return
		}
		if err := deps.Users.IncrementTokenVersion(r.Context(), userID); err != nil {
			writeDomainError(w, err)
			return
		}
		detail, err := deps.AdminRepo.GetUserDetail(r.Context(), userID)
		if err != nil {
			writeDomainError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	r.Post("/api/admin/users/{userID}/ban", func(w http.ResponseWriter, r *http.Request) {
		if deps.Users == nil || deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "user repository not configured")
			return
		}
		userID, ok := parseUUIDParam(w, chi.URLParam(r, "userID"), "userID")
		if !ok {
			return
		}
		var req struct {
			Banned bool   `json:"banned"`
			Reason string `json:"reason"`
		}
		if err := decodeAdminJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		var reasonPtr *string
		if trimmed := strings.TrimSpace(req.Reason); trimmed != "" {
			reasonPtr = &trimmed
		}
		if err := deps.Users.SetBan(r.Context(), userID, req.Banned, reasonPtr); err != nil {
			writeDomainError(w, err)
			return
		}
		detail, err := deps.AdminRepo.GetUserDetail(r.Context(), userID)
		if err != nil {
			writeDomainError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	r.Delete("/api/admin/users/{userID}", func(w http.ResponseWriter, r *http.Request) {
		if deps.Users == nil {
			writeError(w, http.StatusServiceUnavailable, "user repository not configured")
			return
		}
		userID, ok := parseUUIDParam(w, chi.URLParam(r, "userID"), "userID")
		if !ok {
			return
		}
		if err := deps.Users.Delete(r.Context(), userID); err != nil {
			writeDomainError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	r.Delete("/api/admin/accounts/{accountID}", func(w http.ResponseWriter, r *http.Request) {
		if deps.Accounts == nil {
			writeError(w, http.StatusServiceUnavailable, "account repository not configured")
			return
		}
		accountID, ok := parseUUIDParam(w, chi.URLParam(r, "accountID"), "accountID")
		if !ok {
			return
		}
		if err := deps.Accounts.Delete(r.Context(), accountID); err != nil {
			writeDomainError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	// Stage 3: Content Inspector (Builds & Squads)
	r.Get("/api/admin/builds", func(w http.ResponseWriter, r *http.Request) {
		if deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "admin repository not configured")
			return
		}
		res, err := deps.AdminRepo.ListBuilds(r.Context(), sqlite.AdminBuildFilter{
			Query:   r.URL.Query().Get("q"),
			AgentID: parseIntParam(r.URL.Query().Get("agent_id"), 0),
			Limit:   parseIntParam(r.URL.Query().Get("limit"), 50),
			Offset:  parseIntParam(r.URL.Query().Get("offset"), 0),
		})
		if err != nil {
			slog.Error("admin list builds failed", "error", err)
			writeError(w, http.StatusInternalServerError, "failed to list builds")
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	r.Get("/api/admin/builds/{buildID}", func(w http.ResponseWriter, r *http.Request) {
		if deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "admin repository not configured")
			return
		}
		buildID, ok := parseUUIDParam(w, chi.URLParam(r, "buildID"), "buildID")
		if !ok {
			return
		}
		detail, err := deps.AdminRepo.GetBuildDetail(r.Context(), buildID)
		if err != nil {
			writeDomainError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, detail)
	})

	r.Delete("/api/admin/builds/{buildID}", func(w http.ResponseWriter, r *http.Request) {
		if deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "admin repository not configured")
			return
		}
		buildID, ok := parseUUIDParam(w, chi.URLParam(r, "buildID"), "buildID")
		if !ok {
			return
		}
		force := strings.EqualFold(r.URL.Query().Get("force"), "true") || r.URL.Query().Get("force") == "1"
		if err := deps.AdminRepo.DeleteBuildAdmin(r.Context(), buildID, force); err != nil {
			writeDomainError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	r.Get("/api/admin/teams", func(w http.ResponseWriter, r *http.Request) {
		if deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "admin repository not configured")
			return
		}
		res, err := deps.AdminRepo.ListTeams(r.Context(), sqlite.AdminTeamFilter{
			Query:  r.URL.Query().Get("q"),
			Limit:  parseIntParam(r.URL.Query().Get("limit"), 50),
			Offset: parseIntParam(r.URL.Query().Get("offset"), 0),
		})
		if err != nil {
			slog.Error("admin list teams failed", "error", err)
			writeError(w, http.StatusInternalServerError, "failed to list teams")
			return
		}
		writeJSON(w, http.StatusOK, res)
	})

	r.Delete("/api/admin/teams/{teamID}", func(w http.ResponseWriter, r *http.Request) {
		if deps.Teams == nil {
			writeError(w, http.StatusServiceUnavailable, "team repository not configured")
			return
		}
		teamID, ok := parseUUIDParam(w, chi.URLParam(r, "teamID"), "teamID")
		if !ok {
			return
		}
		if err := deps.Teams.Delete(r.Context(), teamID); err != nil {
			writeDomainError(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})

	// Stage 4: In-Memory Caches & IP Rate Limiters Control
	r.Get("/api/admin/caches", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, buildCachesSnapshot(deps))
	})

	r.Post("/api/admin/caches/purge-uid", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			UID string `json:"uid"`
		}
		if err := decodeAdminJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		uid := strings.TrimSpace(req.UID)
		if uid == "" {
			writeError(w, http.StatusBadRequest, "uid is required")
			return
		}
		key := "showcase:uid:" + uid
		if deps.ProfileCache != nil {
			deps.ProfileCache.Delete(key)
			deps.ProfileCache.Delete(uid)
		}
		if deps.NegativeCache != nil {
			deps.NegativeCache.Delete(key)
			deps.NegativeCache.Delete(uid)
		}
		writeJSON(w, http.StatusOK, buildCachesSnapshot(deps))
	})

	r.Post("/api/admin/caches/flush", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Target string `json:"target"`
		}
		if err := decodeAdminJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		target := strings.ToLower(strings.TrimSpace(req.Target))
		switch target {
		case "profile":
			if deps.ProfileCache != nil {
				deps.ProfileCache.Clear()
			}
		case "negative":
			if deps.NegativeCache != nil {
				deps.NegativeCache.Clear()
			}
		case "enrich":
			if deps.EnrichCache != nil {
				deps.EnrichCache.Clear()
			}
		case "all":
			if deps.ProfileCache != nil {
				deps.ProfileCache.Clear()
			}
			if deps.NegativeCache != nil {
				deps.NegativeCache.Clear()
			}
			if deps.EnrichCache != nil {
				deps.EnrichCache.Clear()
			}
		default:
			writeError(w, http.StatusBadRequest, "invalid cache target: must be profile, negative, enrich, or all")
			return
		}
		writeJSON(w, http.StatusOK, buildCachesSnapshot(deps))
	})

	r.Post("/api/admin/ratelimiters/flush", func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Target string `json:"target"`
			IP     string `json:"ip"`
		}
		if err := decodeAdminJSON(r, &req); err != nil {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		target := strings.ToLower(strings.TrimSpace(req.Target))
		ip := strings.TrimSpace(req.IP)

		applyLimiter := func(lim AdminRateLimiterControl) {
			if lim == nil {
				return
			}
			if ip != "" {
				lim.DeleteIP(ip)
			} else {
				lim.Clear()
			}
		}

		switch target {
		case "showcase":
			applyLimiter(deps.ShowcaseLimiter)
		case "auth":
			applyLimiter(deps.AuthLimiter)
		case "telemetry":
			applyLimiter(deps.TelemetryLimiter)
		case "all":
			applyLimiter(deps.ShowcaseLimiter)
			applyLimiter(deps.AuthLimiter)
			applyLimiter(deps.TelemetryLimiter)
		default:
			writeError(w, http.StatusBadRequest, "invalid rate limiter target: must be showcase, auth, telemetry, or all")
			return
		}
		writeJSON(w, http.StatusOK, buildCachesSnapshot(deps))
	})

	// Stage 5: System Runtime, SQLite Maintenance, Hot Backup & Telegram Diagnostics
	r.Get("/api/admin/system", func(w http.ResponseWriter, r *http.Request) {
		var mem runtime.MemStats
		runtime.ReadMemStats(&mem)

		var sqliteInfo *sqlite.AdminSQLiteInfo
		if deps.AdminRepo != nil {
			info, err := deps.AdminRepo.GetSQLiteInfo(r.Context(), deps.DatabasePath)
			if err != nil {
				slog.Error("admin sqlite info failed", "error", err)
			} else {
				sqliteInfo = info
			}
		}

		tgEnabled := deps.Alerts != nil && deps.Alerts.Enabled()

		writeJSON(w, http.StatusOK, map[string]any{
			"runtime": map[string]any{
				"go_version":       runtime.Version(),
				"os_arch":          runtime.GOOS + "/" + runtime.GOARCH,
				"num_cpu":          runtime.NumCPU(),
				"goroutines":       runtime.NumGoroutine(),
				"heap_alloc_bytes": mem.HeapAlloc,
				"heap_inuse_bytes": mem.HeapInuse,
				"sys_bytes":        mem.Sys,
				"num_gc":           mem.NumGC,
				"uptime_seconds":   int(time.Since(startedAt).Seconds()),
				"env":              env,
				"release":          release,
			},
			"sqlite": sqliteInfo,
			"telegram": map[string]any{
				"enabled": tgEnabled,
			},
		})
	})

	r.Post("/api/admin/sqlite/maintenance", func(w http.ResponseWriter, r *http.Request) {
		if deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "admin repository not configured")
			return
		}
		maint, err := deps.AdminRepo.RunMaintenance(r.Context())
		if err != nil {
			slog.Error("admin sqlite maintenance failed", "error", err)
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		info, _ := deps.AdminRepo.GetSQLiteInfo(r.Context(), deps.DatabasePath)
		writeJSON(w, http.StatusOK, map[string]any{
			"maintenance": maint,
			"sqlite":      info,
		})
	})

	r.Get("/api/admin/sqlite/backup", func(w http.ResponseWriter, r *http.Request) {
		if deps.AdminRepo == nil {
			writeError(w, http.StatusServiceUnavailable, "admin repository not configured")
			return
		}
		tmpDir := os.TempDir()
		filename := fmt.Sprintf("proxyloadouts-backup-%s.db", time.Now().UTC().Format("20060102-150405"))
		tmpPath := filepath.Join(tmpDir, fmt.Sprintf("pl-backup-%d.db", time.Now().UnixNano()))
		defer func() { _ = os.Remove(tmpPath) }()

		if err := deps.AdminRepo.CreateBackup(r.Context(), tmpPath); err != nil {
			slog.Error("admin sqlite backup failed", "error", err)
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}

		f, err := os.Open(tmpPath) //nolint:gosec // controlled temp path
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to open generated backup file")
			return
		}
		defer func() { _ = f.Close() }()

		st, err := f.Stat()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to stat backup file")
			return
		}

		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", filename))
		w.Header().Set("Content-Length", strconv.FormatInt(st.Size(), 10))
		w.Header().Set("Cache-Control", "no-store")
		w.WriteHeader(http.StatusOK)
		_, _ = io.Copy(w, f)
	})

	r.Post("/api/admin/alerts/test", func(w http.ResponseWriter, r *http.Request) {
		if deps.Alerts == nil || !deps.Alerts.Enabled() {
			writeError(w, http.StatusBadRequest, "Telegram alert notifier is not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)")
			return
		}
		var req struct {
			Message string `json:"message"`
		}
		_ = decodeAdminJSON(r, &req)
		msg := strings.TrimSpace(req.Message)
		if msg == "" {
			msg = "Diagnostic test alert triggered from Admin Console (:8081)"
		}
		deps.Alerts.NotifyLifecycle("Admin Console Diagnostic Test", msg)
		writeJSON(w, http.StatusOK, map[string]any{
			"status":  "queued",
			"message": msg,
		})
	})

	return r
}

type adminCacheStat struct {
	Name         string `json:"name"`
	Label        string `json:"label"`
	Size         int    `json:"size"`
	Capacity     int    `json:"capacity"`
	UsagePercent int    `json:"usage_percent"`
}

type adminLimiterStat struct {
	Name          string  `json:"name"`
	Label         string  `json:"label"`
	ActiveIPs     int     `json:"active_ips"`
	MaxEntries    int     `json:"max_entries"`
	RatePerMinute float64 `json:"rate_per_minute"`
	Burst         int     `json:"burst"`
	TTLSeconds    int     `json:"ttl_seconds"`
}

type adminCachesResponse struct {
	Caches       []adminCacheStat   `json:"caches"`
	RateLimiters []adminLimiterStat `json:"rate_limiters"`
}

func buildCachesSnapshot(deps Deps) adminCachesResponse {
	makeCacheStat := func(name, label string, c AdminCacheControl) adminCacheStat {
		if c == nil {
			return adminCacheStat{Name: name, Label: label}
		}
		sz := c.Len()
		capVal := c.Capacity()
		pct := 0
		if capVal > 0 {
			pct = (sz * 100) / capVal
		}
		return adminCacheStat{
			Name:         name,
			Label:        label,
			Size:         sz,
			Capacity:     capVal,
			UsagePercent: pct,
		}
	}

	makeLimStat := func(name, label string, l AdminRateLimiterControl) adminLimiterStat {
		if l == nil {
			return adminLimiterStat{Name: name, Label: label}
		}
		st := l.Stats()
		return adminLimiterStat{
			Name:          name,
			Label:         label,
			ActiveIPs:     st.ActiveIPs,
			MaxEntries:    st.MaxEntries,
			RatePerMinute: st.RatePerMinute,
			Burst:         st.Burst,
			TTLSeconds:    st.TTLSeconds,
		}
	}

	return adminCachesResponse{
		Caches: []adminCacheStat{
			makeCacheStat("profile", "Enka Profile Cache (Raw ZZZ Profiles)", deps.ProfileCache),
			makeCacheStat("negative", "Enka Negative Cache (404 Shield)", deps.NegativeCache),
			makeCacheStat("enrich", "Fairy Build Enrich Cache (Localized Builds)", deps.EnrichCache),
		},
		RateLimiters: []adminLimiterStat{
			makeLimStat("showcase", "Showcase Scanner Rate Limiter (/api/v1/showcase)", deps.ShowcaseLimiter),
			makeLimStat("auth", "Discord OAuth Rate Limiter (/api/v1/auth)", deps.AuthLimiter),
			makeLimStat("telemetry", "Client Error Telemetry Limiter (/api/v1/telemetry)", deps.TelemetryLimiter),
		},
	}
}

func parseIntParam(raw string, def int) int {
	if raw == "" {
		return def
	}
	v, err := strconv.Atoi(raw)
	if err != nil {
		return def
	}
	return v
}

func parseUUIDParam(w http.ResponseWriter, raw string, field string) (uuid.UUID, bool) {
	id, err := uuid.Parse(strings.TrimSpace(raw))
	if err != nil || id == uuid.Nil {
		writeError(w, http.StatusBadRequest, "invalid "+field+" UUID")
		return uuid.Nil, false
	}
	return id, true
}

func decodeAdminJSON(r *http.Request, dst any) error {
	defer func() { _ = r.Body.Close() }()
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	return nil
}

func writeDomainError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, err.Error())
	case errors.Is(err, domain.ErrConflict):
		writeError(w, http.StatusConflict, err.Error())
	case errors.Is(err, domain.ErrInvalidInput):
		writeError(w, http.StatusBadRequest, err.Error())
	default:
		slog.Error("admin endpoint error", "error", err)
		writeError(w, http.StatusInternalServerError, err.Error())
	}
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{
		"error": message,
	})
}
