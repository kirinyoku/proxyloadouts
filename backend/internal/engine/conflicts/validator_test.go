package conflicts

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

var (
	accountA = uuid.New()
	accountB = uuid.New()
)

func weapon(uid string) *string { return &uid }

// makeBuild creates a build with the given composition.
func makeBuild(name string, agentID int, agentName string, account uuid.UUID, wUID *string, discs []string) *domain.AgentBuild {
	return makeBuildWithSlots(name, agentID, agentName, account, wUID, discs, nil)
}

// makeBuildWithSlots creates a build with specified disc slots.
func makeBuildWithSlots(name string, agentID int, agentName string, account uuid.UUID, wUID *string, discs []string, slots map[string]int) *domain.AgentBuild {
	return &domain.AgentBuild{
		ID:            uuid.New(),
		GameAccountID: account,
		AgentID:       agentID,
		AgentName:     agentName,
		Name:          name,
		WeaponUID:     wUID,
		DiscUIDs:      discs,
		DiscSlots:     slots,
	}
}

// codes returns the set of conflict codes in the report.
func codes(report domain.ConflictReport) map[domain.ConflictCode]int {
	set := make(map[domain.ConflictCode]int)
	for _, e := range report.Errors {
		set[e.Code]++
	}
	return set
}

func TestValidate_ValidTeam(t *testing.T) {
	builds := []*domain.AgentBuild{
		makeBuild("Miyabi (Anomaly)", 1511, "Miyabi", accountA, weapon("1511_9903502"),
			[]string{"32700_1", "32700_2", "32700_3", "34100_4", "34100_5", "34100_6"}),
		makeBuild("Ellen (Main)", 1411, "Ellen", accountA, weapon("1411_9903011"),
			[]string{"31000_11", "31000_12", "31000_13", "32200_14", "32200_15", "32200_16"}),
		makeBuild("Lycaon (Stun)", 1181, "Lycaon", accountA, weapon("1181_9903008"),
			[]string{"31200_21", "31200_22", "31200_23", "31600_24", "31600_25", "31600_26"}),
	}

	report := Validate(builds)
	if !report.IsValid {
		t.Fatalf("expected valid team, got errors: %+v", report.Errors)
	}
	if report.Errors == nil || len(report.Errors) != 0 {
		t.Errorf("expected non-nil empty errors, got %+v", report.Errors)
	}
}

func TestValidate_EmptyAndSingle(t *testing.T) {
	if report := Validate(nil); !report.IsValid {
		t.Errorf("expected nil composition to be valid, got %+v", report.Errors)
	}
	single := []*domain.AgentBuild{
		makeBuild("Miyabi (Anomaly)", 1511, "Miyabi", accountA, weapon("1511_9903502"), []string{"32700_1"}),
	}
	if report := Validate(single); !report.IsValid {
		t.Errorf("expected single build to be valid, got %+v", report.Errors)
	}
}

func TestValidate_DuplicateAgent(t *testing.T) {
	builds := []*domain.AgentBuild{
		makeBuild("Miyabi (Anomaly)", 1511, "Miyabi", accountA, weapon("w1"), []string{"d1"}),
		makeBuild("Miyabi (Crit)", 1511, "Miyabi", accountA, weapon("w2"), []string{"d2"}),
	}

	report := Validate(builds)
	if report.IsValid {
		t.Fatal("expected invalid team")
	}
	set := codes(report)
	if set[domain.ConflictDuplicateAgent] != 1 {
		t.Fatalf("expected exactly one DUPLICATE_AGENT error, got %+v", report.Errors)
	}

	err := report.Errors[0]
	if err.AgentID != 1511 {
		t.Errorf("expected agent_id 1511, got %d", err.AgentID)
	}
	if err.Message != domain.ConflictDuplicateAgentMessage("Miyabi") {
		t.Errorf("expected message %q, got %q", domain.ConflictDuplicateAgentMessage("Miyabi"), err.Message)
	}
	if len(err.ConflictingBuilds) != 2 || err.ConflictingBuilds[0] != "Miyabi (Anomaly)" || err.ConflictingBuilds[1] != "Miyabi (Crit)" {
		t.Errorf("expected both conflicting build names, got %v", err.ConflictingBuilds)
	}
}

