package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// AdminWindowedCount holds the total count and recent creation counts for an entity.
type AdminWindowedCount struct {
	Total   int `json:"total"`
	Last24h int `json:"last_24h"`
	Last7d  int `json:"last_7d"`
	Last30d int `json:"last_30d"`
}

// AdminEntityCounts summarizes counts across all primary entities.
type AdminEntityCounts struct {
	Users             AdminWindowedCount `json:"users"`
	Accounts          AdminWindowedCount `json:"accounts"`
	Builds            AdminWindowedCount `json:"builds"`
	Teams             AdminWindowedCount `json:"teams"`
	CustomLimitsUsers int                `json:"custom_limits_users"`
	BannedUsers       int                `json:"banned_users"`
}

// AdminRegionStat holds the number of game accounts in a specific ZZZ server region.
type AdminRegionStat struct {
	Region string `json:"region"`
	Count  int    `json:"count"`
}

// AdminAgentStat holds popularity metrics for an agent across saved builds and teams.
type AdminAgentStat struct {
	AgentID     int    `json:"agent_id"`
	AgentName   string `json:"agent_name"`
	BuildsCount int    `json:"builds_count"`
	TeamsCount  int    `json:"teams_count"`
}

// AdminDailyPoint represents one UTC day of platform creation activity.
type AdminDailyPoint struct {
	Date   string `json:"date"`
	Users  int    `json:"users"`
	Builds int    `json:"builds"`
	Teams  int    `json:"teams"`
}

// AdminDefaultLimits reports the global default limits configured in the domain.
type AdminDefaultLimits struct {
	MaxBuildsPerAgent  int `json:"max_builds_per_agent"`
	MaxTeamsPerAccount int `json:"max_teams_per_account"`
	MaxAccountsPerUser int `json:"max_accounts_per_user"`
}

// AdminStats aggregates platform-wide usage analytics for the Admin Dashboard.
type AdminStats struct {
	GeneratedAt   string             `json:"generated_at"`
	Counts        AdminEntityCounts  `json:"counts"`
	Regions       []AdminRegionStat  `json:"regions"`
	TopAgents     []AdminAgentStat   `json:"top_agents"`
	DailyActivity []AdminDailyPoint  `json:"daily_activity"`
	Defaults      AdminDefaultLimits `json:"defaults"`
}

// SQLiteAdminRepo provides administrative and analytical queries over SQLite.
type SQLiteAdminRepo struct {
	db  *sql.DB
	now func() time.Time
}

// NewAdminRepo creates a new SQLiteAdminRepo.
func NewAdminRepo(db *sql.DB) *SQLiteAdminRepo {
	return &SQLiteAdminRepo{
		db:  db,
		now: time.Now,
	}
}

