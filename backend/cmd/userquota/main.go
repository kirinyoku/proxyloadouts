// Command userquota manages per-user quotas for builds, teams, and linked game accounts.
//
// Usage:
//
//	# View current quotas for a user (by Discord ID, username, or UUID)
//	go run ./cmd/userquota -user 123456789012345678
//
//	# Set custom limits (e.g. 20 builds per agent, 200 teams per account, 5 linked accounts)
//	go run ./cmd/userquota -user 123456789012345678 -builds 20 -teams 200 -accounts 5
//
//	# Reset custom limits back to defaults (10 builds, 100 teams, 3 accounts)
//	go run ./cmd/userquota -user 123456789012345678 -reset
//
//	# List all users who have custom quotas set
//	go run ./cmd/userquota -list
package main

import (
	"context"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/config"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	var (
		userQuery string
		builds    int
		teams     int
		accounts  int
		reset     bool
		list      bool
		dbPath    string
	)

	flag.StringVar(&userQuery, "user", "", "User identity to query or update (Discord ID, username, or UUID)")
	flag.IntVar(&builds, "builds", 0, "Custom max builds per agent (> 0)")
	flag.IntVar(&teams, "teams", 0, "Custom max teams per account (> 0)")
	flag.IntVar(&accounts, "accounts", 0, "Custom max linked accounts/UIDs (> 0)")
	flag.BoolVar(&reset, "reset", false, "Reset custom limits back to application defaults")
	flag.BoolVar(&list, "list", false, "List all users with custom quotas configured")
	flag.StringVar(&dbPath, "db", "", "Path to SQLite database file (defaults to DATABASE_PATH env or ./data/proxyloadouts.db)")
	flag.Parse()

	if !list && strings.TrimSpace(userQuery) == "" {
		flag.Usage()
		return errors.New("-user or -list is required")
	}

	if dbPath == "" {
		cfg, err := config.Load()
		if err == nil && cfg.DatabasePath != "" {
			dbPath = cfg.DatabasePath
		} else {
			dbPath = "./data/proxyloadouts.db"
		}
	}

	db, err := sqlite.NewDB(dbPath)
	if err != nil {
		return fmt.Errorf("connecting to database at %q: %w", dbPath, err)
	}
	defer db.Close()

	ctx := context.Background()

	if err := sqlite.Migrate(ctx, db); err != nil {
		return fmt.Errorf("applying migrations: %w", err)
	}

	repo := sqlite.NewUserRepo(db)

	if list {
		if err := listCustomQuotas(ctx, db); err != nil {
			return fmt.Errorf("listing custom quotas: %w", err)
		}
		return nil
	}

	user, err := findUser(ctx, db, repo, strings.TrimSpace(userQuery))
	if err != nil {
		return fmt.Errorf("user not found for %q: %w", userQuery, err)
	}

	fmt.Printf("User found:\n")
	fmt.Printf("  ID:         %s\n", user.ID)
	fmt.Printf("  Discord ID: %s\n", user.DiscordID)
	fmt.Printf("  Username:   %s\n", user.Username)

	if reset {
		if err := repo.UpdateLimits(ctx, user.ID, nil, nil, nil); err != nil {
			return fmt.Errorf("resetting quotas: %w", err)
		}
		fmt.Printf("\nQuotas reset back to defaults:\n")
		fmt.Printf("  Max builds per agent:  %d (default)\n", domain.MaxBuildsPerAgent)
		fmt.Printf("  Max teams per account: %d (default)\n", domain.MaxTeamsPerAccount)
		fmt.Printf("  Max linked accounts:   %d (default)\n", domain.MaxAccountsPerUser)
		return nil
	}

	if builds > 0 || teams > 0 || accounts > 0 {
		newBuilds := user.CustomMaxBuildsPerAgent
		newTeams := user.CustomMaxTeams
		newAccounts := user.CustomMaxAccounts

		if builds > 0 {
			b := builds
			newBuilds = &b
		}
		if teams > 0 {
			t := teams
			newTeams = &t
		}
		if accounts > 0 {
			a := accounts
			newAccounts = &a
		}

		if err := repo.UpdateLimits(ctx, user.ID, newBuilds, newTeams, newAccounts); err != nil {
			return fmt.Errorf("updating quotas: %w", err)
		}

		fmt.Printf("\nUpdated quotas:\n")
		printQuota("Max builds per agent", newBuilds, domain.MaxBuildsPerAgent)
		printQuota("Max teams per account", newTeams, domain.MaxTeamsPerAccount)
		printQuota("Max linked accounts", newAccounts, domain.MaxAccountsPerUser)
		return nil
	}

	// Just display current quotas
	fmt.Printf("\nCurrent quotas:\n")
	printQuota("Max builds per agent", user.CustomMaxBuildsPerAgent, domain.MaxBuildsPerAgent)
	printQuota("Max teams per account", user.CustomMaxTeams, domain.MaxTeamsPerAccount)
	printQuota("Max linked accounts", user.CustomMaxAccounts, domain.MaxAccountsPerUser)
	return nil
}

