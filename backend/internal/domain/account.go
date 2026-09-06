package domain

import (
	"fmt"
	"time"

	"github.com/google/uuid"
)

// Game server regions, matching the fairy Region values.
const (
	RegionEurope  = "Europe"
	RegionAmerica = "America"
	RegionAsia    = "Asia"
	RegionTWHKMO  = "TW/HK/MO"
)

// DefaultRegion is used when a game account is created without an explicit region.
const DefaultRegion = RegionEurope

// MaxAccountsPerUser is the maximum number of game accounts a user can link.
const MaxAccountsPerUser = 3

// validRegions lists all supported server regions.
var validRegions = map[string]struct{}{
	RegionEurope:  {},
	RegionAmerica: {},
	RegionAsia:    {},
	RegionTWHKMO:  {},
}

// IsValidRegion reports whether the region is one of the supported server regions.
func IsValidRegion(region string) bool {
	_, ok := validRegions[region]
	return ok
}

// RegionFromUID determines the game server Region from the prefix of a
// 10-digit international ZZZ UID without performing any network requests.
//
// Recognized 10-digit prefixes:
//   - "10" -> RegionAmerica (America)
//   - "13" -> RegionAsia (Asia)
//   - "15" -> RegionEurope (Europe)
//   - "17" -> RegionTWHKMO (TW/HK/MO)
//
// Returns the matched Region and true, or empty string and false if the UID
// prefix is not recognized.
func RegionFromUID(uid string) (string, bool) {
	if len(uid) == 10 {
		switch uid[:2] {
		case "10":
			return RegionAmerica, true
		case "13":
			return RegionAsia, true
		case "15":
			return RegionEurope, true
		case "17":
			return RegionTWHKMO, true
		}
	}
	return "", false
}

// GameAccount is a ZZZ account (UID) linked to a user. A user may link
// several accounts (mains, twinks, other regions).
type GameAccount struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	UID       string
	Region    string
	CreatedAt time.Time
}

// ValidateUID checks the ZZZ UID format: a numeric string of 9-10 digits.
func ValidateUID(uid string) error {
	if len(uid) < 9 || len(uid) > 10 {
		return fmt.Errorf("uid %q must be 9-10 digits long", uid)
	}
	for _, r := range uid {
		if r < '0' || r > '9' {
			return fmt.Errorf("uid %q must contain only digits", uid)
		}
	}
	return nil
}