// GetStats computes platform-wide metrics and a daily activity series covering the last `days` UTC days.
func (r *SQLiteAdminRepo) GetStats(ctx context.Context, days int) (*AdminStats, error) {
	if days < 1 {
		days = 30
	}
	if days > 90 {
		days = 90
	}

	now := r.now().UTC()
	cut24h := formatTime(now.Add(-24 * time.Hour))
	cut7d := formatTime(now.Add(-7 * 24 * time.Hour))
	cut30d := formatTime(now.Add(-30 * 24 * time.Hour))

	var counts AdminEntityCounts
	var err error

	if counts.Users, err = r.queryWindowedCount(ctx, "users", cut24h, cut7d, cut30d); err != nil {
		return nil, err
	}
	if counts.Accounts, err = r.queryWindowedCount(ctx, "game_accounts", cut24h, cut7d, cut30d); err != nil {
		return nil, err
	}
	if counts.Builds, err = r.queryWindowedCount(ctx, "agent_builds", cut24h, cut7d, cut30d); err != nil {
		return nil, err
	}
	if counts.Teams, err = r.queryWindowedCount(ctx, "teams", cut24h, cut7d, cut30d); err != nil {
		return nil, err
	}

	if err := r.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(CASE WHEN custom_max_builds_per_agent IS NOT NULL OR custom_max_teams IS NOT NULL THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN banned_at IS NOT NULL THEN 1 ELSE 0 END), 0)
		FROM users;
	`).Scan(&counts.CustomLimitsUsers, &counts.BannedUsers); err != nil {
		return nil, fmt.Errorf("failed to count custom limit / banned users: %w", err)
	}

	regions, err := r.queryRegions(ctx)
	if err != nil {
		return nil, err
	}

	topAgents, err := r.queryTopAgents(ctx, 10)
	if err != nil {
		return nil, err
	}

	daily, err := r.queryDailySeries(ctx, now, days)
	if err != nil {
		return nil, err
	}

	return &AdminStats{
		GeneratedAt:   now.Format(time.RFC3339),
		Counts:        counts,
		Regions:       regions,
		TopAgents:     topAgents,
		DailyActivity: daily,
		Defaults: AdminDefaultLimits{
			MaxBuildsPerAgent:  domain.MaxBuildsPerAgent,
			MaxTeamsPerAccount: domain.MaxTeamsPerAccount,
			MaxAccountsPerUser: domain.MaxAccountsPerUser,
		},
	}, nil
}

func (r *SQLiteAdminRepo) queryWindowedCount(ctx context.Context, table, cut24h, cut7d, cut30d string) (AdminWindowedCount, error) {
	// Table name is strictly an internal constant ("users", "game_accounts", "agent_builds", "teams").
	query := fmt.Sprintf(`
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0)
		FROM %s;
	`, table)

	var res AdminWindowedCount
	if err := r.db.QueryRowContext(ctx, query, cut24h, cut7d, cut30d).Scan(
		&res.Total, &res.Last24h, &res.Last7d, &res.Last30d,
	); err != nil {
		return AdminWindowedCount{}, fmt.Errorf("failed to query windowed counts for %s: %w", table, err)
	}
	return res, nil
}

func (r *SQLiteAdminRepo) queryRegions(ctx context.Context) ([]AdminRegionStat, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT region, COUNT(*) AS cnt
		FROM game_accounts
		GROUP BY region
		ORDER BY cnt DESC, region ASC;
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to query region distribution: %w", err)
	}
	defer rows.Close()

	byRegion := make(map[string]int)
	for rows.Next() {
		var reg string
		var cnt int
		if err := rows.Scan(&reg, &cnt); err != nil {
			return nil, fmt.Errorf("failed to scan region row: %w", err)
		}
		byRegion[reg] = cnt
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	canonicalRegions := []string{"Europe", "America", "Asia", "TW/HK/MO"}
	result := make([]AdminRegionStat, 0, len(canonicalRegions))
	for _, reg := range canonicalRegions {
		result = append(result, AdminRegionStat{
			Region: reg,
			Count:  byRegion[reg],
		})
	}
	return result, nil
}

func (r *SQLiteAdminRepo) queryTopAgents(ctx context.Context, limit int) ([]AdminAgentStat, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			b.agent_id,
			MAX(b.agent_name) AS agent_name,
			COUNT(DISTINCT b.id) AS builds_count,
			COUNT(tm.id) AS teams_count
		FROM agent_builds b
		LEFT JOIN team_members tm ON tm.build_id = b.id
		GROUP BY b.agent_id
		ORDER BY builds_count DESC, teams_count DESC, b.agent_id ASC
		LIMIT ?;
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query top agents: %w", err)
	}
	defer rows.Close()

	result := make([]AdminAgentStat, 0, limit)
	for rows.Next() {
		var item AdminAgentStat
		if err := rows.Scan(&item.AgentID, &item.AgentName, &item.BuildsCount, &item.TeamsCount); err != nil {
			return nil, fmt.Errorf("failed to scan top agent row: %w", err)
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *SQLiteAdminRepo) queryDailySeries(ctx context.Context, now time.Time, days int) ([]AdminDailyPoint, error) {
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	startDay := today.AddDate(0, 0, -(days - 1))
	startCutoff := startDay.Format("2006-01-02")

	usersByDay, err := r.queryDailyTableCounts(ctx, "users", startCutoff)
	if err != nil {
		return nil, err
	}
	buildsByDay, err := r.queryDailyTableCounts(ctx, "agent_builds", startCutoff)
	if err != nil {
		return nil, err
	}
	teamsByDay, err := r.queryDailyTableCounts(ctx, "teams", startCutoff)
	if err != nil {
		return nil, err
	}

	series := make([]AdminDailyPoint, 0, days)
	for i := range days {
		d := startDay.AddDate(0, 0, i).Format("2006-01-02")
		series = append(series, AdminDailyPoint{
			Date:   d,
			Users:  usersByDay[d],
			Builds: buildsByDay[d],
			Teams:  teamsByDay[d],
		})
	}
	return series, nil
}

func (r *SQLiteAdminRepo) queryDailyTableCounts(ctx context.Context, table, startDate string) (map[string]int, error) {
	query := fmt.Sprintf(`
		SELECT substr(created_at, 1, 10) AS day, COUNT(*)
		FROM %s
		WHERE substr(created_at, 1, 10) >= ?
		GROUP BY day;
	`, table)

	rows, err := r.db.QueryContext(ctx, query, startDate)
	if err != nil {
		return nil, fmt.Errorf("failed to query daily counts for %s: %w", table, err)
	}
	defer rows.Close()

	out := make(map[string]int)
	for rows.Next() {
		var day string
		var count int
		if err := rows.Scan(&day, &count); err != nil {
			return nil, fmt.Errorf("failed to scan daily count for %s: %w", table, err)
		}
		out[day] = count
	}
	return out, rows.Err()
}

// AdminUserFilter defines search and pagination parameters for listing users in the Admin Console.
type AdminUserFilter struct {
	Query  string
	Filter string // "all" (default), "custom_limits", "banned"
	Limit  int
	Offset int
}

// AdminUserSummary represents a user row in the Admin Console together with quota and entity counts.
type AdminUserSummary struct {
	ID                         string   `json:"id"`
	DiscordID                  string   `json:"discord_id"`
	Username                   string   `json:"username"`
	AvatarURL                  *string  `json:"avatar_url"`
	TokenVersion               int      `json:"token_version"`
	CustomMaxBuildsPerAgent    *int     `json:"custom_max_builds_per_agent"`
	CustomMaxTeams             *int     `json:"custom_max_teams"`
	EffectiveMaxBuildsPerAgent int      `json:"effective_max_builds_per_agent"`
	EffectiveMaxTeams          int      `json:"effective_max_teams"`
	BannedAt                   *string  `json:"banned_at"`
	BanReason                  *string  `json:"ban_reason"`
	CreatedAt                  string   `json:"created_at"`
	AccountsCount              int      `json:"accounts_count"`
	BuildsCount                int      `json:"builds_count"`
	TeamsCount                 int      `json:"teams_count"`
	UIDs                       []string `json:"uids"`
}

// AdminUserListResult holds a paginated list of users and total matching count.
type AdminUserListResult struct {
	Total int                `json:"total"`
	Items []AdminUserSummary `json:"items"`
}

// AdminAgentQuotaUsage tracks how many builds a user has saved for a specific agent on an account.
type AdminAgentQuotaUsage struct {
	AgentID     int    `json:"agent_id"`
	AgentName   string `json:"agent_name"`
	BuildsCount int    `json:"builds_count"`
}

// AdminAccountDetail holds detailed metrics for a linked game account.
type AdminAccountDetail struct {
	ID          string                 `json:"id"`
	UID         string                 `json:"uid"`
	Region      string                 `json:"region"`
	CreatedAt   string                 `json:"created_at"`
	BuildsCount int                    `json:"builds_count"`
	TeamsCount  int                    `json:"teams_count"`
	Agents      []AdminAgentQuotaUsage `json:"agents"`
}

// AdminUserDetail holds full user inspection data for the Admin Console drawer.
type AdminUserDetail struct {
	User     AdminUserSummary     `json:"user"`
	Accounts []AdminAccountDetail `json:"accounts"`
}

// ListUsers searches and paginates users with their linked UIDs, entity counts, and quota settings.
func (r *SQLiteAdminRepo) ListUsers(ctx context.Context, f AdminUserFilter) (*AdminUserListResult, error) {
	limit := f.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}

	var conditions []string
	var args []any

	q := strings.TrimSpace(f.Query)
	if q != "" {
		like := "%" + q + "%"
		conditions = append(conditions, `(
			u.username LIKE ? OR
			u.discord_id LIKE ? OR
			u.id LIKE ? OR
			EXISTS (SELECT 1 FROM game_accounts ga WHERE ga.user_id = u.id AND ga.uid LIKE ?)
		)`)
		args = append(args, like, like, like, like)
	}

	switch strings.ToLower(strings.TrimSpace(f.Filter)) {
	case "custom_limits":
		conditions = append(conditions, `(u.custom_max_builds_per_agent IS NOT NULL OR u.custom_max_teams IS NOT NULL)`)
	case "banned":
		conditions = append(conditions, `u.banned_at IS NOT NULL`)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countQuery := fmt.Sprintf(`SELECT COUNT(*) FROM users u %s;`, whereClause)
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count admin users: %w", err)
	}

	listQuery := fmt.Sprintf(`
		SELECT
			u.id,
			u.discord_id,
			u.username,
			u.avatar_url,
			u.token_version,
			u.custom_max_builds_per_agent,
			u.custom_max_teams,
			u.banned_at,
			u.ban_reason,
			u.created_at,
			(SELECT COUNT(*) FROM game_accounts ga WHERE ga.user_id = u.id) AS accounts_count,
			(SELECT COUNT(*) FROM agent_builds ab WHERE ab.user_id = u.id) AS builds_count,
			(SELECT COUNT(*) FROM teams t WHERE t.user_id = u.id) AS teams_count,
			COALESCE((SELECT GROUP_CONCAT(ga.uid, ',') FROM game_accounts ga WHERE ga.user_id = u.id), '') AS uids_csv
		FROM users u
		%s
		ORDER BY u.created_at DESC, u.id ASC
		LIMIT ? OFFSET ?;
	`, whereClause)

	queryArgs := append(append([]any{}, args...), limit, offset)
	rows, err := r.db.QueryContext(ctx, listQuery, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to list admin users: %w", err)
	}
	defer rows.Close()

	items := make([]AdminUserSummary, 0)
	for rows.Next() {
		item, err := scanAdminUserSummary(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &AdminUserListResult{
		Total: total,
		Items: items,
	}, nil
}

// GetUserDetail returns full user metadata and per-account build/team quota breakdowns.
func (r *SQLiteAdminRepo) GetUserDetail(ctx context.Context, userID uuid.UUID) (*AdminUserDetail, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT
			u.id,
			u.discord_id,
			u.username,
			u.avatar_url,
			u.token_version,
			u.custom_max_builds_per_agent,
			u.custom_max_teams,
			u.banned_at,
			u.ban_reason,
			u.created_at,
			(SELECT COUNT(*) FROM game_accounts ga WHERE ga.user_id = u.id) AS accounts_count,
			(SELECT COUNT(*) FROM agent_builds ab WHERE ab.user_id = u.id) AS builds_count,
			(SELECT COUNT(*) FROM teams t WHERE t.user_id = u.id) AS teams_count,
			COALESCE((SELECT GROUP_CONCAT(ga.uid, ',') FROM game_accounts ga WHERE ga.user_id = u.id), '') AS uids_csv
		FROM users u
		WHERE u.id = ?;
	`, userID.String())

	summary, err := scanAdminUserSummary(row)
	if err != nil {
		return nil, notFound("user", err)
	}

	accRows, err := r.db.QueryContext(ctx, `
		SELECT
			ga.id,
			ga.uid,
			ga.region,
			ga.created_at,
			(SELECT COUNT(*) FROM agent_builds ab WHERE ab.game_account_id = ga.id) AS builds_count,
			(SELECT COUNT(*) FROM teams t WHERE t.game_account_id = ga.id) AS teams_count
		FROM game_accounts ga
		WHERE ga.user_id = ?
		ORDER BY ga.created_at ASC, ga.uid ASC;
	`, userID.String())
	if err != nil {
		return nil, fmt.Errorf("failed to query user accounts: %w", err)
	}
	defer accRows.Close()

	accounts := make([]AdminAccountDetail, 0)
	for accRows.Next() {
		var acc AdminAccountDetail
		var createdAtRaw string
		if err := accRows.Scan(&acc.ID, &acc.UID, &acc.Region, &createdAtRaw, &acc.BuildsCount, &acc.TeamsCount); err != nil {
			return nil, fmt.Errorf("failed to scan account detail: %w", err)
		}
		if t, err := parseTime(createdAtRaw); err == nil {
			acc.CreatedAt = t.UTC().Format(time.RFC3339)
		} else {
			acc.CreatedAt = createdAtRaw
		}
		acc.Agents = make([]AdminAgentQuotaUsage, 0)
		accounts = append(accounts, acc)
	}
	if err := accRows.Err(); err != nil {
		return nil, err
	}

	for i := range accounts {
		agRows, err := r.db.QueryContext(ctx, `
			SELECT agent_id, MAX(agent_name) AS agent_name, COUNT(*) AS cnt
			FROM agent_builds
			WHERE game_account_id = ?
			GROUP BY agent_id
			ORDER BY cnt DESC, agent_id ASC;
		`, accounts[i].ID)
		if err != nil {
			return nil, fmt.Errorf("failed to query agent quota usage for account %s: %w", accounts[i].ID, err)
		}
		scanErr := func() error {
			defer agRows.Close()
			for agRows.Next() {
				var ag AdminAgentQuotaUsage
				if err := agRows.Scan(&ag.AgentID, &ag.AgentName, &ag.BuildsCount); err != nil {
					return fmt.Errorf("failed to scan agent quota usage: %w", err)
				}
				accounts[i].Agents = append(accounts[i].Agents, ag)
			}
			return agRows.Err()
		}()
		if scanErr != nil {
			return nil, scanErr
		}
	}

	return &AdminUserDetail{
		User:     summary,
		Accounts: accounts,
	}, nil
}

