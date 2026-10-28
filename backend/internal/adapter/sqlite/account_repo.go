package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// SQLiteAccountRepo implements domain.AccountRepository on top of SQLite.
type SQLiteAccountRepo struct {
	db *sql.DB
}

var _ domain.AccountRepository = (*SQLiteAccountRepo)(nil)

// NewAccountRepo creates a new game account repository.
func NewAccountRepo(db *sql.DB) *SQLiteAccountRepo {
	return &SQLiteAccountRepo{db: db}
}

// Create persists a new game account, generating ID and CreatedAt when not set.
func (r *SQLiteAccountRepo) Create(ctx context.Context, account *domain.GameAccount) error {
	if account.ID == uuid.Nil {
		account.ID = uuid.New()
	}
	if account.Region == "" {
		account.Region = domain.DefaultRegion
	}
	if account.CreatedAt.IsZero() {
		account.CreatedAt = time.Now()
	}

	_, err := r.db.ExecContext(ctx,
		`INSERT INTO game_accounts (id, user_id, uid, region, nickname, avatar_url, verified_at, is_public_showcase, show_discord, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		account.ID.String(), account.UserID.String(), account.UID, account.Region,
		nullableString(account.Nickname), nullableString(account.AvatarURL),
		nullableTime(account.VerifiedAt), boolToInt(account.IsPublicShowcase),
		boolToInt(account.ShowDiscord), formatTime(account.CreatedAt),
	)
	if err != nil {
		if mapped := mapConstraintError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("failed to insert game account: %w", err)
	}
	return nil
}

const accountSelect = `SELECT id, user_id, uid, region, nickname, avatar_url, verified_at, is_public_showcase, show_discord, created_at FROM game_accounts`

// GetByID returns the game account with the given ID or domain.ErrNotFound.
func (r *SQLiteAccountRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.GameAccount, error) {
	row := r.db.QueryRowContext(ctx,
		accountSelect+` WHERE id = ?;`,
		id.String(),
	)
	return scanAccountRow(row)
}

// GetByUserAndUID returns the account of the user with the given UID or domain.ErrNotFound.
func (r *SQLiteAccountRepo) GetByUserAndUID(ctx context.Context, userID uuid.UUID, uid string) (*domain.GameAccount, error) {
	row := r.db.QueryRowContext(ctx,
		accountSelect+` WHERE user_id = ? AND uid = ?;`,
		userID.String(), uid,
	)
	return scanAccountRow(row)
}

// ListByUser returns all accounts linked to the user, oldest first.
func (r *SQLiteAccountRepo) ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.GameAccount, error) {
	rows, err := r.db.QueryContext(ctx,
		accountSelect+` WHERE user_id = ? ORDER BY created_at, uid;`,
		userID.String(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list game accounts: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var accounts []*domain.GameAccount
	for rows.Next() {
		account, err := scanAccountRow(rows)
		if err != nil {
			return nil, err
		}
		accounts = append(accounts, account)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate game accounts: %w", err)
	}
	return accounts, nil
}

// CountByUser returns the number of game accounts linked to the user.
func (r *SQLiteAccountRepo) CountByUser(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM game_accounts WHERE user_id = ?;`, userID.String()).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count game accounts: %w", err)
	}
	return count, nil
}

// UpdateProfileMetadata updates the display nickname and avatar URL of a game account.
func (r *SQLiteAccountRepo) UpdateProfileMetadata(ctx context.Context, id uuid.UUID, nickname, avatarURL *string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE game_accounts SET nickname = ?, avatar_url = ? WHERE id = ?;`,
		nullableString(nickname), nullableString(avatarURL), id.String(),
	)
	if err != nil {
		return fmt.Errorf("failed to update profile metadata for account %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: game account %s", domain.ErrNotFound, id)
	}
	return nil
}

// UpdateSettings updates the public showcase visibility and discord visibility for a game account.
func (r *SQLiteAccountRepo) UpdateSettings(ctx context.Context, id uuid.UUID, isPublicShowcase, showDiscord bool) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE game_accounts SET is_public_showcase = ?, show_discord = ? WHERE id = ?;`,
		boolToInt(isPublicShowcase), boolToInt(showDiscord), id.String(),
	)
	if err != nil {
		if mapped := mapConstraintError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("failed to update settings for account %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: game account %s", domain.ErrNotFound, id)
	}
	return nil
}

// VerifyOwnership atomically claims or re-claims verification for accountID and uid,
// resetting any previous verified owner and enabling public showcase for this account.
func (r *SQLiteAccountRepo) VerifyOwnership(ctx context.Context, accountID uuid.UUID, uid string, verifiedAt time.Time, nickname, avatarURL *string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin verification transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// 1. Reset previous verified owner of this UID (Re-claim).
	_, err = tx.ExecContext(ctx,
		`UPDATE game_accounts
		 SET verified_at = NULL, is_public_showcase = 0
		 WHERE uid = ? AND verified_at IS NOT NULL AND id != ?;`,
		uid, accountID.String(),
	)
	if err != nil {
		return fmt.Errorf("failed to reset previous owner for uid %s: %w", uid, err)
	}

	// 2. Set verification and enable public showcase for the new owner.
	res, err := tx.ExecContext(ctx,
		`UPDATE game_accounts
		 SET verified_at = ?, is_public_showcase = 1, nickname = COALESCE(?, nickname), avatar_url = COALESCE(?, avatar_url)
		 WHERE id = ?;`,
		formatTime(verifiedAt), nullableString(nickname), nullableString(avatarURL), accountID.String(),
	)
	if err != nil {
		if mapped := mapConstraintError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("failed to verify ownership for account %s: %w", accountID, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: game account %s", domain.ErrNotFound, accountID)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit verification transaction: %w", err)
	}
	return nil
}

