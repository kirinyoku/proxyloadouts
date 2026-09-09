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

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO users (id, discord_id, username, avatar_url, token_version, created_at)
		 VALUES (?, ?, ?, ?, ?, ?);`,
		user.ID.String(), user.DiscordID, user.Username, nullableString(user.AvatarURL), user.TokenVersion, formatTime(user.CreatedAt),
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
		`SELECT id, discord_id, username, avatar_url, token_version, created_at FROM users WHERE id = ?;`,
		id.String(),
	)
	return scanUser(row)
}

// GetByDiscordID returns the user linked to the given Discord identity or domain.ErrNotFound.
func (r *SQLiteUserRepo) GetByDiscordID(ctx context.Context, discordID string) (*domain.User, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT id, discord_id, username, avatar_url, token_version, created_at FROM users WHERE discord_id = ?;`,
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
		u            domain.User
		id           string
		avatar       sql.NullString
		tokenVersion int
		createdAt    string
	)
	if err := row.Scan(&id, &u.DiscordID, &u.Username, &avatar, &tokenVersion, &createdAt); err != nil {
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
	u.CreatedAt = createdAtParsed
	return &u, nil
}
