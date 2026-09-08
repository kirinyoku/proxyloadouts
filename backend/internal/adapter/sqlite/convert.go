package sqlite

import (
	"database/sql"
	"fmt"

	"github.com/google/uuid"
)

// rowScanner is satisfied by both *sql.Row and *sql.Rows.
type rowScanner interface {
	Scan(dest ...any) error
}

// nullableString converts a *string domain field into a value suitable for a
// nullable TEXT column (nil pointer becomes SQL NULL).
func nullableString(s *string) any {
	if s == nil {
		return nil
	}
	return *s
}

// nullableInt converts an *int domain field into a value suitable for a
// nullable INTEGER column (nil pointer becomes SQL NULL).
func nullableInt(i *int) any {
	if i == nil {
		return nil
	}
	return *i
}

// nullStringPointer converts a nullable TEXT column into a *string domain
// field (SQL NULL becomes a nil pointer).
func nullStringPointer(n sql.NullString) *string {
	if !n.Valid {
		return nil
	}
	value := n.String
	return &value
}

// nullIntPointer converts a nullable INTEGER column into an *int domain field
// (SQL NULL becomes a nil pointer).
func nullIntPointer(n sql.NullInt64) *int {
	if !n.Valid {
		return nil
	}
	value := int(n.Int64)
	return &value
}

// parseUUID3 parses three UUID columns of a single row, reporting the entity
// and column names in the error for debuggability.
func parseUUID3(entity, col1, v1, col2, v2, col3, v3 string) ([3]uuid.UUID, error) {
	var out [3]uuid.UUID
	pairs := []struct {
		col string
		val string
	}{{col1, v1}, {col2, v2}, {col3, v3}}
	for i, p := range pairs {
		id, err := uuid.Parse(p.val)
		if err != nil {
			return out, fmt.Errorf("failed to parse %s %s %q: %w", entity, p.col, p.val, err)
		}
		out[i] = id
	}
	return out, nil
}
