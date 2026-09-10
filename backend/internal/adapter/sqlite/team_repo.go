package sqlite

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// SQLiteTeamRepo implements domain.TeamRepository on top of SQLite.
type SQLiteTeamRepo struct {
	db *sql.DB
}

var _ domain.TeamRepository = (*SQLiteTeamRepo)(nil)

// NewTeamRepo creates a new team repository.
func NewTeamRepo(db *sql.DB) *SQLiteTeamRepo {
	return &SQLiteTeamRepo{db: db}
}

// Create persists the team and all member slots atomically: either the whole
// team with its roster is stored or nothing is. Slot range and uniqueness are
// enforced by database constraints (CHECK, UNIQUE) and mapped to domain errors.
func (r *SQLiteTeamRepo) Create(ctx context.Context, team *domain.Team, members []domain.TeamMember) error {
	if team.ID == uuid.Nil {
		team.ID = uuid.New()
	}
	now := time.Now()
	if team.CreatedAt.IsZero() {
		team.CreatedAt = now
	}
	if team.UpdatedAt.IsZero() {
		team.UpdatedAt = now
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin team transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO teams (id, user_id, game_account_id, name, description, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?);`,
		team.ID.String(), team.UserID.String(), team.GameAccountID.String(),
		team.Name, nullableString(team.Description),
		formatTime(team.CreatedAt), formatTime(team.UpdatedAt),
	); err != nil {
		if mapped := mapConstraintError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("failed to insert team: %w", err)
	}

	for i := range members {
		member := &members[i]
		if member.ID == uuid.Nil {
			member.ID = uuid.New()
		}
		member.TeamID = team.ID

		if _, err := tx.ExecContext(ctx,
			`INSERT INTO team_members (id, team_id, slot_number, build_id)
			 VALUES (?, ?, ?, ?);`,
			member.ID.String(), team.ID.String(), member.SlotNumber, member.BuildID.String(),
		); err != nil {
			if mapped := mapConstraintError(err); mapped != nil {
				return mapped
			}
			return fmt.Errorf("failed to insert team member slot %d: %w", member.SlotNumber, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit team transaction: %w", err)
	}
	return nil
}

// Update updates team attributes (name, description, updated_at) and replaces
// all member slots atomically in a transaction.
func (r *SQLiteTeamRepo) Update(ctx context.Context, team *domain.Team, members []domain.TeamMember) error {
	now := time.Now()
	team.UpdatedAt = now

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin team update transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	res, err := tx.ExecContext(ctx,
		`UPDATE teams SET name = ?, description = ?, game_account_id = ?, updated_at = ? WHERE id = ?;`,
		team.Name, nullableString(team.Description), team.GameAccountID.String(),
		formatTime(team.UpdatedAt), team.ID.String(),
	)
	if err != nil {
		if mapped := mapConstraintError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("failed to update team: %w", err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: team %s", domain.ErrNotFound, team.ID)
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM team_members WHERE team_id = ?;`, team.ID.String()); err != nil {
		return fmt.Errorf("failed to clear old team members: %w", err)
	}

	for i := range members {
		member := &members[i]
		if member.ID == uuid.Nil {
			member.ID = uuid.New()
		}
		member.TeamID = team.ID

		if _, err := tx.ExecContext(ctx,
			`INSERT INTO team_members (id, team_id, slot_number, build_id)
			 VALUES (?, ?, ?, ?);`,
			member.ID.String(), team.ID.String(), member.SlotNumber, member.BuildID.String(),
		); err != nil {
			if mapped := mapConstraintError(err); mapped != nil {
				return mapped
			}
			return fmt.Errorf("failed to insert team member slot %d: %w", member.SlotNumber, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit team update transaction: %w", err)
	}
	return nil
}

// GetByID returns the team with the given ID or domain.ErrNotFound.
func (r *SQLiteTeamRepo) GetByID(ctx context.Context, id uuid.UUID) (*domain.Team, error) {
	row := r.db.QueryRowContext(ctx,
		`SELECT id, user_id, game_account_id, name, description, created_at, updated_at
		 FROM teams WHERE id = ?;`,
		id.String(),
	)
	return scanTeamRow(row)
}

// GetMembers returns the team roster ordered by slot number.
func (r *SQLiteTeamRepo) GetMembers(ctx context.Context, teamID uuid.UUID) ([]domain.TeamMember, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, team_id, slot_number, build_id FROM team_members WHERE team_id = ? ORDER BY slot_number;`,
		teamID.String(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list team members: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var members []domain.TeamMember
	for rows.Next() {
		var (
			m       domain.TeamMember
			id      string
			teamStr string
			buildID string
		)
		if err := rows.Scan(&id, &teamStr, &m.SlotNumber, &buildID); err != nil {
			return nil, fmt.Errorf("failed to scan team member: %w", err)
		}

		parsedIDs, err := parseUUID3("team member", "id", id, "team_id", teamStr, "build_id", buildID)
		if err != nil {
			return nil, err
		}
		m.ID = parsedIDs[0]
		m.TeamID = parsedIDs[1]
		m.BuildID = parsedIDs[2]
		members = append(members, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate team members: %w", err)
	}
	return members, nil
}

// GetMembersByTeams returns members for multiple teams grouped by team ID.
func (r *SQLiteTeamRepo) GetMembersByTeams(ctx context.Context, teamIDs []uuid.UUID) (map[uuid.UUID][]domain.TeamMember, error) {
	if len(teamIDs) == 0 {
		return make(map[uuid.UUID][]domain.TeamMember), nil
	}

	placeholders := make([]string, len(teamIDs))
	args := make([]any, len(teamIDs))
	for i, id := range teamIDs {
		placeholders[i] = "?"
		args[i] = id.String()
	}

	query := fmt.Sprintf(
		`SELECT id, team_id, slot_number, build_id FROM team_members WHERE team_id IN (%s) ORDER BY team_id, slot_number;`,
		strings.Join(placeholders, ", "),
	)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query team members by teams: %w", err)
	}
	defer func() { _ = rows.Close() }()

	result := make(map[uuid.UUID][]domain.TeamMember, len(teamIDs))
	for rows.Next() {
		var (
			m       domain.TeamMember
			id      string
			teamStr string
			buildID string
		)
		if err := rows.Scan(&id, &teamStr, &m.SlotNumber, &buildID); err != nil {
			return nil, fmt.Errorf("failed to scan team member: %w", err)
		}

		parsedIDs, err := parseUUID3("team member", "id", id, "team_id", teamStr, "build_id", buildID)
		if err != nil {
			return nil, err
		}
		m.ID = parsedIDs[0]
		m.TeamID = parsedIDs[1]
		m.BuildID = parsedIDs[2]
		result[m.TeamID] = append(result[m.TeamID], m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate team members: %w", err)
	}
	return result, nil
}

// ListByAccount returns all teams of the game account, oldest first.
func (r *SQLiteTeamRepo) ListByAccount(ctx context.Context, accountID uuid.UUID) ([]*domain.Team, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, user_id, game_account_id, name, description, created_at, updated_at
		 FROM teams WHERE game_account_id = ? ORDER BY created_at, id;`,
		accountID.String(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to list teams: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var teams []*domain.Team
	for rows.Next() {
		team, err := scanTeamRow(rows)
		if err != nil {
			return nil, err
		}
		teams = append(teams, team)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate teams: %w", err)
	}
	return teams, nil
}

// CountByAccount returns the number of teams created for a game account.
func (r *SQLiteTeamRepo) CountByAccount(ctx context.Context, accountID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM teams WHERE game_account_id = ?;`,
		accountID.String(),
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count teams: %w", err)
	}
	return count, nil
}

// Delete removes the team; its members cascade (ON DELETE CASCADE).
func (r *SQLiteTeamRepo) Delete(ctx context.Context, id uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `DELETE FROM teams WHERE id = ?;`, id.String())
	if err != nil {
		return fmt.Errorf("failed to delete team %s: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return fmt.Errorf("%w: team %s", domain.ErrNotFound, id)
	}
	return nil
}

func scanTeamRow(row rowScanner) (*domain.Team, error) {
	var (
		t         domain.Team
		id        string
		userID    string
		accountID string
		desc      sql.NullString
		createdAt string
		updatedAt string
	)
	if err := row.Scan(&id, &userID, &accountID, &t.Name, &desc, &createdAt, &updatedAt); err != nil {
		return nil, notFound("team", err)
	}

	parsedIDs, err := parseUUID3("team", "id", id, "user_id", userID, "game_account_id", accountID)
	if err != nil {
		return nil, err
	}

	createdAtParsed, err := parseTime(createdAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse team created_at: %w", err)
	}
	updatedAtParsed, err := parseTime(updatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to parse team updated_at: %w", err)
	}

	t.ID = parsedIDs[0]
	t.UserID = parsedIDs[1]
	t.GameAccountID = parsedIDs[2]
	t.Description = nullStringPointer(desc)
	t.CreatedAt = createdAtParsed
	t.UpdatedAt = updatedAtParsed
	return &t, nil
}
