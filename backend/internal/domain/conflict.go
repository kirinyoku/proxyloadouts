package domain

import "strconv"

// ConflictCode identifies the kind of equipment conflict detected in a team.
type ConflictCode string

const (
	// ConflictDuplicateAgent — the same agent is selected more than once.
	ConflictDuplicateAgent ConflictCode = "DUPLICATE_AGENT"

	// ConflictItemReuse — one Drive Disc is equipped in two builds.
	ConflictItemReuse ConflictCode = "ITEM_REUSE"

	// ConflictWeaponReuse — one W-Engine is equipped in two builds.
	ConflictWeaponReuse ConflictCode = "WEAPON_REUSE"

	// ConflictAccountMismatch — builds belong to different game accounts.
	ConflictAccountMismatch ConflictCode = "ACCOUNT_MISMATCH"
)

// Standard English messages for conflict errors.
const (
	ConflictAccountMismatchMessage = "Builds belong to different game accounts"
	ConflictWeaponReuseMessage     = "W-Engine is equipped in multiple builds"
	ConflictDiscReuseMessage       = "Drive Disc is equipped in multiple builds"
)

// ConflictDuplicateAgentMessage returns the standard message for duplicate agent conflicts.
func ConflictDuplicateAgentMessage(agentName string) string {
	if agentName != "" {
		return "Agent " + agentName + " is selected more than once"
	}
	return "The same agent is selected more than once"
}

// ConflictDiscReuseSlotMessage returns the standard message for disc reuse with a known partition slot.
func ConflictDiscReuseSlotMessage(slot int) string {
	if slot > 0 {
		return "Drive Disc (Slot " + strconv.Itoa(slot) + ") is equipped in multiple builds"
	}
	return ConflictDiscReuseMessage
}

// ItemType classifies the conflicting piece of equipment.
type ItemType string

const (
	ItemDriveDisc ItemType = "drive_disc"
	ItemWEngine   ItemType = "w_engine"
)

// ConflictError describes a single rule violation found in a team composition.
//
// Which fields are populated depends on the Code:
//   - DUPLICATE_AGENT: AgentID
//   - ITEM_REUSE / WEAPON_REUSE: ItemType, ItemUID, Slot (discs only),
//     ConflictingBuilds
//   - ACCOUNT_MISMATCH: ConflictingBuilds
type ConflictError struct {
	Code              ConflictCode `json:"code"`
	Message           string       `json:"message"`
	AgentID           int          `json:"agent_id,omitempty"`
	ItemType          ItemType     `json:"item_type,omitempty"`
	ItemUID           string       `json:"item_uid,omitempty"`
	Slot              int          `json:"slot,omitempty"`
	ConflictingBuilds []string     `json:"conflicting_builds,omitempty"`
}

// ConflictReport is the result of validating a team against the equipment
// uniqueness rules. A valid report always carries an empty (non-nil) Errors slice.
type ConflictReport struct {
	IsValid bool            `json:"is_valid"`
	Errors  []ConflictError `json:"errors"`
}

// NewValidReport returns a report for a conflict-free team.
func NewValidReport() ConflictReport {
	return ConflictReport{IsValid: true, Errors: []ConflictError{}}
}