func scanAdminUserSummary(row rowScanner) (AdminUserSummary, error) {
	var (
		s                       AdminUserSummary
		avatar                  sql.NullString
		customMaxBuildsPerAgent sql.NullInt64
		customMaxTeams          sql.NullInt64
		bannedAt                sql.NullString
		banReason               sql.NullString
		createdAtRaw            string
		uidsCSV                 string
	)
	if err := row.Scan(
		&s.ID,
		&s.DiscordID,
		&s.Username,
		&avatar,
		&s.TokenVersion,
		&customMaxBuildsPerAgent,
		&customMaxTeams,
		&bannedAt,
		&banReason,
		&createdAtRaw,
		&s.AccountsCount,
		&s.BuildsCount,
		&s.TeamsCount,
		&uidsCSV,
	); err != nil {
		return AdminUserSummary{}, err
	}

	s.AvatarURL = nullStringPointer(avatar)
	s.EffectiveMaxBuildsPerAgent = domain.MaxBuildsPerAgent
	if customMaxBuildsPerAgent.Valid && customMaxBuildsPerAgent.Int64 > 0 {
		v := int(customMaxBuildsPerAgent.Int64)
		s.CustomMaxBuildsPerAgent = &v
		s.EffectiveMaxBuildsPerAgent = v
	}
	s.EffectiveMaxTeams = domain.MaxTeamsPerAccount
	if customMaxTeams.Valid && customMaxTeams.Int64 > 0 {
		v := int(customMaxTeams.Int64)
		s.CustomMaxTeams = &v
		s.EffectiveMaxTeams = v
	}
	if bannedAt.Valid && bannedAt.String != "" {
		if t, err := parseTime(bannedAt.String); err == nil {
			iso := t.UTC().Format(time.RFC3339)
			s.BannedAt = &iso
		} else {
			v := bannedAt.String
			s.BannedAt = &v
		}
	}
	s.BanReason = nullStringPointer(banReason)
	if t, err := parseTime(createdAtRaw); err == nil {
		s.CreatedAt = t.UTC().Format(time.RFC3339)
	} else {
		s.CreatedAt = createdAtRaw
	}
	if uidsCSV != "" {
		s.UIDs = strings.Split(uidsCSV, ",")
	} else {
		s.UIDs = []string{}
	}
	return s, nil
}