func printQuota(label string, custom *int, def int) {
	if custom != nil {
		fmt.Printf("  %-22s: %d [CUSTOM] (default: %d)\n", label, *custom, def)
	} else {
		fmt.Printf("  %-22s: %d (default)\n", label, def)
	}
}

func findUser(ctx context.Context, db *sql.DB, repo *sqlite.SQLiteUserRepo, query string) (*domain.User, error) {
	// 1. Try UUID
	if parsedID, err := uuid.Parse(query); err == nil {
		if u, err := repo.GetByID(ctx, parsedID); err == nil {
			return u, nil
		}
	}

	// 2. Try Discord ID
	if _, err := strconv.ParseUint(query, 10, 64); err == nil {
		if u, err := repo.GetByDiscordID(ctx, query); err == nil {
			return u, nil
		}
	}

	// 3. Try exact username lookup (case-insensitive)
	var idStr string
	err := db.QueryRowContext(ctx,
		`SELECT id FROM users WHERE username = ? COLLATE NOCASE LIMIT 1;`,
		query,
	).Scan(&idStr)
	if err == nil {
		if parsedID, err := uuid.Parse(idStr); err == nil {
			return repo.GetByID(ctx, parsedID)
		}
	}

	return nil, errors.New("no user matches query")
}

func listCustomQuotas(ctx context.Context, db *sql.DB) error {
	rows, err := db.QueryContext(ctx, `
		SELECT id, discord_id, username, custom_max_builds_per_agent, custom_max_teams, custom_max_accounts
		FROM users
		WHERE custom_max_builds_per_agent IS NOT NULL OR custom_max_teams IS NOT NULL OR custom_max_accounts IS NOT NULL
		ORDER BY username ASC;
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	count := 0
	for rows.Next() {
		var (
			id           string
			discordID    string
			username     string
			buildsNull   sql.NullInt64
			teamsNull    sql.NullInt64
			accountsNull sql.NullInt64
		)
		if err := rows.Scan(&id, &discordID, &username, &buildsNull, &teamsNull, &accountsNull); err != nil {
			return err
		}
		count++
		buildsStr := fmt.Sprintf("%d (default)", domain.MaxBuildsPerAgent)
		if buildsNull.Valid {
			buildsStr = fmt.Sprintf("%d [custom]", buildsNull.Int64)
		}
		teamsStr := fmt.Sprintf("%d (default)", domain.MaxTeamsPerAccount)
		if teamsNull.Valid {
			teamsStr = fmt.Sprintf("%d [custom]", teamsNull.Int64)
		}
		accountsStr := fmt.Sprintf("%d (default)", domain.MaxAccountsPerUser)
		if accountsNull.Valid {
			accountsStr = fmt.Sprintf("%d [custom]", accountsNull.Int64)
		}

		fmt.Printf("[%d] %s (@%s, ID: %s)\n", count, username, discordID, id)
		fmt.Printf("    Builds: %s | Teams: %s | Accounts: %s\n", buildsStr, teamsStr, accountsStr)
	}

	if count == 0 {
		fmt.Println("No users have custom quotas configured. All users use global defaults:")
		fmt.Printf("  Max builds per agent:  %d\n", domain.MaxBuildsPerAgent)
		fmt.Printf("  Max teams per account: %d\n", domain.MaxTeamsPerAccount)
		fmt.Printf("  Max linked accounts:   %d\n", domain.MaxAccountsPerUser)
	}

	return rows.Err()
}
