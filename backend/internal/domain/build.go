package domain

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/kirinyoku/enkanetwork-go/client/zzz"
)

// Build limit and validation constants.
const (
	MaxBuildsPerAgent         = 10
	MaxBuildNameLength        = 100
	MaxBuildDescriptionLength = 500
)

type FaeBuildStatus string

const (
	FaeStatusLive             FaeBuildStatus = "live"
	FaeStatusSnapshotOutdated FaeBuildStatus = "snapshot_outdated"
	FaeStatusUnassessed       FaeBuildStatus = "unassessed"
)

type FaeScoreBreakdown struct {
	WeaponPercent   *int `json:"weapon_percent,omitempty"`
	DiscSetPercent  *int `json:"disc_set_percent,omitempty"`
	MainstatPercent *int `json:"mainstat_percent,omitempty"`
	SubstatPercent  *int `json:"substat_percent,omitempty"`
}

type FaeRating struct {
	Status               FaeBuildStatus     `json:"status"`
	Outdated             bool               `json:"outdated"`
	Rank                 *int               `json:"rank,omitempty"`
	RankOf               *int               `json:"rank_of,omitempty"`
	TopPercentile        *float64           `json:"top_percentile,omitempty"`
	Score                *float64           `json:"score,omitempty"`
	TimeAssessed         *int64             `json:"time_assessed,omitempty"`
	Slug                 *string            `json:"slug,omitempty"`
	BracketName          *string            `json:"bracket_name,omitempty"`
	EquipmentFingerprint *string            `json:"equipment_fingerprint,omitempty"`
	Breakdown            *FaeScoreBreakdown `json:"breakdown,omitempty"`
}

func (r *FaeRating) Clone() *FaeRating {
	if r == nil {
		return nil
	}
	cp := *r
	if r.Rank != nil {
		v := *r.Rank
		cp.Rank = &v
	}
	if r.RankOf != nil {
		v := *r.RankOf
		cp.RankOf = &v
	}
	if r.TopPercentile != nil {
		v := *r.TopPercentile
		cp.TopPercentile = &v
	}
	if r.Score != nil {
		v := *r.Score
		cp.Score = &v
	}
	if r.TimeAssessed != nil {
		v := *r.TimeAssessed
		cp.TimeAssessed = &v
	}
	if r.Slug != nil {
		v := *r.Slug
		cp.Slug = &v
	}
	if r.BracketName != nil {
		v := *r.BracketName
		cp.BracketName = &v
	}
	if r.EquipmentFingerprint != nil {
		v := *r.EquipmentFingerprint
		cp.EquipmentFingerprint = &v
	}
	if r.Breakdown != nil {
		bd := *r.Breakdown
		if r.Breakdown.WeaponPercent != nil {
			v := *r.Breakdown.WeaponPercent
			bd.WeaponPercent = &v
		}
		if r.Breakdown.DiscSetPercent != nil {
			v := *r.Breakdown.DiscSetPercent
			bd.DiscSetPercent = &v
		}
		if r.Breakdown.MainstatPercent != nil {
			v := *r.Breakdown.MainstatPercent
			bd.MainstatPercent = &v
		}
		if r.Breakdown.SubstatPercent != nil {
			v := *r.Breakdown.SubstatPercent
			bd.SubstatPercent = &v
		}
		cp.Breakdown = &bd
	}
	return &cp
}

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

	IsPublic bool

	FaeRating *FaeRating

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

var substatPropertyCodeMap = map[int]string{
	11103: "HP",
	11102: "HP%",
	12103: "ATK",
	12102: "ATK%",
	13103: "DEF",
	13102: "DEF%",
	20103: "CR",
	21103: "CDMG",
	31203: "AP",
	23203: "PEN",
}

func ComputeEquipmentFingerprint(raw *zzz.AvatarData) string {
	if raw == nil {
		return ""
	}

	slotMap := make(map[int]*zzz.Equipment, 6)
	for i := range raw.EquippedList {
		eqItem := &raw.EquippedList[i]
		if eqItem.Slot >= 1 && eqItem.Slot <= 6 && eqItem.Equipment != nil {
			slotMap[eqItem.Slot] = eqItem.Equipment
		}
	}
	if len(slotMap) != 6 {
		return ""
	}

	weaponPrefix := "w:r0"
	if raw.Weapon != nil {
		ref := raw.Weapon.UpgradeLevel
		if ref < 1 {
			ref = 1
		}
		if ref > 5 {
			ref = 5
		}
		weaponPrefix = fmt.Sprintf("w:r%d", ref)
	}

	slotParts := make([]string, 6)
	for slot := 1; slot <= 6; slot++ {
		eq := slotMap[slot]
		substats := make([]string, 0, len(eq.RandomPropertyList))
		for _, prop := range eq.RandomPropertyList {
			code, ok := substatPropertyCodeMap[prop.PropertyID]
			if !ok {
				continue
			}
			upgrades := prop.PropertyLevel - 1
			if upgrades < 0 {
				upgrades = 0
			}
			substats = append(substats, fmt.Sprintf("%s+%d", code, upgrades))
		}
		sort.Strings(substats)
		slotParts[slot-1] = fmt.Sprintf("s%d:%s", slot, strings.Join(substats, ","))
	}

	return weaponPrefix + "|" + strings.Join(slotParts, "|")
}

func ComputeEquipmentFingerprintFromRawJSON(rawData json.RawMessage) string {
	if len(rawData) == 0 {
		return ""
	}
	var raw zzz.AvatarData
	if err := json.Unmarshal(rawData, &raw); err != nil {
		return ""
	}
	return ComputeEquipmentFingerprint(&raw)
}
