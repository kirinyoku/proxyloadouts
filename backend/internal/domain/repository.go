package domain

import (
	"context"

	"github.com/google/uuid"
)

// UserRepository persists and retrieves users by their Discord identity.
type UserRepository interface {
	Create(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id uuid.UUID) (*User, error)
	GetByDiscordID(ctx context.Context, discordID string) (*User, error)
	// Update refreshes mutable profile fields (username, avatar) after re-auth.
	Update(ctx context.Context, user *User) error
	// UpdateLimits updates the custom per-user limits for builds and teams.
	// Passing nil for either limit resets it back to the domain default.
	UpdateLimits(ctx context.Context, id uuid.UUID, maxBuilds *int, maxTeams *int) error
	// IncrementTokenVersion atomically increments token_version for the given user,
	// invalidating all previously issued session cookies.
	IncrementTokenVersion(ctx context.Context, id uuid.UUID) error
	Delete(ctx context.Context, id uuid.UUID) error
}

// AccountRepository manages the ZZZ accounts (UIDs) linked to a user.
type AccountRepository interface {
	Create(ctx context.Context, account *GameAccount) error
	GetByID(ctx context.Context, id uuid.UUID) (*GameAccount, error)
	GetByUserAndUID(ctx context.Context, userID uuid.UUID, uid string) (*GameAccount, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*GameAccount, error)
	CountByUser(ctx context.Context, userID uuid.UUID) (int, error)
	Delete(ctx context.Context, id uuid.UUID) error
}

// BuildRepository manages saved agent builds.
//
// Delete implementations rely on the database-level ON DELETE RESTRICT
// constraint: deleting a build referenced by a team member must fail and the
// adapter maps that failure to ErrConflict.
type BuildRepository interface {
	Create(ctx context.Context, build *AgentBuild) error
	GetByID(ctx context.Context, id uuid.UUID) (*AgentBuild, error)
	ListByAccount(ctx context.Context, accountID uuid.UUID) ([]*AgentBuild, error)
	CountByAccountAndAgent(ctx context.Context, accountID uuid.UUID, agentID int) (int, error)
	UpdateDetails(ctx context.Context, id uuid.UUID, name string, description *string) error
	UpdateName(ctx context.Context, id uuid.UUID, name string) error
	Delete(ctx context.Context, id uuid.UUID) error
}

// TeamRepository manages teams and their member slots.
type TeamRepository interface {
	// Create persists the team and all member slots atomically: either the
	// whole team is stored or nothing is.
	Create(ctx context.Context, team *Team, members []TeamMember) error
	// Update atomically updates team metadata and replaces all member slots.
	Update(ctx context.Context, team *Team, members []TeamMember) error
	GetByID(ctx context.Context, id uuid.UUID) (*Team, error)
	GetMembers(ctx context.Context, teamID uuid.UUID) ([]TeamMember, error)
	GetMembersByTeams(ctx context.Context, teamIDs []uuid.UUID) (map[uuid.UUID][]TeamMember, error)
	ListByAccount(ctx context.Context, accountID uuid.UUID) ([]*Team, error)
	CountByAccount(ctx context.Context, accountID uuid.UUID) (int, error)
	Delete(ctx context.Context, id uuid.UUID) error
}
