package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
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
		 weapon_uid, weapon_id, disc_uids, disc_slots, raw_data, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
		build.ID.String(), build.UserID.String(), build.GameAccountID.String(),
		build.AgentID, build.AgentName, build.Name, nullableString(build.Description),
		nullableString(build.WeaponUID), nullableInt(build.WeaponID),
		string(discUIDs), string(discSlots), string(build.RawData),
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
	weapon_uid, weapon_id, disc_uids, disc_slots, raw_data, created_at, updated_at
	FROM agent_builds`

func scanBuildRow(row rowScanner) (*domain.AgentBuild, error) {
	var (
		b           domain.AgentBuild
		id          string
		userID      string
		accountID   string
		description sql.NullString
		weaponUID   sql.NullString
		weaponID    sql.NullInt64
		discUIDs    string
		discSlots   string
		rawData     string
		createdAt   string
		updatedAt   string
	)
	if err := row.Scan(&id, &userID, &accountID, &b.AgentID, &b.AgentName, &b.Name, &description,
		&weaponUID, &weaponID, &discUIDs, &discSlots, &rawData, &createdAt, &updatedAt); err != nil {
		return nil, notFound("agent build", err)
	}

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

	b.ID = parsedIDs[0]
	b.UserID = parsedIDs[1]
	b.GameAccountID = parsedIDs[2]
	b.Description = nullStringPointer(description)
	b.WeaponUID = nullStringPointer(weaponUID)
	b.WeaponID = nullIntPointer(weaponID)
	b.DiscUIDs = discs
	b.DiscSlots = slotsMap
	b.RawData = json.RawMessage(rawData)
	if len(b.DiscSlots) == 0 && len(b.RawData) > 0 {
		b.PopulateDiscSlotsFromRawData()
	}
	b.CreatedAt = createdAtParsed
	b.UpdatedAt = updatedAtParsed
	return &b, nil
}