// GetVerifiedByUID returns the verified game account and public owner metadata for the given UID,
// or domain.ErrNotFound if not verified or if the owner is banned.
func (r *SQLiteAccountRepo) GetVerifiedByUID(ctx context.Context, uid string) (*domain.GameAccount, *domain.PublicOwnerInfo, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT ga.id, ga.user_id, ga.uid, ga.region, ga.nickname, ga.avatar_url, ga.verified_at,
		        ga.is_public_showcase, ga.show_discord, ga.created_at,
		        u.username, u.avatar_url
		 FROM game_accounts ga
		 JOIN users u ON u.id = ga.user_id
		 WHERE ga.uid = ? AND ga.verified_at IS NOT NULL AND u.banned_at IS NULL;`,
		uid,
	)

	var (
		a                domain.GameAccount
		id               string
		userID           string
		nickname         sql.NullString
		avatarURL        sql.NullString
		verifiedAt       sql.NullString
		isPublicShowcase int
		showDiscord      int
		createdAt        string
		discordUsername  string
		discordAvatarURL sql.NullString
	)

	if err := row.Scan(
		&id, &userID, &a.UID, &a.Region, &nickname, &avatarURL, &verifiedAt,
		&isPublicShowcase, &showDiscord, &createdAt,
		&discordUsername, &discordAvatarURL,
	); err != nil {
		return nil, nil, notFound("verified game account", err)
	}

	parsedID, err := uuid.Parse(id)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse game account id %q: %w", id, err)
	}
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse user id %q: %w", userID, err)
	}
	createdAtParsed, err := parseTime(createdAt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse game account created_at: %w", err)
	}
	parsedVerifiedAt, err := parseNullableTime(verifiedAt)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse game account verified_at: %w", err)
	}

	a.ID = parsedID
	a.UserID = parsedUserID
	a.Nickname = nullStringPointer(nickname)
	a.AvatarURL = nullStringPointer(avatarURL)
	a.VerifiedAt = parsedVerifiedAt
	a.IsPublicShowcase = isPublicShowcase != 0
	a.ShowDiscord = showDiscord != 0
	a.CreatedAt = createdAtParsed

	owner := scanPublicOwnerInfo(a.UID, a.Region, nickname, avatarURL, verifiedAt, showDiscord, discordUsername, discordAvatarURL)
	return &a, owner, nil
}

// GetPublicOwnerInfoByAccountID returns public owner metadata for the account or domain.ErrNotFound
// if the account does not exist or the owner is banned.
func (r *SQLiteAccountRepo) GetPublicOwnerInfoByAccountID(ctx context.Context, accountID uuid.UUID) (*domain.PublicOwnerInfo, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT ga.uid, ga.region, ga.nickname, ga.avatar_url, ga.verified_at, ga.show_discord,
		        u.username, u.avatar_url
		 FROM game_accounts ga
		 JOIN users u ON u.id = ga.user_id
		 WHERE ga.id = ? AND u.banned_at IS NULL;`,
		accountID.String(),
	)

	var (
		uid              string
		region           string
		nickname         sql.NullString
		avatarURL        sql.NullString
		verifiedAt       sql.NullString
		showDiscord      int
		discordUsername  string
		discordAvatarURL sql.NullString
	)
	if err := row.Scan(&uid, &region, &nickname, &avatarURL, &verifiedAt, &showDiscord, &discordUsername, &discordAvatarURL); err != nil {
		return nil, notFound("game account public owner", err)
	}

	return scanPublicOwnerInfo(uid, region, nickname, avatarURL, verifiedAt, showDiscord, discordUsername, discordAvatarURL), nil
}

// Delete removes the game account and cascades to its builds and teams.
func (r *SQLiteAccountRepo) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM game_accounts WHERE id = ?;`, id.String())
	if err != nil {
		return fmt.Errorf("failed to delete game account %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: game account %s", domain.ErrNotFound, id)
	}
	return nil
}

func scanAccountRow(row rowScanner) (*domain.GameAccount, error) {
	var (
		a                domain.GameAccount
		id               string
		userID           string
		nickname         sql.NullString
		avatarURL        sql.NullString
		verifiedAt       sql.NullString
		isPublicShowcase int
		showDiscord      int
		createdAt        string
	)
	if err := row.Scan(&id, &userID, &a.UID, &a.Region, &nickname, &avatarURL, &verifiedAt, &isPublicShowcase, &showDiscord, &createdAt); err != nil {
		return nil, notFound("game account", err)
	}

	parsedID, err := uuid.Parse(id)
	if err != nil {
		return nil, fmt.Errorf("failed to parse game account id %q: %w", id, err)
	}
	parsedUserID, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("failed to parse user id %q: %w", userID, err)
	}
	createdAtParsed, err := parseTime(createdAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse game account created_at: %w", err)
	}
	parsedVerifiedAt, err := parseNullableTime(verifiedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse game account verified_at: %w", err)
	}

	a.ID = parsedID
	a.UserID = parsedUserID
	a.Nickname = nullStringPointer(nickname)
	a.AvatarURL = nullStringPointer(avatarURL)
	a.VerifiedAt = parsedVerifiedAt
	a.IsPublicShowcase = isPublicShowcase != 0
	a.ShowDiscord = showDiscord != 0
	a.CreatedAt = createdAtParsed
	return &a, nil
}
