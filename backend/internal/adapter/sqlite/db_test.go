package sqlite

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestNewDB_InMemory(t *testing.T) {
	db, err := NewDB(":memory:")
	if err != nil {
		t.Fatalf("failed to open in-memory db: %v", err)
	}
	defer func() { _ = db.Close() }()

	var fkEnabled int
	if err := db.QueryRow("PRAGMA foreign_keys;").Scan(&fkEnabled); err != nil {
		t.Fatalf("failed to query foreign_keys pragma: %v", err)
	}
	if fkEnabled != 1 {
		t.Errorf("expected foreign_keys = 1, got %d", fkEnabled)
	}
}

func TestNewDB_FileDirectoryCreation(t *testing.T) {
	tmpDir := t.TempDir()
	nestedPath := filepath.Join(tmpDir, "nested", "subdir", "test.db")

	db, err := NewDB(nestedPath)
	if err != nil {
		t.Fatalf("failed to open db in nested directory: %v", err)
	}
	defer func() { _ = db.Close() }()

	if _, err := os.Stat(filepath.Dir(nestedPath)); os.IsNotExist(err) {
		t.Fatalf("expected directory %s to be created", filepath.Dir(nestedPath))
	}

	// Verify WAL mode
	var journalMode string
	if err := db.QueryRow("PRAGMA journal_mode;").Scan(&journalMode); err != nil {
		t.Fatalf("failed to query journal_mode pragma: %v", err)
	}
	if journalMode != "wal" {
		t.Errorf("expected journal_mode wal, got %s", journalMode)
	}

	// Execute basic DDL and DML to confirm functionality
	_, err = db.Exec("CREATE TABLE test_items (id INTEGER PRIMARY KEY, name TEXT);")
	if err != nil {
		t.Fatalf("failed to create table: %v", err)
	}

	_, err = db.Exec("INSERT INTO test_items (name) VALUES ('item1');")
	if err != nil {
		t.Fatalf("failed to insert row: %v", err)
	}

	var name string
	if err := db.QueryRow("SELECT name FROM test_items WHERE id = 1;").Scan(&name); err != nil {
		t.Fatalf("failed to select row: %v", err)
	}
	if name != "item1" {
		t.Errorf("expected item1, got %s", name)
	}
}

func TestNewDB_EmptyPath(t *testing.T) {
	_, err := NewDB("")
	if err == nil {
		t.Error("expected error for empty dbPath, got nil")
	}
}

// TestNewDB_ForeignKeysOnEveryConnection guards the per-connection nature of
// SQLite PRAGMAs: an open transaction pins one pooled connection, so the
// concurrent query is guaranteed to run on a different one. Both must see
// foreign_keys = 1 thanks to the DSN-level pragmas.
func TestNewDB_ForeignKeysOnEveryConnection(t *testing.T) {
	db, err := NewDB(filepath.Join(t.TempDir(), "fk.db"))
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	defer func() { _ = db.Close() }()

	ctx := context.Background()
	if _, err := db.ExecContext(ctx, `CREATE TABLE parent (id TEXT PRIMARY KEY);`); err != nil {
		t.Fatalf("failed to create table: %v", err)
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	var fk int
	if err := db.QueryRowContext(ctx, `PRAGMA foreign_keys;`).Scan(&fk); err != nil {
		t.Fatalf("failed to read foreign_keys pragma: %v", err)
	}
	if fk != 1 {
		t.Errorf("expected foreign_keys = 1 on a second pooled connection, got %d", fk)
	}
}

func TestTransaction_ExecBeginImmediateError(t *testing.T) {
	db, err := NewDB(filepath.Join(t.TempDir(), "tx_test.db"))
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	defer func() { _ = db.Close() }()

	ctx := context.Background()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatalf("failed to begin tx: %v", err)
	}
	defer func() { _ = tx.Rollback() }()

	_, err = tx.ExecContext(ctx, "BEGIN IMMEDIATE")
	if err == nil {
		t.Fatal("expected error executing BEGIN IMMEDIATE within active transaction, got nil")
	}
	t.Logf("expected error received: %v", err)
}
