package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// SQLiteBuildRepo implements domain.BuildRepository on top of SQLite.
type SQLiteBuildRepo struct {
	db *sql.DB
}

var _ domain.BuildRepository = (*SQLiteBuildRepo)(nil)

// NewBuildRepo creates a new agent build repository.
func NewBuildRepo(db *sql.DB) *SQLiteBuildRepo {
	return &SQLiteBuildRepo{db: db}
}

// Create persists a new agent build, generating ID and timestamps when not set.
func (r *SQLiteBuildRepo) Create(ctx context.Context, build *domain.AgentBuild) error {
	if build.ID == uuid.Nil {
		build.ID = uuid.New()
	}
	now := time.Now()
	if build.CreatedAt.IsZero() {
		build.CreatedAt = now
	}
	if build.UpdatedAt.IsZero() {
		build.UpdatedAt = now
	}

	discUIDs, err := json.Marshal(build.DiscUIDs)
	if err != nil {
		return fmt.Errorf("failed to marshal disc uids: %w", err)
	}
	if build.DiscUIDs == nil {
		discUIDs = []byte("[]")
	}

	discSlots, err := json.Marshal(build.DiscSlots)
	if err != nil {
		return fmt.Errorf("failed to marshal disc slots: %w", err)
	}
	if build.DiscSlots == nil {
		discSlots = []byte("{}")
	}

	if len(build.RawData) == 0 {
		return fmt.Errorf("%w: raw_data is required", domain.ErrInvalidInput)
	}

	_, err = r.db.ExecContext(ctx,
		`INSERT INTO agent_builds (id, user_id, game_account_id, agent_id, agent_name, name, description,
		 weapon_uid, weapon_id, disc_uids, disc_slots, raw_data, is_public, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		build.ID.String(), build.UserID.String(), build.GameAccountID.String(),
		build.AgentID, build.AgentName, build.Name, nullableString(build.Description),
		nullableString(build.WeaponUID), nullableInt(build.WeaponID),
		string(discUIDs), string(discSlots), string(build.RawData),
		boolToInt(build.IsPublic),
		formatTime(build.CreatedAt), formatTime(build.UpdatedAt),
	)
	if err != nil {
		if mapped := mapConstraintError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("failed to insert agent build: %w", err)
	}
	return nil
}

// GetByID returns the build with the given ID or domain.ErrNotFound.
func (r *SQLiteBuildRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.AgentBuild, error) {
	row := r.db.QueryRowContext(ctx, buildSelect+` WHERE id = ?;`, id.String())
	return scanBuildRow(row)
}

// ListByAccount returns all builds of the game account, oldest first.
func (r *SQLiteBuildRepo) ListByAccount(ctx context.Context, accountID uuid.UUID) ([]*domain.AgentBuild, error) {
	rows, err := r.db.QueryContext(ctx,
		buildSelect+` WHERE game_account_id = ? ORDER BY created_at, id;`,
		accountID.String(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list agent builds: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var builds []*domain.AgentBuild
	for rows.Next() {
		build, err := scanBuildRow(rows)
		if err != nil {
			return nil, err
		}
		builds = append(builds, build)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate agent builds: %w", err)
	}
	return builds, nil
}

// ListPublicByAccount returns all public builds of the game account, oldest first.
func (r *SQLiteBuildRepo) ListPublicByAccount(ctx context.Context, accountID uuid.UUID) ([]*domain.AgentBuild, error) {
	rows, err := r.db.QueryContext(ctx,
		buildSelect+` WHERE game_account_id = ? AND is_public = 1 ORDER BY created_at, id;`,
		accountID.String(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list public agent builds: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var builds []*domain.AgentBuild
	for rows.Next() {
		build, err := scanBuildRow(rows)
		if err != nil {
			return nil, err
		}
		builds = append(builds, build)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate public agent builds: %w", err)
	}
	return builds, nil
}

// HasPublicByAccount reports whether the given account has at least one public build.
func (r *SQLiteBuildRepo) HasPublicByAccount(ctx context.Context, accountID uuid.UUID) (bool, error) {
	var exists int
	err := r.db.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM agent_builds WHERE game_account_id = ? AND is_public = 1);`,
		accountID.String(),
	).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("failed to check public agent builds existence: %w", err)
	}
	return exists == 1, nil
}

