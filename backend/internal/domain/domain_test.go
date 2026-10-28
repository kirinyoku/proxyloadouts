package domain

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestSession_Valid(t *testing.T) {
	now := time.Now()
	session := NewSession(uuid.New(), 1, 15*time.Minute)

	if session.Version != 1 {
		t.Errorf("expected version 1, got %d", session.Version)
	}
	if !session.Valid(now) {
		t.Error("expected fresh session to be valid")
	}
	if session.Valid(now.Add(16 * time.Minute)) {
		t.Error("expected expired session to be invalid")
	}
	if session.Valid(session.ExpiresAt) {
		t.Error("expected session to be invalid exactly at expiry")
	}
}

func TestSession_JSONShape(t *testing.T) {
	userID := uuid.New()
	session := NewSession(userID, 3, 10*time.Minute)

	data, err := json.Marshal(session)
	if err != nil {
		t.Fatalf("failed to marshal session: %v", err)
	}

	var decoded Session
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal session: %v", err)
	}

	if decoded.UserID != userID {
		t.Errorf("expected user ID %s, got %s", userID, decoded.UserID)
	}
	if decoded.Version != 3 {
		t.Errorf("expected version 3, got %d", decoded.Version)
	}
}

func TestValidateUID(t *testing.T) {
	cases := []struct {
		uid     string
		wantErr bool
	}{
		{"1504687050", false},
		{"123456789", false},
		{"", true},
		{"12345678", true},
		{"12345678901", true},
		{"1504687a50", true},
		{"150468705 ", true},
	}
	for _, tc := range cases {
		err := ValidateUID(tc.uid)
		if (err != nil) != tc.wantErr {
			t.Errorf("ValidateUID(%q): expected error=%v, got %v", tc.uid, tc.wantErr, err)
		}
	}
}

func TestIsValidRegion(t *testing.T) {
	for _, region := range []string{RegionEurope, RegionAmerica, RegionAsia, RegionTWHKMO} {
		if !IsValidRegion(region) {
			t.Errorf("expected region %q to be valid", region)
		}
	}
	if IsValidRegion("Mars") {
		t.Error("expected region Mars to be invalid")
	}
}

func TestRegionFromUID(t *testing.T) {
	cases := []struct {
		uid        string
		wantRegion string
		wantOK     bool
	}{
		{"1004687050", RegionAmerica, true},
		{"1304687050", RegionAsia, true},
		{"1504687050", RegionEurope, true},
		{"1704687050", RegionTWHKMO, true},
		{"1904687050", "", false},
		{"150468705", "", false},
		{"15046870501", "", false},
		{"", "", false},
	}
	for _, tc := range cases {
		gotRegion, gotOK := RegionFromUID(tc.uid)
		if gotOK != tc.wantOK || gotRegion != tc.wantRegion {
			t.Errorf("RegionFromUID(%q) = (%q, %v), want (%q, %v)", tc.uid, gotRegion, gotOK, tc.wantRegion, tc.wantOK)
		}
	}
}

func TestAgentBuild_Helpers(t *testing.T) {
	weaponUID := "1511_9903502"
	build := AgentBuild{
		DiscUIDs:  []string{"33041_12345678", "33010_87654321"},
		DiscSlots: map[string]int{"33041_12345678": 1, "33010_87654321": 4},
		WeaponUID: &weaponUID,
	}

	if !build.HasWeapon() {
		t.Error("expected build to have a weapon")
	}
	if !build.HasDiscUID("33041_12345678") {
		t.Error("expected disc uid to be found")
	}
	if build.HasDiscUID("00000_missing") {
		t.Error("expected unknown disc uid not to be found")
	}
	if build.DiscSlot("33041_12345678") != 1 {
		t.Errorf("expected slot 1, got %d", build.DiscSlot("33041_12345678"))
	}
	if build.DiscSlot("33010_87654321") != 4 {
		t.Errorf("expected slot 4, got %d", build.DiscSlot("33010_87654321"))
	}
	if build.DiscSlot("unknown") != 0 {
		t.Errorf("expected slot 0 for unknown disc, got %d", build.DiscSlot("unknown"))
	}

	// Fallback to RawData
	buildRaw := AgentBuild{
		DiscUIDs: []string{"99999_fallback"},
		RawData:  json.RawMessage(`{"EquippedList":[{"Slot":6,"Equipment":{"Uid":99999}}]}`),
	}
	if buildRaw.DiscSlot("99999") != 6 {
		t.Errorf("expected slot 6 from raw_data, got %d", buildRaw.DiscSlot("99999"))
	}

	noWeapon := AgentBuild{}
	if noWeapon.HasWeapon() {
		t.Error("expected build without weapon uid to report HasWeapon=false")
	}
	empty := ""
	noWeapon.WeaponUID = &empty
	if noWeapon.HasWeapon() {
		t.Error("expected build with empty weapon uid to report HasWeapon=false")
	}
}