func TestValidate_MultipleDuplicateAgentsSorted(t *testing.T) {
	builds := []*domain.AgentBuild{
		makeBuild("Ellen A", 1411, "Ellen", accountA, nil, nil),
		makeBuild("Ellen B", 1411, "Ellen", accountA, nil, nil),
		makeBuild("Miyabi A", 1511, "Miyabi", accountA, nil, nil),
		makeBuild("Miyabi B", 1511, "Miyabi", accountA, nil, nil),
	}

	report := Validate(builds)
	set := codes(report)
	if set[domain.ConflictDuplicateAgent] != 2 {
		t.Fatalf("expected two DUPLICATE_AGENT errors, got %+v", report.Errors)
	}
	if report.Errors[0].AgentID != 1411 || report.Errors[1].AgentID != 1511 {
		t.Errorf("expected errors sorted by agent id (1411, 1511), got %d, %d",
			report.Errors[0].AgentID, report.Errors[1].AgentID)
	}
}

func TestValidate_WeaponReuse(t *testing.T) {
	builds := []*domain.AgentBuild{
		makeBuild("Miyabi (Anomaly)", 1511, "Miyabi", accountA, weapon("1511_9903502"), nil),
		makeBuild("Ellen (Main)", 1411, "Ellen", accountA, weapon("1511_9903502"), nil),
	}

	report := Validate(builds)
	set := codes(report)
	if set[domain.ConflictWeaponReuse] != 1 {
		t.Fatalf("expected exactly one WEAPON_REUSE error, got %+v", report.Errors)
	}

	err := report.Errors[0]
	if err.ItemType != domain.ItemWEngine {
		t.Errorf("expected item_type w_engine, got %q", err.ItemType)
	}
	if err.ItemUID != "1511_9903502" {
		t.Errorf("expected item_uid 1511_9903502, got %q", err.ItemUID)
	}
	if err.Message != domain.ConflictWeaponReuseMessage {
		t.Errorf("expected message %q, got %q", domain.ConflictWeaponReuseMessage, err.Message)
	}
	if len(err.ConflictingBuilds) != 2 {
		t.Errorf("expected two conflicting builds, got %v", err.ConflictingBuilds)
	}
}

func TestValidate_BuildWithoutWeaponSkipped(t *testing.T) {
	builds := []*domain.AgentBuild{
		makeBuild("No Weapon A", 1511, "Miyabi", accountA, nil, nil),
		makeBuild("No Weapon B", 1411, "Ellen", accountA, nil, nil),
	}

	report := Validate(builds)
	if !report.IsValid {
		t.Errorf("expected builds without weapons to be valid, got %+v", report.Errors)
	}
}

func TestValidate_DiscReuseBetweenTwoBuilds(t *testing.T) {
	shared := "33041_12345678"
	builds := []*domain.AgentBuild{
		makeBuildWithSlots("Miyabi (Anomaly)", 1511, "Miyabi", accountA, nil,
			[]string{shared, "32700_2", "32700_3"}, map[string]int{shared: 5, "32700_2": 2, "32700_3": 3}),
		makeBuildWithSlots("Ellen (Main)", 1411, "Ellen", accountA, nil,
			[]string{"31000_11", shared, "31000_13"}, map[string]int{"31000_11": 1, shared: 5, "31000_13": 3}),
	}

	report := Validate(builds)
	set := codes(report)
	if set[domain.ConflictItemReuse] != 1 {
		t.Fatalf("expected exactly one ITEM_REUSE error, got %+v", report.Errors)
	}

	err := report.Errors[0]
	if err.ItemType != domain.ItemDriveDisc {
		t.Errorf("expected item_type drive_disc, got %q", err.ItemType)
	}
	if err.ItemUID != shared {
		t.Errorf("expected item_uid %q, got %q", shared, err.ItemUID)
	}
	if err.Slot != 5 {
		t.Errorf("expected slot 5, got %d", err.Slot)
	}
	if err.Message != domain.ConflictDiscReuseSlotMessage(5) {
		t.Errorf("expected message %q, got %q", domain.ConflictDiscReuseSlotMessage(5), err.Message)
	}
	if len(err.ConflictingBuilds) != 2 ||
		err.ConflictingBuilds[0] != "Miyabi (Anomaly)" ||
		err.ConflictingBuilds[1] != "Ellen (Main)" {
		t.Errorf("unexpected conflicting builds: %v", err.ConflictingBuilds)
	}
}

