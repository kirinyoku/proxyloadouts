package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// SQLiteUserRepo implements domain.UserRepository on top of SQLite.
type SQLiteUserRepo struct {
	db *sql.DB
}

var _ domain.UserRepository = (*SQLiteUserRepo)(nil)

// NewUserRepo creates a new user repository.
func NewUserRepo(db *sql.DB) *SQLiteUserRepo {
	return &SQLiteUserRepo{db: db}
}

// Create persists a new user, generating ID and CreatedAt when not set.
func (r *SQLiteUserRepo) Create(ctx context.Context, user *domain.User) error {
	if user.ID == uuid.Nil {
		user.ID = uuid.New()
	}
	if user.TokenVersion <= 0 {
		user.TokenVersion = 1
	}
	if user.CreatedAt.IsZero() {
		user.CreatedAt = time.Now()
	}

	var bannedAt any
	if user.BannedAt != nil {
		bannedAt = formatTime(*user.BannedAt)
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO users (id, discord_id, username, avatar_url, token_version, custom_max_builds_per_agent, custom_max_teams, banned_at, ban_reason, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		user.ID.String(), user.DiscordID, user.Username, nullableString(user.AvatarURL), user.TokenVersion,
		user.CustomMaxBuildsPerAgent, user.CustomMaxTeams, bannedAt, nullableString(user.BanReason), formatTime(user.CreatedAt),
	)
	if err != nil {
		if mapped := mapConstraintError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("failed to insert user: %w", err)
	}
	return nil
}

// GetByID returns the user with the given ID or domain.ErrNotFound.
func (r *SQLiteUserRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT id, discord_id, username, avatar_url, token_version, custom_max_builds_per_agent, custom_max_teams, banned_at, ban_reason, created_at FROM users WHERE id = ?;`,
		id.String(),
	)
	return scanUser(row)
}

// GetByDiscordID returns the user linked to the given Discord identity or domain.ErrNotFound.
func (r *SQLiteUserRepo) GetByDiscordID(ctx context.Context, discordID string) (*domain.User, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT id, discord_id, username, avatar_url, token_version, custom_max_builds_per_agent, custom_max_teams, banned_at, ban_reason, created_at FROM users WHERE discord_id = ?;`,
		discordID,
	)
	return scanUser(row)
}

// Update refreshes mutable profile fields (username, avatar).
func (r *SQLiteUserRepo) Update(ctx context.Context, user *domain.User) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE users SET username = ?, avatar_url = ? WHERE id = ?;`,
		user.Username, nullableString(user.AvatarURL), user.ID.String(),
	)
	if err != nil {
		return fmt.Errorf("failed to update user %s: %w", user.ID, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: user %s", domain.ErrNotFound, user.ID)
	}
	return nil
}

// UpdateLimits updates the custom per-user limits for builds and teams.
func (r *SQLiteUserRepo) UpdateLimits(ctx context.Context, id uuid.UUID, maxBuilds *int, maxTeams *int) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE users SET custom_max_builds_per_agent = ?, custom_max_teams = ? WHERE id = ?;`,
		maxBuilds, maxTeams, id.String(),
	)
	if err != nil {
		return fmt.Errorf("failed to update user limits %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: user %s", domain.ErrNotFound, id)
	}
	return nil
}

// SetBan sets or clears the ban status for the given user. When banned is true,
// token_version is also incremented to immediately revoke active sessions.
func (r *SQLiteUserRepo) SetBan(ctx context.Context, id uuid.UUID, banned bool, reason *string) error {
	var (
		res sql.Result
		err error
	)
	if banned {
		res, err = r.db.ExecContext(ctx,
			`UPDATE users SET banned_at = ?, ban_reason = ?, token_version = token_version + 1 WHERE id = ?;`,
			formatTime(time.Now()), nullableString(reason), id.String(),
		)
	} else {
		res, err = r.db.ExecContext(ctx,
			`UPDATE users SET banned_at = NULL, ban_reason = NULL WHERE id = ?;`,
			id.String(),
		)
	}
	if err != nil {
		return fmt.Errorf("failed to update ban status for user %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: user %s", domain.ErrNotFound, id)
	}
	return nil
}

// IncrementTokenVersion atomically increments token_version for the given user,
// invalidating all previously issued session cookies.
func (r *SQLiteUserRepo) IncrementTokenVersion(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE users SET token_version = token_version + 1 WHERE id = ?;`,
		id.String(),
	)
	if err != nil {
		return fmt.Errorf("failed to increment token version for user %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: user %s", domain.ErrNotFound, id)
	}
	return nil
}

// Delete removes the user and cascades to accounts, builds and teams.
func (r *SQLiteUserRepo) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM users WHERE id = ?;`, id.String())
	if err != nil {
		return fmt.Errorf("failed to delete user %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: user %s", domain.ErrNotFound, id)
	}
	return nil
}

func scanUser(row *sql.Row) (*domain.User, error) {
	var (
		u                       domain.User
		id                      string
		avatar                  sql.NullString
		tokenVersion            int
		customMaxBuildsPerAgent sql.NullInt64
		customMaxTeams          sql.NullInt64
		bannedAt                sql.NullString
		banReason               sql.NullString
		createdAt               string
	)
	if err := row.Scan(&id, &u.DiscordID, &u.Username, &avatar, &tokenVersion, &customMaxBuildsPerAgent, &customMaxTeams, &bannedAt, &banReason, &createdAt); err != nil {
		return nil, notFound("user", err)
	}

	parsedID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("failed to parse user id %q: %w", id, err)
	}
	createdAtParsed, err := parseTime(createdAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse user created_at: %w", err)
	}

	u.ID = parsedID
	u.AvatarURL = nullStringPointer(avatar)
	u.TokenVersion = tokenVersion
	if customMaxBuildsPerAgent.Valid {
		val := int(customMaxBuildsPerAgent.Int64)
		u.CustomMaxBuildsPerAgent = &val
	}
	if customMaxTeams.Valid {
		val := int(customMaxTeams.Int64)
		u.CustomMaxTeams = &val
	}
	if bannedAt.Valid && bannedAt.String != "" {
		if parsedBan, err := parseTime(bannedAt.String); err == nil {
			u.BannedAt = &parsedBan
		}
	}
	u.BanReason = nullStringPointer(banReason)
	u.CreatedAt = createdAtParsed
	return &u, nil
}
