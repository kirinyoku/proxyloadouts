package sqlite

import (
	"context"
	"database/sql"
	"path/filepath"
	"strings"
	"testing"
)

func newMigratedTestDB(t *testing.T) *sql.DB {
	t.Helper()

	// Use a temp file instead of :memory: so every pooled connection sees
	// the same migrated schema.
	db, err := NewDB(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	if err := Migrate(context.Background(), db); err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}
	return db
}

func objectExists(t *testing.T, db *sql.DB, objType, name string) bool {
	t.Helper()

	var count int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM sqlite_master WHERE type = ? AND name = ?;`, objType, name,
	).Scan(&count); err != nil {
		t.Fatalf("failed to query sqlite_master for %s %q: %v", objType, name, err)
	}
	return count > 0
}

func TestMigrate_NilDB(t *testing.T) {
	if err := Migrate(context.Background(), nil); err == nil {
		t.Error("expected error for nil db, got nil")
	}
}

func TestMigrate_CreatesSchema(t *testing.T) {
	db := newMigratedTestDB(t)

	tables := []string{
		"users",
		"game_accounts",
		"agent_builds",
		"teams",
		"team_members",
	}
	for _, table := range tables {
		if !objectExists(t, db, "table", table) {
			t.Errorf("expected table %q to exist", table)
		}
	}

	indexes := []string{
		"idx_game_accounts_user",
		"idx_agent_builds_account_agent",
		"idx_agent_builds_user",
		"idx_teams_account",
		"idx_team_members_team",
		"idx_team_members_build",
		"idx_game_accounts_verified_uid",
		"idx_agent_builds_public_account",
		"idx_teams_public_account",
	}
	for _, index := range indexes {
		if !objectExists(t, db, "index", index) {
			t.Errorf("expected index %q to exist", index)
		}
	}
}

func TestMigrate_RecordsVersions(t *testing.T) {
	db := newMigratedTestDB(t)

	versions, err := AppliedMigrations(context.Background(), db)
	if err != nil {
		t.Fatalf("failed to list applied migrations: %v", err)
	}

	if len(versions) < 1 {
		t.Fatalf("expected applied migrations, got %d: %v", len(versions), versions)
	}
	if versions[0] != "001_init.sql" {
		t.Errorf("expected first version 001_init.sql, got %s", versions[0])
	}
}

func TestMigrate_Idempotent(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	// Insert data between runs to verify re-running does not drop or recreate anything.
	if _, err := db.Exec(
		`INSERT INTO users (id, discord_id, username) VALUES ('u1', 'discord-1', 'kirin');`,
	); err != nil {
		t.Fatalf("failed to insert user: %v", err)
	}

	if err := Migrate(ctx, db); err != nil {
		t.Fatalf("expected second migration run to succeed, got error: %v", err)
	}

	var versions int
	if err := db.QueryRow(`SELECT COUNT(*) FROM schema_migrations;`).Scan(&versions); err != nil {
		t.Fatalf("failed to count schema_migrations rows: %v", err)
	}
	if versions < 1 {
		t.Errorf("expected recorded migrations after re-run, got %d", versions)
	}

	var username string
	if err := db.QueryRow(`SELECT username FROM users WHERE id = 'u1';`).Scan(&username); err != nil {
		t.Fatalf("expected inserted user to survive re-migration: %v", err)
	}
	if username != "kirin" {
		t.Errorf("expected username kirin, got %s", username)
	}
}

func TestMigrate_InsertChain(t *testing.T) {
	db := newMigratedTestDB(t)

	inserts := []string{
		`INSERT INTO users (id, discord_id, username) VALUES ('u1', 'discord-1', 'kirin');`,
		`INSERT INTO game_accounts (id, user_id, uid, region) VALUES ('g1', 'u1', '1504687050', 'Europe');`,
		`INSERT INTO agent_builds (id, user_id, game_account_id, agent_id, agent_name, name, weapon_uid, weapon_id, disc_uids, raw_data)
		 VALUES ('b1', 'u1', 'g1', 1511, 'Miyabi', 'Anomaly Main', '1511_9903502', 14109, '["33041_12345678"]', '{}');`,
		`INSERT INTO teams (id, user_id, game_account_id, name, description) VALUES ('t1', 'u1', 'g1', 'Ice Mono', 'Shiyu 7');`,
		`INSERT INTO team_members (id, team_id, slot_number, build_id) VALUES ('m1', 't1', 1, 'b1');`,
	}
	for _, query := range inserts {
		if _, err := db.Exec(query); err != nil {
			t.Fatalf("insert failed: %v\nquery: %s", err, query)
		}
	}

	var members int
	if err := db.QueryRow(`SELECT COUNT(*) FROM team_members WHERE team_id = 't1';`).Scan(&members); err != nil {
		t.Fatalf("failed to count team members: %v", err)
	}
	if members != 1 {
		t.Errorf("expected 1 team member, got %d", members)
	}
}

func TestMigrate_SlotConstraints(t *testing.T) {
	db := newMigratedTestDB(t)

	seed := []string{
		`INSERT INTO users (id, discord_id, username) VALUES ('u1', 'discord-1', 'kirin');`,
		`INSERT INTO game_accounts (id, user_id, uid) VALUES ('g1', 'u1', '1504687050');`,
		`INSERT INTO agent_builds (id, user_id, game_account_id, agent_id, agent_name, name, disc_uids, raw_data)
		 VALUES ('b1', 'u1', 'g1', 1511, 'Miyabi', 'Main', '[]', '{}');`,
		`INSERT INTO teams (id, user_id, game_account_id, name) VALUES ('t1', 'u1', 'g1', 'Ice Mono');`,
		`INSERT INTO team_members (id, team_id, slot_number, build_id) VALUES ('m1', 't1', 1, 'b1');`,
	}
	for _, query := range seed {
		if _, err := db.Exec(query); err != nil {
			t.Fatalf("seed insert failed: %v\nquery: %s", err, query)
		}
	}

	// CHECK (slot_number BETWEEN 1 AND 3)
	if _, err := db.Exec(
		`INSERT INTO team_members (id, team_id, slot_number, build_id) VALUES ('m2', 't1', 4, 'b1');`,
	); err == nil {
		t.Error("expected slot_number = 4 to violate CHECK constraint")
	}

	// UNIQUE(team_id, slot_number)
	if _, err := db.Exec(
		`INSERT INTO team_members (id, team_id, slot_number, build_id) VALUES ('m3', 't1', 1, 'b1');`,
	); err == nil {
		t.Error("expected duplicate (team_id, slot_number) to violate UNIQUE constraint")
	}
}

func TestMigrate_ForeignKeyEnforcement(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	// PRAGMAs are per-connection in SQLite; grab a dedicated connection and
	// enable foreign keys explicitly for this test.
	conn, err := db.Conn(ctx)
	if err != nil {
		t.Fatalf("failed to grab connection: %v", err)
	}
	defer func() { _ = conn.Close() }()

	if _, err := conn.ExecContext(ctx, `PRAGMA foreign_keys = ON;`); err != nil {
		t.Fatalf("failed to enable foreign_keys: %v", err)
	}

	seed := []string{
		`INSERT INTO users (id, discord_id, username) VALUES ('u1', 'discord-1', 'kirin');`,
		`INSERT INTO game_accounts (id, user_id, uid) VALUES ('g1', 'u1', '1504687050');`,
		`INSERT INTO agent_builds (id, user_id, game_account_id, agent_id, agent_name, name, disc_uids, raw_data)
		 VALUES ('b1', 'u1', 'g1', 1511, 'Miyabi', 'Main', '[]', '{}');`,
		`INSERT INTO teams (id, user_id, game_account_id, name) VALUES ('t1', 'u1', 'g1', 'Ice Mono');`,
		`INSERT INTO team_members (id, team_id, slot_number, build_id) VALUES ('m1', 't1', 1, 'b1');`,
	}
	for _, query := range seed {
		if _, err := conn.ExecContext(ctx, query); err != nil {
			t.Fatalf("seed insert failed: %v\nquery: %s", err, query)
		}
	}

	// FK violation: build_id referencing a non-existent build.
	if _, err := conn.ExecContext(ctx,
		`INSERT INTO team_members (id, team_id, slot_number, build_id) VALUES ('m2', 't1', 2, 'missing');`,
	); err == nil {
		t.Error("expected insert with unknown build_id to fail foreign key check")
	}

	// ON DELETE RESTRICT: a build used by a team must not be deletable.
	if _, err := conn.ExecContext(ctx, `DELETE FROM agent_builds WHERE id = 'b1';`); err == nil {
		t.Error("expected delete of build used in team to be restricted")
	} else if !strings.Contains(err.Error(), "FOREIGN KEY") {
		t.Errorf("expected foreign key constraint error, got: %v", err)
	}

	// ON DELETE CASCADE: deleting the account removes its builds.
	if _, err := conn.ExecContext(ctx, `DELETE FROM game_accounts WHERE id = 'g1';`); err != nil {
		t.Fatalf("expected cascade delete of game account to succeed, got %v", err)
	}

	var builds int
	if err := conn.QueryRowContext(ctx, `SELECT COUNT(*) FROM agent_builds;`).Scan(&builds); err != nil {
		t.Fatalf("failed to count builds: %v", err)
	}
	if builds != 0 {
		t.Errorf("expected builds to be cascade-deleted with account, got %d remaining", builds)
	}
}

func TestMigrate_VerifiedUIDUniqueConstraint(t *testing.T) {
	db := newMigratedTestDB(t)

	// Two different users can have game accounts with the same UID when verified_at is NULL.
	if _, err := db.Exec(`
		INSERT INTO users (id, discord_id, username) VALUES
			('u1', 'discord-1', 'user1'),
			('u2', 'discord-2', 'user2');
	`); err != nil {
		t.Fatalf("failed to seed users: %v", err)
	}

	uid := "1504687050"
	if _, err := db.Exec(`
		INSERT INTO game_accounts (id, user_id, uid, verified_at) VALUES
			('g1', 'u1', ?, NULL),
			('g2', 'u2', ?, NULL);
	`, uid, uid); err != nil {
		t.Fatalf("expected multiple unverified accounts with same UID to succeed: %v", err)
	}

	// Setting verified_at on the first account succeeds.
	if _, err := db.Exec(`UPDATE game_accounts SET verified_at = datetime('now') WHERE id = 'g1';`); err != nil {
		t.Fatalf("failed to verify first account: %v", err)
	}

	// Attempting to set verified_at on the second account with the same UID must fail with UNIQUE constraint violation.
	if _, err := db.Exec(`UPDATE game_accounts SET verified_at = datetime('now') WHERE id = 'g2';`); err == nil {
		t.Error("expected UNIQUE constraint error when verifying duplicate UID, got nil")
	} else if !strings.Contains(err.Error(), "UNIQUE") {
		t.Errorf("expected UNIQUE constraint error, got: %v", err)
	}

	// Clearing verified_at on the first account allows verifying the second account.
	if _, err := db.Exec(`UPDATE game_accounts SET verified_at = NULL WHERE id = 'g1';`); err != nil {
		t.Fatalf("failed to clear verification on first account: %v", err)
	}
	if _, err := db.Exec(`UPDATE game_accounts SET verified_at = datetime('now') WHERE id = 'g2';`); err != nil {
		t.Fatalf("expected verifying second account to succeed after un-verifying first, got: %v", err)
	}
}
