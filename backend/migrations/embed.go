// Package migrations embeds versioned SQL schema migrations that are applied
// automatically at server startup by internal/adapter/sqlite.Migrate.
//
// The .go file lives next to the *.sql files because go:embed cannot
// reference parent directories; this keeps the migrations embedded in the
// single-binary deployment while preserving the canonical migrations/ path.
package migrations

import "embed"

// FS holds all embedded migration files keyed by filename (e.g. "001_init.sql").
//
//go:embed *.sql
var FS embed.FS