// GetByIDs returns a map of builds keyed by their UUIDs for batch fetching.
func (r *SQLiteBuildRepo) GetByIDs(ctx context.Context, ids []uuid.UUID) (map[uuid.UUID]*domain.AgentBuild, error) {
	if len(ids) == 0 {
		return make(map[uuid.UUID]*domain.AgentBuild), nil
	}

	placeholders := make([]string, len(ids))
	args := make([]any, len(ids))
	for i, id := range ids {
		placeholders[i] = "?"
		args[i] = id.String()
	}

	query := fmt.Sprintf(
		`%s WHERE id IN (%s);`,
		buildSelect,
		strings.Join(placeholders, ", "),
	)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query agent builds by IDs: %w", err)
	}
	defer func() { _ = rows.Close() }()

	result := make(map[uuid.UUID]*domain.AgentBuild, len(ids))
	for rows.Next() {
		build, err := scanBuildRow(rows)
		if err != nil {
			return nil, err
		}
		result[build.ID] = build
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate agent builds by IDs: %w", err)
	}
	return result, nil
}

// CountByAccountAndAgent returns the number of builds saved for a specific agent on an account.
func (r *SQLiteBuildRepo) CountByAccountAndAgent(ctx context.Context, accountID uuid.UUID, agentID int) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM agent_builds WHERE game_account_id = ? AND agent_id = ?;`,
		accountID.String(), agentID,
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count agent builds: %w", err)
	}
	return count, nil
}

// UpdateDetails updates the preset name and description of an owned build.
func (r *SQLiteBuildRepo) UpdateDetails(ctx context.Context, id uuid.UUID, name string, description *string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE agent_builds SET name = ?, description = ?, updated_at = ? WHERE id = ?;`,
		name, nullableString(description), formatTime(time.Now()), id.String(),
	)
	if err != nil {
		return fmt.Errorf("failed to update agent build %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: agent build %s", domain.ErrNotFound, id)
	}
	return nil
}

// UpdateName renames the build preset and refreshes its updated_at timestamp.
// The saved equipment payload itself stays immutable (SOW BR-02).
func (r *SQLiteBuildRepo) UpdateName(ctx context.Context, id uuid.UUID, name string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE agent_builds SET name = ?, updated_at = ? WHERE id = ?;`,
		name, formatTime(time.Now()), id.String(),
	)
	if err != nil {
		return fmt.Errorf("failed to rename agent build %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: agent build %s", domain.ErrNotFound, id)
	}
	return nil
}

// UpdateVisibility updates the is_public flag of an agent build without modifying updated_at.
func (r *SQLiteBuildRepo) UpdateVisibility(ctx context.Context, id uuid.UUID, isPublic bool) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE agent_builds SET is_public = ? WHERE id = ?;`,
		boolToInt(isPublic), id.String(),
	)
	if err != nil {
		return fmt.Errorf("failed to update agent build visibility %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: agent build %s", domain.ErrNotFound, id)
	}
	return nil
}

// GetPublicByID returns a public build and its owner info, or domain.ErrNotFound if
// the build does not exist, is private (is_public = 0), or the owner is banned.
func (r *SQLiteBuildRepo) GetPublicByID(ctx context.Context, id uuid.UUID) (*domain.AgentBuild, *domain.PublicOwnerInfo, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT b.id, b.user_id, b.game_account_id, b.agent_id, b.agent_name, b.name, b.description,
		        b.weapon_uid, b.weapon_id, b.disc_uids, b.disc_slots, b.raw_data, b.is_public, b.created_at, b.updated_at,
		        ga.uid, ga.region, ga.nickname, ga.avatar_url, ga.show_discord,
		        u.discord_id, u.username, u.avatar_url
		 FROM agent_builds b
		 JOIN game_accounts ga ON ga.id = b.game_account_id
		 JOIN users u ON u.id = b.user_id
		 WHERE b.id = ? AND b.is_public = 1 AND u.banned_at IS NULL;`,
		id.String(),
	)

	var (
		buildID          string
		userID           string
		accountID        string
		agentID          int
		agentName        string
		name             string
		description      sql.NullString
		weaponUID        sql.NullString
		weaponID         sql.NullInt64
		discUIDs         string
		discSlots        string
		rawData          string
		isPublic         int
		createdAt        string
		updatedAt        string
		ownerUID         string
		ownerRegion      string
		ownerNickname    sql.NullString
		ownerAvatarURL   sql.NullString
		ownerShowDiscord int
		discordID        string
		discordUsername  string
		discordAvatarURL sql.NullString
	)

	if err := row.Scan(
		&buildID, &userID, &accountID, &agentID, &agentName, &name, &description,
		&weaponUID, &weaponID, &discUIDs, &discSlots, &rawData, &isPublic, &createdAt, &updatedAt,
		&ownerUID, &ownerRegion, &ownerNickname, &ownerAvatarURL, &ownerShowDiscord,
		&discordID, &discordUsername, &discordAvatarURL,
	); err != nil {
		return nil, nil, notFound("agent build", err)
	}

	build, err := parseBuildFields(buildID, userID, accountID, agentID, agentName, name, description,
		weaponUID, weaponID, discUIDs, discSlots, rawData, isPublic, createdAt, updatedAt)
	if err != nil {
		return nil, nil, err
	}

	owner := scanPublicOwnerInfo(ownerUID, ownerRegion, ownerNickname, ownerAvatarURL, ownerShowDiscord, discordID, discordUsername, discordAvatarURL)
	return build, owner, nil
}

// Delete removes the build. Deleting a build referenced by a team member fails
// with domain.ErrConflict (ON DELETE RESTRICT at the database level).
func (r *SQLiteBuildRepo) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM agent_builds WHERE id = ?;`, id.String())
	if err != nil {
		if mapped := mapConstraintError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("failed to delete agent build %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: agent build %s", domain.ErrNotFound, id)
	}
	return nil
}

