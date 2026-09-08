package sqlite

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	modernc "modernc.org/sqlite"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// SQLite extended result codes (stable values from the SQLite C API).
const (
	sqliteConstraintPrimaryKey = 1555 // 19 | (6<<8)
	sqliteConstraintNotNull    = 1299 // 19 | (5<<8)
	sqliteConstraintCheck      = 275  // 19 | (1<<8)
	sqliteConstraintForeignKey = 787  // 19 | (3<<8)
	sqliteConstraintUnique     = 2067 // 19 | (8<<8)

	// sqliteConstraintTrigger is reported instead of the plain foreign-key
	// code by some enforcement paths (observed with modernc.org/sqlite).
	sqliteConstraintTrigger = 1811 // 19 | (7<<8)
)

// constraintCode extracts the SQLite result code from err, if present.
func constraintCode(err error) (int, bool) {
	var sqliteErr *modernc.Error
	if errors.As(err, &sqliteErr) {
		return sqliteErr.Code(), true
	}
	return 0, false
}

func isUniqueViolation(err error) bool {
	code, ok := constraintCode(err)
	return ok && (code == sqliteConstraintUnique || code == sqliteConstraintPrimaryKey)
}

func isForeignKeyViolation(err error) bool {
	code, ok := constraintCode(err)
	if ok && (code == sqliteConstraintForeignKey || code == sqliteConstraintTrigger) {
		return true
	}
	// Defensive fallback: the SQLite message is stable across builds.
	return strings.Contains(err.Error(), "FOREIGN KEY")
}

func isCheckViolation(err error) bool {
	code, ok := constraintCode(err)
	return ok && (code == sqliteConstraintCheck || code == sqliteConstraintNotNull)
}

// mapConstraintError converts a write error into a domain error according to
// the violated constraint, or returns nil when err is not a constraint violation.
func mapConstraintError(err error) error {
	switch {
	case isUniqueViolation(err):
		return fmt.Errorf("%w: entity already exists", domain.ErrConflict)
	case isForeignKeyViolation(err):
		return fmt.Errorf("%w: referenced entity is missing or still in use", domain.ErrConflict)
	case isCheckViolation(err):
		return fmt.Errorf("%w: value violates a data constraint", domain.ErrInvalidInput)
	default:
		return nil
	}
}

// notFound wraps sql.ErrNoRows as a domain error with context.
func notFound(entity string, err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("%w: %s", domain.ErrNotFound, entity)
	}
	return err
}

const (
	// sqliteWriteTimeLayout stores millisecond precision so that rows written
	// within the same second keep a stable, sortable order.
	sqliteWriteTimeLayout = "2006-01-02 15:04:05.000"
)

// sqliteReadTimeLayouts lists accepted storage formats, most specific first:
// millisecond precision, plain datetime('now') output, and RFC3339 as a
// defensive fallback for values written by external tools.
var sqliteReadTimeLayouts = []string{
	sqliteWriteTimeLayout,
	"2006-01-02 15:04:05",
	time.RFC3339,
}

// formatTime renders t in UTC for storage. Lexicographic ordering of the
// stored strings matches chronological ordering.
func formatTime(t time.Time) string {
	return t.UTC().Format(sqliteWriteTimeLayout)
}

// parseTime parses a stored timestamp in any supported format.
func parseTime(s string) (time.Time, error) {
	for _, layout := range sqliteReadTimeLayouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unsupported timestamp format %q", s)
}