func TestValidate_DiscSharedAcrossThreeBuilds(t *testing.T) {
	shared := "33041_12345678"
	builds := []*domain.AgentBuild{
		makeBuild("A", 1511, "Miyabi", accountA, nil, []string{shared}),
		makeBuild("B", 1411, "Ellen", accountA, nil, []string{shared}),
		makeBuild("C", 1181, "Lycaon", accountA, nil, []string{shared}),
	}

	report := Validate(builds)
	set := codes(report)
	if set[domain.ConflictItemReuse] != 1 {
		t.Fatalf("expected a single aggregated ITEM_REUSE error, got %+v", report.Errors)
	}
	if len(report.Errors[0].ConflictingBuilds) != 3 {
		t.Errorf("expected three conflicting builds, got %v", report.Errors[0].ConflictingBuilds)
	}
}

func TestValidate_AccountMismatch(t *testing.T) {
	builds := []*domain.AgentBuild{
		makeBuild("Miyabi (Main)", 1511, "Miyabi", accountA, nil, nil),
		makeBuild("Ellen (Twink)", 1411, "Ellen", accountB, nil, nil),
	}

	report := Validate(builds)
	set := codes(report)
	if set[domain.ConflictAccountMismatch] != 1 {
		t.Fatalf("expected exactly one ACCOUNT_MISMATCH error, got %+v", report.Errors)
	}
	if len(report.Errors[0].ConflictingBuilds) != 2 {
		t.Errorf("expected both builds listed, got %v", report.Errors[0].ConflictingBuilds)
	}
	if report.Errors[0].Message != domain.ConflictAccountMismatchMessage {
		t.Errorf("expected message %q, got %q", domain.ConflictAccountMismatchMessage, report.Errors[0].Message)
	}
}

func TestValidate_AccountMismatchSameAccountValid(t *testing.T) {
	builds := []*domain.AgentBuild{
		makeBuild("A", 1511, "Miyabi", accountA, nil, nil),
		makeBuild("B", 1411, "Ellen", accountA, nil, nil),
	}
	if report := Validate(builds); !report.IsValid {
		t.Errorf("expected same-account team to be valid, got %+v", report.Errors)
	}
}

func TestValidate_CombinedConflicts(t *testing.T) {
	sharedDisc := "33041_12345678"
	sharedWeapon := "1511_9903502"
	builds := []*domain.AgentBuild{
		makeBuild("Miyabi (Anomaly)", 1511, "Miyabi", accountA, &sharedWeapon, []string{sharedDisc}),
		makeBuild("Miyabi (Crit)", 1511, "Miyabi", accountB, &sharedWeapon, []string{sharedDisc}),
	}

	report := Validate(builds)
	if report.IsValid {
		t.Fatal("expected invalid team")
	}

	set := codes(report)
	for _, code := range []domain.ConflictCode{
		domain.ConflictAccountMismatch,
		domain.ConflictDuplicateAgent,
		domain.ConflictWeaponReuse,
		domain.ConflictItemReuse,
	} {
		if set[code] == 0 {
			t.Errorf("expected %s error in combined report, got %+v", code, report.Errors)
		}
	}
}

func TestValidate_DeterministicReport(t *testing.T) {
	shared := "33041_12345678"
	builds := []*domain.AgentBuild{
		makeBuild("Miyabi A", 1511, "Miyabi", accountA, weapon("w-shared"), []string{shared}),
		makeBuild("Miyabi B", 1511, "Miyabi", accountA, weapon("w-shared"), []string{shared}),
		makeBuild("Ellen", 1411, "Ellen", accountB, nil, nil),
	}

	first, err := json.Marshal(Validate(builds))
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}
	for range 10 {
		next, _ := json.Marshal(Validate(builds))
		if string(first) != string(next) {
			t.Fatalf("report is not deterministic:\nfirst:  %s\nnext:   %s", first, next)
		}
	}
}
