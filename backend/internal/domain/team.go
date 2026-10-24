package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Team size limits: a team consists of 1 to 3 unique agents.
const (
	MinTeamSize = 1
	MaxTeamSize = 3

	MaxTeamsPerAccount       = 100
	MaxTeamNameLength        = 100
	MaxTeamDescriptionLength = 500
)

// Team is a saved composition of agent builds belonging to one game account.
type Team struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	GameAccountID uuid.UUID
	Name          string
	Description   *string // nil when the team has no description
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// TeamMember is a single team slot (1..3) referencing an exact AgentBuild.
type TeamMember struct {
	ID         uuid.UUID
	TeamID     uuid.UUID
	SlotNumber int
	BuildID    uuid.UUID
}

// ValidateSlot checks that the slot number fits the team size limits.
func (m *TeamMember) ValidateSlot() error {
	if m.SlotNumber < MinTeamSize || m.SlotNumber > MaxTeamSize {
		return fmt.Errorf("slot number %d is out of range [%d, %d]", m.SlotNumber, MinTeamSize, MaxTeamSize)
	}
	return nil
}
