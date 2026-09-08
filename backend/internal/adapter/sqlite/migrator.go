package sqlite

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"sort"

	"github.com/kirinyoku/proxyloadouts/backend/migrations"
)

// Migrate applies all pending embedded SQL migrations in filename order.
//
// Applied versions are tracked in the schema_migrations table, and every
// migration runs inside a transaction together with its version record, so
// the process is idempotent across restarts and never leaves a partially
// applied schema behind.
func Migrate(ctx context.Context, db *sql.DB) error {
	if db == nil {
		return errors.New("db cannot be nil")
	}

	if _, err := db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    TEXT PRIMARY KEY,
			applied_at TEXT NOT NULL DEFAULT (datetime('now'))
		);
	`); err != nil {
		return fmt.Errorf("failed to create schema_migrations table: %w", err)
	}

	names, err := fs.Glob(migrations.FS, "*.sql")
	if err != nil {
		return fmt.Errorf("failed to list embedded migrations: %w", err)
	}
	sort.Strings(names)

	for _, name := range names {
		applied, err := isMigrationApplied(ctx, db, name)
		if err != nil {
			return err
		}
		if applied {
			continue
		}
		if err := applyMigration(ctx, db, name); err != nil {
			return err
		}
	}

	return nil
}

// AppliedMigrations returns the versions of all applied migrations ordered by version.
func AppliedMigrations(ctx context.Context, db *sql.DB) ([]string, error) {
	rows, err := db.QueryContext(ctx, `SELECT version FROM schema_migrations ORDER BY version;`)
	if err != nil {
		return nil, fmt.Errorf("failed to query applied migrations: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var versions []string
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, fmt.Errorf("failed to scan migration version: %w", err)
		}
		versions = append(versions, version)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate applied migrations: %w", err)
	}
	return versions, nil
}

func isMigrationApplied(ctx context.Context, db *sql.DB, version string) (bool, error) {
	var count int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM schema_migrations WHERE version = ?;`, version,
	).Scan(&count); err != nil {
		return false, fmt.Errorf("failed to check status of migration %q: %w", version, err)
	}
	return count > 0, nil
}

func applyMigration(ctx context.Context, db *sql.DB, version string) error {
	content, err := fs.ReadFile(migrations.FS, version)
	if err != nil {
		return fmt.Errorf("failed to read embedded migration %q: %w", version, err)
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction for migration %q: %w", version, err)
	}
	defer func() { _ = tx.Rollback() }()

	if _, err := tx.ExecContext(ctx, string(content)); err != nil {
		return fmt.Errorf("migration %q failed: %w", version, err)
	}

	if _, err := tx.ExecContext(ctx,
		`INSERT INTO schema_migrations (version) VALUES (?);`, version,
	); err != nil {
		return fmt.Errorf("failed to record migration %q: %w", version, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit migration %q: %w", version, err)
	}
	return nil
}