const buildSelect = `SELECT id, user_id, game_account_id, agent_id, agent_name, name, description,
	weapon_uid, weapon_id, disc_uids, disc_slots, raw_data, is_public, created_at, updated_at
	FROM agent_builds`

func scanBuildRow(row rowScanner) (*domain.AgentBuild, error) {
	var (
		id          string
		userID      string
		accountID   string
		agentID     int
		agentName   string
		name        string
		description sql.NullString
		weaponUID   sql.NullString
		weaponID    sql.NullInt64
		discUIDs    string
		discSlots   string
		rawData     string
		isPublic    int
		createdAt   string
		updatedAt   string
	)
	if err := row.Scan(&id, &userID, &accountID, &agentID, &agentName, &name, &description,
		&weaponUID, &weaponID, &discUIDs, &discSlots, &rawData, &isPublic, &createdAt, &updatedAt); err != nil {
		return nil, notFound("agent build", err)
	}

	return parseBuildFields(id, userID, accountID, agentID, agentName, name, description,
		weaponUID, weaponID, discUIDs, discSlots, rawData, isPublic, createdAt, updatedAt)
}

func parseBuildFields(
	id, userID, accountID string,
	agentID int, agentName, name string,
	description, weaponUID sql.NullString,
	weaponID sql.NullInt64,
	discUIDs, discSlots, rawData string,
	isPublic int,
	createdAt, updatedAt string,
) (*domain.AgentBuild, error) {
	parsedIDs, err := parseUUID3("agent build", "id", id, "user_id", userID, "game_account_id", accountID)
	if err != nil {
		return nil, err
	}

	discs := []string{}
	if err := json.Unmarshal([]byte(discUIDs), &discs); err != nil {
		return nil, fmt.Errorf("failed to unmarshal disc uids of build %s: %w", id, err)
	}

	slotsMap := make(map[string]int)
	if discSlots != "" {
		if err := json.Unmarshal([]byte(discSlots), &slotsMap); err != nil {
			return nil, fmt.Errorf("failed to unmarshal disc slots of build %s: %w", id, err)
		}
	}

	createdAtParsed, err := parseTime(createdAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse agent build created_at: %w", err)
	}
	updatedAtParsed, err := parseTime(updatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse agent build updated_at: %w", err)
	}

	b := &domain.AgentBuild{
		ID:            parsedIDs[0],
		UserID:        parsedIDs[1],
		GameAccountID: parsedIDs[2],
		AgentID:       agentID,
		AgentName:     agentName,
		Name:          name,
		Description:   nullStringPointer(description),
		WeaponUID:     nullStringPointer(weaponUID),
		WeaponID:      nullIntPointer(weaponID),
		DiscUIDs:      discs,
		DiscSlots:     slotsMap,
		RawData:       json.RawMessage(rawData),
		IsPublic:      isPublic != 0,
		CreatedAt:     createdAtParsed,
		UpdatedAt:     updatedAtParsed,
	}
	if len(b.DiscSlots) == 0 && len(b.RawData) > 0 {
		b.PopulateDiscSlotsFromRawData()
	}
	return b, nil
}
