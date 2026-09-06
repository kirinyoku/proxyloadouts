package domain

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/google/uuid"
)

// Build limit and validation constants.
const (
	MaxBuildsPerAgent         = 5
	MaxBuildNameLength        = 100
	MaxBuildDescriptionLength = 500
)

// AgentBuild is a saved snapshot of an agent's equipment from the showcase:
// the W-Engine, the Drive Discs (tracked by their string UIDs) and the full
// enriched fairy payload for display.
type AgentBuild struct {
	ID            uuid.UUID
	UserID        uuid.UUID
	GameAccountID uuid.UUID

	AgentID     int     // Agent ID from the fairy catalog (e.g. 1511)
	AgentName   string  // Localized name (e.g. Miyabi)
	Name        string  // Preset name ("Anomaly Main")
	Description *string // User notes/description (e.g. "Shiyu Defense 17 ice team")

	// Fast lookup fields for the Conflict Engine. Weapon fields are nil when
	// the build was saved without a W-Engine.
	WeaponUID *string
	WeaponID  *int
	DiscUIDs  []string
	DiscSlots map[string]int // Disc UID -> equip partition slot (1–6)

	// RawData is the canonical raw upstream zzz.AvatarData JSON persisted in the database.
	RawData json.RawMessage

	// BuildData is the full enriched fairy agent payload generated in-memory on read
	// for client responses (not persisted in the database).
	BuildData json.RawMessage

	CreatedAt time.Time
	UpdatedAt time.Time
}

// HasWeapon reports whether the build includes a W-Engine.
func (b *AgentBuild) HasWeapon() bool {
	return b.WeaponUID != nil && *b.WeaponUID != ""
}

// HasDiscUID reports whether the given Drive Disc UID is equipped in the build.
func (b *AgentBuild) HasDiscUID(uid string) bool {
	for _, discUID := range b.DiscUIDs {
		if discUID == uid {
			return true
		}
	}
	return false
}

// PopulateDiscSlotsFromRawData parses the raw upstream avatar data to populate the DiscSlots map.
func (b *AgentBuild) PopulateDiscSlotsFromRawData() map[string]int {
	if b.DiscSlots == nil {
		b.DiscSlots = make(map[string]int)
	}
	if len(b.RawData) == 0 {
		return b.DiscSlots
	}
	var avatar struct {
		EquippedList []struct {
			Slot      int `json:"Slot"`
			Equipment *struct {
				UID int `json:"Uid"`
			} `json:"Equipment"`
		} `json:"EquippedList"`
	}
	if err := json.Unmarshal(b.RawData, &avatar); err == nil {
		for _, eq := range avatar.EquippedList {
			if eq.Equipment != nil && eq.Slot > 0 {
				b.DiscSlots[strconv.Itoa(eq.Equipment.UID)] = eq.Slot
			}
		}
	}
	return b.DiscSlots
}

// DiscSlot returns the equip partition slot (1–6) for a given disc UID, or 0 if unknown.
func (b *AgentBuild) DiscSlot(uid string) int {
	if b.DiscSlots != nil {
		if slot, ok := b.DiscSlots[uid]; ok && slot > 0 {
			return slot
		}
	}
	if len(b.RawData) > 0 {
		slots := b.PopulateDiscSlotsFromRawData()
		return slots[uid]
	}
	return 0
}
