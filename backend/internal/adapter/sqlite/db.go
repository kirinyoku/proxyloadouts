package sqlite

import (
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// Options allows custom tuning of the SQLite database connection.
type Options struct {
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
	ConnMaxIdleTime time.Duration
}

// DefaultOptions returns recommended connection settings for SQLite in WAL mode.
func DefaultOptions() Options {
	return Options{
		MaxOpenConns:    10,
		MaxIdleConns:    5,
		ConnMaxLifetime: 1 * time.Hour,
		ConnMaxIdleTime: 15 * time.Minute,
	}
}

// NewDB opens a SQLite database connection with WAL mode and foreign keys enabled.
// It automatically creates the parent directory of the database file if it does not exist.
//
// Per-connection PRAGMAs (foreign_keys, busy_timeout, synchronous) are passed
// through the DSN so every pooled connection gets them; journal_mode=WAL is
// persistent and also applied via DSN for consistency.
func NewDB(dbPath string, opts ...Options) (*sql.DB, error) {
	if dbPath == "" {
		return nil, errors.New("dbPath cannot be empty")
	}

	// For file-based databases (not in-memory), ensure the target directory exists.
	if dbPath != ":memory:" && !isInMemoryURI(dbPath) {
		dir := filepath.Dir(dbPath)
		if dir != "" && dir != "." {
			if err := os.MkdirAll(dir, 0755); err != nil {
				return nil, fmt.Errorf("failed to create database directory %q: %w", dir, err)
			}
		}
	}

	basePath := dbPath
	queryValues := url.Values{}
	if idx := strings.Index(dbPath, "?"); idx != -1 {
		basePath = dbPath[:idx]
		if parsed, err := url.ParseQuery(dbPath[idx+1:]); err == nil {
			queryValues = parsed
		}
	}

	// modernc.org/sqlite _txlock: guarantees that all write transactions
	// opened via db.BeginTx(ctx, nil) issue BEGIN IMMEDIATE instead of
	// BEGIN DEFERRED. This acquires RESERVED lock upfront and eliminates
	// SQLITE_BUSY / database is locked deadlocks between concurrent writers.
	if !queryValues.Has("_txlock") {
		queryValues.Set("_txlock", "immediate")
	}

	ensurePragma := func(name, val string) {
		for _, p := range queryValues["_pragma"] {
			if strings.HasPrefix(p, name) {
				return
			}
		}
		queryValues.Add("_pragma", fmt.Sprintf("%s(%s)", name, val))
	}

	ensurePragma("foreign_keys", "1")
	ensurePragma("busy_timeout", "5000")
	ensurePragma("journal_mode", "WAL")
	ensurePragma("synchronous", "NORMAL")

	dsn := basePath + "?" + queryValues.Encode()

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite database: %w", err)
	}

	opt := DefaultOptions()
	if len(opts) > 0 {
		opt = opts[0]
	}

	db.SetMaxOpenConns(opt.MaxOpenConns)
	db.SetMaxIdleConns(opt.MaxIdleConns)
	db.SetConnMaxLifetime(opt.ConnMaxLifetime)
	db.SetConnMaxIdleTime(opt.ConnMaxIdleTime)

	// Execute essential PRAGMAs on the startup connection as well: this both
	// validates them eagerly and covers in-memory DSNs that bypass query params.
	pragmas := []string{
		"PRAGMA foreign_keys = ON;",
		"PRAGMA journal_mode = WAL;",
		"PRAGMA busy_timeout = 5000;",
		"PRAGMA synchronous = NORMAL;",
	}

	for _, pragma := range pragmas {
		if _, err := db.Exec(pragma); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("failed to execute %q: %w", pragma, err)
		}
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("failed to ping sqlite database: %w", err)
	}

	return db, nil
}

func isInMemoryURI(path string) bool {
	return path == "file::memory:" || path == ":memory:"
}