// =============================================================================
// Stage 3: Content Inspector (Builds & Squads)
// =============================================================================

// AdminBuildFilter defines search and pagination parameters for listing builds in the Admin Console.
type AdminBuildFilter struct {
	Query   string
	AgentID int
	Limit   int
	Offset  int
}

// AdminBuildSummary represents a saved agent build row in the Content Inspector.
type AdminBuildSummary struct {
	ID             string  `json:"id"`
	UserID         string  `json:"user_id"`
	Username       string  `json:"username"`
	GameAccountID  string  `json:"game_account_id"`
	UID            string  `json:"uid"`
	Region         string  `json:"region"`
	AgentID        int     `json:"agent_id"`
	AgentName      string  `json:"agent_name"`
	Name           string  `json:"name"`
	Description    *string `json:"description"`
	WeaponUID      *string `json:"weapon_uid"`
	WeaponID       *int    `json:"weapon_id"`
	DiscCount      int     `json:"disc_count"`
	TeamsUsedCount int     `json:"teams_used_count"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
}

// AdminBuildListResult holds a paginated list of builds and total matching count.
type AdminBuildListResult struct {
	Total int                 `json:"total"`
	Items []AdminBuildSummary `json:"items"`
}

// AdminBuildTeamRef identifies a team that references a given build.
type AdminBuildTeamRef struct {
	TeamID     string `json:"team_id"`
	TeamName   string `json:"team_name"`
	SlotNumber int    `json:"slot_number"`
}

// AdminBuildDetail holds the full inspection payload for a saved agent build including raw Enka JSON.
type AdminBuildDetail struct {
	Build     AdminBuildSummary   `json:"build"`
	DiscUIDs  []string            `json:"disc_uids"`
	DiscSlots map[string]int      `json:"disc_slots"`
	RawData   json.RawMessage     `json:"raw_data"`
	Teams     []AdminBuildTeamRef `json:"teams"`
}

// ListBuilds searches and paginates saved agent builds across all users.
func (r *SQLiteAdminRepo) ListBuilds(ctx context.Context, f AdminBuildFilter) (*AdminBuildListResult, error) {
	limit := f.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}

	var conditions []string
	var args []any

	if f.AgentID > 0 {
		conditions = append(conditions, `b.agent_id = ?`)
		args = append(args, f.AgentID)
	}

	q := strings.TrimSpace(f.Query)
	if q != "" {
		like := "%" + q + "%"
		conditions = append(conditions, `(
			b.name LIKE ? OR
			b.agent_name LIKE ? OR
			b.id LIKE ? OR
			COALESCE(b.weapon_uid, '') LIKE ? OR
			u.username LIKE ? OR
			ga.uid LIKE ?
		)`)
		args = append(args, like, like, like, like, like, like)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM agent_builds b
		JOIN users u ON u.id = b.user_id
		JOIN game_accounts ga ON ga.id = b.game_account_id
		%s;
	`, whereClause)
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count admin builds: %w", err)
	}

	listQuery := fmt.Sprintf(`
		SELECT
			b.id,
			b.user_id,
			u.username,
			b.game_account_id,
			ga.uid,
			ga.region,
			b.agent_id,
			b.agent_name,
			b.name,
			b.description,
			b.weapon_uid,
			b.weapon_id,
			b.disc_uids,
			(SELECT COUNT(*) FROM team_members tm WHERE tm.build_id = b.id) AS teams_used_count,
			b.created_at,
			b.updated_at
		FROM agent_builds b
		JOIN users u ON u.id = b.user_id
		JOIN game_accounts ga ON ga.id = b.game_account_id
		%s
		ORDER BY b.updated_at DESC, b.id ASC
		LIMIT ? OFFSET ?;
	`, whereClause)

	queryArgs := append(append([]any{}, args...), limit, offset)
	rows, err := r.db.QueryContext(ctx, listQuery, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to list admin builds: %w", err)
	}
	defer rows.Close()

	items := make([]AdminBuildSummary, 0)
	for rows.Next() {
		item, _, err := scanAdminBuildSummary(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &AdminBuildListResult{
		Total: total,
		Items: items,
	}, nil
}

// GetBuildDetail returns full build metadata, raw_data JSON, and teams referencing the build.
func (r *SQLiteAdminRepo) GetBuildDetail(ctx context.Context, buildID uuid.UUID) (*AdminBuildDetail, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT
			b.id,
			b.user_id,
			u.username,
			b.game_account_id,
			ga.uid,
			ga.region,
			b.agent_id,
			b.agent_name,
			b.name,
			b.description,
			b.weapon_uid,
			b.weapon_id,
			b.disc_uids,
			(SELECT COUNT(*) FROM team_members tm WHERE tm.build_id = b.id) AS teams_used_count,
			b.created_at,
			b.updated_at,
			b.disc_slots,
			b.raw_data
		FROM agent_builds b
		JOIN users u ON u.id = b.user_id
		JOIN game_accounts ga ON ga.id = b.game_account_id
		WHERE b.id = ?;
	`, buildID.String())

	var (
		s            AdminBuildSummary
		desc         sql.NullString
		weaponUID    sql.NullString
		weaponID     sql.NullInt64
		discUIDsRaw  string
		createdAtRaw string
		updatedAtRaw string
		discSlotsRaw string
		rawDataStr   string
	)
	if err := row.Scan(
		&s.ID, &s.UserID, &s.Username, &s.GameAccountID, &s.UID, &s.Region,
		&s.AgentID, &s.AgentName, &s.Name, &desc, &weaponUID, &weaponID,
		&discUIDsRaw, &s.TeamsUsedCount, &createdAtRaw, &updatedAtRaw,
		&discSlotsRaw, &rawDataStr,
	); err != nil {
		return nil, notFound("agent build", err)
	}

	s.Description = nullStringPointer(desc)
	s.WeaponUID = nullStringPointer(weaponUID)
	s.WeaponID = nullIntPointer(weaponID)
	s.CreatedAt = formatISO(createdAtRaw)
	s.UpdatedAt = formatISO(updatedAtRaw)

	discUIDs := []string{}
	_ = json.Unmarshal([]byte(discUIDsRaw), &discUIDs)
	s.DiscCount = len(discUIDs)

	discSlots := make(map[string]int)
	if discSlotsRaw != "" {
		_ = json.Unmarshal([]byte(discSlotsRaw), &discSlots)
	}

	teamRows, err := r.db.QueryContext(ctx, `
		SELECT t.id, t.name, tm.slot_number
		FROM team_members tm
		JOIN teams t ON t.id = tm.team_id
		WHERE tm.build_id = ?
		ORDER BY t.name ASC, tm.slot_number ASC;
	`, buildID.String())
	if err != nil {
		return nil, fmt.Errorf("failed to query build team references: %w", err)
	}
	defer teamRows.Close()

	teams := make([]AdminBuildTeamRef, 0)
	for teamRows.Next() {
		var ref AdminBuildTeamRef
		if err := teamRows.Scan(&ref.TeamID, &ref.TeamName, &ref.SlotNumber); err != nil {
			return nil, fmt.Errorf("failed to scan build team ref: %w", err)
		}
		teams = append(teams, ref)
	}
	if err := teamRows.Err(); err != nil {
		return nil, err
	}

	raw := json.RawMessage(rawDataStr)
	if !json.Valid(raw) {
		raw = json.RawMessage(`{}`)
	}

	return &AdminBuildDetail{
		Build:     s,
		DiscUIDs:  discUIDs,
		DiscSlots: discSlots,
		RawData:   raw,
		Teams:     teams,
	}, nil
}

// DeleteBuildAdmin deletes a build. When force is true, it first detaches the build from any team slots
// (and deletes any team that becomes empty) inside a transaction.
func (r *SQLiteAdminRepo) DeleteBuildAdmin(ctx context.Context, buildID uuid.UUID, force bool) error {
	if !force {
		res, err := r.db.ExecContext(ctx, `DELETE FROM agent_builds WHERE id = ?;`, buildID.String())
		if err != nil {
			if mapped := mapConstraintError(err); mapped != nil {
				return mapped
			}
			return fmt.Errorf("failed to delete build %s: %w", buildID, err)
		}
		if affected, _ := res.RowsAffected(); affected == 0 {
			return fmt.Errorf("%w: agent build %s", domain.ErrNotFound, buildID)
		}
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin force build delete tx: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, `DELETE FROM team_members WHERE build_id = ?;`, buildID.String()); err != nil {
		return fmt.Errorf("failed to detach build from team members: %w", err)
	}
	// Clean up any teams that now have 0 members
	if _, err := tx.ExecContext(ctx, `
		DELETE FROM teams
		WHERE NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.team_id = teams.id);
	`); err != nil {
		return fmt.Errorf("failed to clean up empty teams: %w", err)
	}

	res, err := tx.ExecContext(ctx, `DELETE FROM agent_builds WHERE id = ?;`, buildID.String())
	if err != nil {
		return fmt.Errorf("failed to delete build %s: %w", buildID, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: agent build %s", domain.ErrNotFound, buildID)
	}

	return tx.Commit()
}

// AdminTeamFilter defines search and pagination parameters for listing teams in the Admin Console.
type AdminTeamFilter struct {
	Query  string
	Limit  int
	Offset int
}

// AdminTeamMemberInfo describes one slot (1..3) inside a team for the Content Inspector.
type AdminTeamMemberInfo struct {
	SlotNumber int     `json:"slot_number"`
	BuildID    string  `json:"build_id"`
	BuildName  string  `json:"build_name"`
	AgentID    int     `json:"agent_id"`
	AgentName  string  `json:"agent_name"`
	WeaponUID  *string `json:"weapon_uid"`
}

// AdminTeamSummary represents a team row in the Content Inspector.
type AdminTeamSummary struct {
	ID            string                `json:"id"`
	UserID        string                `json:"user_id"`
	Username      string                `json:"username"`
	GameAccountID string                `json:"game_account_id"`
	UID           string                `json:"uid"`
	Region        string                `json:"region"`
	Name          string                `json:"name"`
	Description   *string               `json:"description"`
	Members       []AdminTeamMemberInfo `json:"members"`
	CreatedAt     string                `json:"created_at"`
	UpdatedAt     string                `json:"updated_at"`
}

// AdminTeamListResult holds a paginated list of teams and total matching count.
type AdminTeamListResult struct {
	Total int                `json:"total"`
	Items []AdminTeamSummary `json:"items"`
}

// ListTeams searches and paginates saved squads together with their 1..3 member slots.
func (r *SQLiteAdminRepo) ListTeams(ctx context.Context, f AdminTeamFilter) (*AdminTeamListResult, error) {
	limit := f.Limit
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	offset := f.Offset
	if offset < 0 {
		offset = 0
	}

	var conditions []string
	var args []any

	q := strings.TrimSpace(f.Query)
	if q != "" {
		like := "%" + q + "%"
		conditions = append(conditions, `(
			t.name LIKE ? OR
			COALESCE(t.description, '') LIKE ? OR
			t.id LIKE ? OR
			u.username LIKE ? OR
			ga.uid LIKE ? OR
			EXISTS (
				SELECT 1 FROM team_members tm
				JOIN agent_builds ab ON ab.id = tm.build_id
				WHERE tm.team_id = t.id AND (ab.agent_name LIKE ? OR ab.name LIKE ?)
			)
		)`)
		args = append(args, like, like, like, like, like, like, like)
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	var total int
	countQuery := fmt.Sprintf(`
		SELECT COUNT(*)
		FROM teams t
		JOIN users u ON u.id = t.user_id
		JOIN game_accounts ga ON ga.id = t.game_account_id
		%s;
	`, whereClause)
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count admin teams: %w", err)
	}

	listQuery := fmt.Sprintf(`
		SELECT
			t.id,
			t.user_id,
			u.username,
			t.game_account_id,
			ga.uid,
			ga.region,
			t.name,
			t.description,
			t.created_at,
			t.updated_at
		FROM teams t
		JOIN users u ON u.id = t.user_id
		JOIN game_accounts ga ON ga.id = t.game_account_id
		%s
		ORDER BY t.updated_at DESC, t.id ASC
		LIMIT ? OFFSET ?;
	`, whereClause)

	queryArgs := append(append([]any{}, args...), limit, offset)
	rows, err := r.db.QueryContext(ctx, listQuery, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to list admin teams: %w", err)
	}
	defer rows.Close()

	items := make([]AdminTeamSummary, 0)
	teamIndexByID := make(map[string]int)
	var teamIDs []any
	var placeholders []string

	for rows.Next() {
		var (
			item         AdminTeamSummary
			desc         sql.NullString
			createdAtRaw string
			updatedAtRaw string
		)
		if err := rows.Scan(
			&item.ID, &item.UserID, &item.Username, &item.GameAccountID, &item.UID, &item.Region,
			&item.Name, &desc, &createdAtRaw, &updatedAtRaw,
		); err != nil {
			return nil, fmt.Errorf("failed to scan admin team row: %w", err)
		}
		item.Description = nullStringPointer(desc)
		item.CreatedAt = formatISO(createdAtRaw)
		item.UpdatedAt = formatISO(updatedAtRaw)
		item.Members = make([]AdminTeamMemberInfo, 0, 3)

		teamIndexByID[item.ID] = len(items)
		items = append(items, item)
		teamIDs = append(teamIDs, item.ID)
		placeholders = append(placeholders, "?")
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(items) > 0 {
		memQuery := fmt.Sprintf(`
			SELECT
				tm.team_id,
				tm.slot_number,
				b.id,
				b.name,
				b.agent_id,
				b.agent_name,
				b.weapon_uid
			FROM team_members tm
			JOIN agent_builds b ON b.id = tm.build_id
			WHERE tm.team_id IN (%s)
			ORDER BY tm.team_id, tm.slot_number ASC;
		`, strings.Join(placeholders, ", "))

		memRows, err := r.db.QueryContext(ctx, memQuery, teamIDs...)
		if err != nil {
			return nil, fmt.Errorf("failed to query admin team members: %w", err)
		}
		defer memRows.Close()

		for memRows.Next() {
			var (
				teamID    string
				mem       AdminTeamMemberInfo
				weaponUID sql.NullString
			)
			if err := memRows.Scan(
				&teamID, &mem.SlotNumber, &mem.BuildID, &mem.BuildName,
				&mem.AgentID, &mem.AgentName, &weaponUID,
			); err != nil {
				return nil, fmt.Errorf("failed to scan admin team member: %w", err)
			}
			mem.WeaponUID = nullStringPointer(weaponUID)
			if idx, ok := teamIndexByID[teamID]; ok {
				items[idx].Members = append(items[idx].Members, mem)
			}
		}
		if err := memRows.Err(); err != nil {
			return nil, err
		}
	}

	return &AdminTeamListResult{
		Total: total,
		Items: items,
	}, nil
}

func scanAdminBuildSummary(row rowScanner) (AdminBuildSummary, []string, error) {
	var (
		s            AdminBuildSummary
		desc         sql.NullString
		weaponUID    sql.NullString
		weaponID     sql.NullInt64
		discUIDsRaw  string
		createdAtRaw string
		updatedAtRaw string
	)
	if err := row.Scan(
		&s.ID, &s.UserID, &s.Username, &s.GameAccountID, &s.UID, &s.Region,
		&s.AgentID, &s.AgentName, &s.Name, &desc, &weaponUID, &weaponID,
		&discUIDsRaw, &s.TeamsUsedCount, &createdAtRaw, &updatedAtRaw,
	); err != nil {
		return AdminBuildSummary{}, nil, err
	}

	s.Description = nullStringPointer(desc)
	s.WeaponUID = nullStringPointer(weaponUID)
	s.WeaponID = nullIntPointer(weaponID)
	s.CreatedAt = formatISO(createdAtRaw)
	s.UpdatedAt = formatISO(updatedAtRaw)

	discUIDs := []string{}
	_ = json.Unmarshal([]byte(discUIDsRaw), &discUIDs)
	s.DiscCount = len(discUIDs)

	return s, discUIDs, nil
}

func formatISO(raw string) string {
	if t, err := parseTime(raw); err == nil {
		return t.UTC().Format(time.RFC3339)
	}
	return raw
}

// =============================================================================
// Stage 5: System & SQLite Diagnostics, Maintenance & Hot Backup
// =============================================================================

// AdminSQLiteInfo reports SQLite storage metrics, WAL file sizes, and applied schema migrations.
type AdminSQLiteInfo struct {
	DatabasePath      string   `json:"database_path"`
	JournalMode       string   `json:"journal_mode"`
	PageCount         int64    `json:"page_count"`
	PageSize          int64    `json:"page_size"`
	FreelistCount     int64    `json:"freelist_count"`
	LogicalSizeBytes  int64    `json:"logical_size_bytes"`
	DBFileSizeBytes   int64    `json:"db_file_size_bytes"`
	WALFileSizeBytes  int64    `json:"wal_file_size_bytes"`
	SHMFileSizeBytes  int64    `json:"shm_file_size_bytes"`
	AppliedMigrations []string `json:"applied_migrations"`
}

// AdminSQLiteMaintenanceResult reports the outcome of WAL checkpointing and query planner optimization.
type AdminSQLiteMaintenanceResult struct {
	BusyPages         int    `json:"busy_pages"`
	LogPages          int    `json:"log_pages"`
	CheckpointedPages int    `json:"checkpointed_pages"`
	Optimized         bool   `json:"optimized"`
	CompletedAt       string `json:"completed_at"`
}

// GetSQLiteInfo inspects SQLite PRAGMAs, file sizes (.db, -wal, -shm), and applied migrations.
func (r *SQLiteAdminRepo) GetSQLiteInfo(ctx context.Context, dbPath string) (*AdminSQLiteInfo, error) {
	info := &AdminSQLiteInfo{
		DatabasePath:      dbPath,
		AppliedMigrations: []string{},
	}

	_ = r.db.QueryRowContext(ctx, `PRAGMA journal_mode;`).Scan(&info.JournalMode)
	_ = r.db.QueryRowContext(ctx, `PRAGMA page_count;`).Scan(&info.PageCount)
	_ = r.db.QueryRowContext(ctx, `PRAGMA page_size;`).Scan(&info.PageSize)
	_ = r.db.QueryRowContext(ctx, `PRAGMA freelist_count;`).Scan(&info.FreelistCount)
	info.LogicalSizeBytes = info.PageCount * info.PageSize

	if versions, err := AppliedMigrations(ctx, r.db); err == nil && versions != nil {
		info.AppliedMigrations = versions
	}

	if dbPath != "" && dbPath != ":memory:" && !isInMemoryURI(dbPath) {
		basePath := dbPath
		if idx := strings.Index(basePath, "?"); idx != -1 {
			basePath = basePath[:idx]
		}
		if st, err := os.Stat(basePath); err == nil {
			info.DBFileSizeBytes = st.Size()
		}
		if st, err := os.Stat(basePath + "-wal"); err == nil {
			info.WALFileSizeBytes = st.Size()
		}
		if st, err := os.Stat(basePath + "-shm"); err == nil {
			info.SHMFileSizeBytes = st.Size()
		}
	}

	return info, nil
}

// RunMaintenance executes PRAGMA wal_checkpoint(TRUNCATE) and PRAGMA optimize.
func (r *SQLiteAdminRepo) RunMaintenance(ctx context.Context) (*AdminSQLiteMaintenanceResult, error) {
	var res AdminSQLiteMaintenanceResult
	if err := r.db.QueryRowContext(ctx, `PRAGMA wal_checkpoint(TRUNCATE);`).Scan(
		&res.BusyPages, &res.LogPages, &res.CheckpointedPages,
	); err != nil {
		return nil, fmt.Errorf("wal_checkpoint(TRUNCATE) failed: %w", err)
	}
	if _, err := r.db.ExecContext(ctx, `PRAGMA optimize;`); err != nil {
		return nil, fmt.Errorf("PRAGMA optimize failed: %w", err)
	}
	res.Optimized = true
	res.CompletedAt = r.now().UTC().Format(time.RFC3339)
	return &res, nil
}

// CreateBackup creates a consistent hot snapshot of the SQLite database at destPath using VACUUM INTO.
func (r *SQLiteAdminRepo) CreateBackup(ctx context.Context, destPath string) error {
	if strings.TrimSpace(destPath) == "" {
		return errors.New("backup destination path is empty")
	}
	// Remove pre-existing empty temp file because VACUUM INTO requires the target not to exist or be empty.
	_ = os.Remove(destPath)
	if _, err := r.db.ExecContext(ctx, `VACUUM INTO ?;`, destPath); err != nil {
		return fmt.Errorf("VACUUM INTO failed: %w", err)
	}
	return nil
}