func TestTeamMember_ValidateSlot(t *testing.T) {
	member := TeamMember{SlotNumber: 3}
	if err := member.ValidateSlot(); err != nil {
		t.Errorf("expected slot 3 to be valid, got %v", err)
	}

	for _, slot := range []int{0, -1, 4} {
		member.SlotNumber = slot
		if err := member.ValidateSlot(); err == nil {
			t.Errorf("expected slot %d to be rejected", slot)
		}
	}
}

func TestConflictReport_JSONShape(t *testing.T) {
	report := ConflictReport{
		IsValid: false,
		Errors: []ConflictError{
			{
				Code:              ConflictItemReuse,
				Message:           ConflictDiscReuseSlotMessage(5),
				ItemType:          ItemDriveDisc,
				ItemUID:           "33041_12345678",
				Slot:              5,
				ConflictingBuilds: []string{"Miyabi (Anomaly)", "Ellen (Main)"},
			},
			{
				Code:    ConflictDuplicateAgent,
				Message: ConflictDuplicateAgentMessage("Miyabi"),
				AgentID: 1511,
			},
		},
	}

	data, err := json.Marshal(report)
	if err != nil {
		t.Fatalf("failed to marshal conflict report: %v", err)
	}

	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		t.Fatalf("failed to unmarshal conflict report: %v", err)
	}
	if raw["is_valid"] != false {
		t.Errorf("expected is_valid false, got %v", raw["is_valid"])
	}

	errors, ok := raw["errors"].([]any)
	if !ok || len(errors) != 2 {
		t.Fatalf("expected 2 errors in report, got %v", raw["errors"])
	}

	first := errors[0].(map[string]any)
	for _, key := range []string{"code", "message", "item_type", "item_uid", "slot", "conflicting_builds"} {
		if _, ok := first[key]; !ok {
			t.Errorf("expected field %q in item reuse error, got %v", key, first)
		}
	}
	if _, has := first["agent_id"]; has {
		t.Error("expected agent_id to be omitted for item reuse error")
	}

	second := errors[1].(map[string]any)
	if second["agent_id"] != float64(1511) {
		t.Errorf("expected agent_id 1511, got %v", second["agent_id"])
	}
	if _, has := second["slot"]; has {
		t.Error("expected slot to be omitted for duplicate agent error")
	}
}

func TestNewValidReport(t *testing.T) {
	report := NewValidReport()
	if !report.IsValid {
		t.Error("expected report to be valid")
	}
	if report.Errors == nil || len(report.Errors) != 0 {
		t.Errorf("expected non-nil empty errors slice, got %v", report.Errors)
	}
}

func TestGameAccount_IsVerified(t *testing.T) {
	var nilAccount *GameAccount
	if nilAccount.IsVerified() {
		t.Error("expected nil account to not be verified")
	}

	account := &GameAccount{
		UID: "1504687050",
	}
	if account.IsVerified() {
		t.Error("expected account with nil VerifiedAt to not be verified")
	}

	now := time.Now()
	account.VerifiedAt = &now
	if !account.IsVerified() {
		t.Error("expected account with non-nil VerifiedAt to be verified")
	}
}
