package teamsvc

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

type fixtureEnv struct {
	db        *sql.DB
	svc       *Service
	builds    *sqlite.SQLiteBuildRepo
	teams     *sqlite.SQLiteTeamRepo
	accounts  *sqlite.SQLiteAccountRepo
	ownerID   uuid.UUID
	foreignID uuid.UUID
	accountID uuid.UUID
}

func openTestDB(t *testing.T) *sql.DB {
	t.Helper()

	db, err := sqlite.NewDB(filepath.Join(t.TempDir(), "teams.db"))
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	if err := sqlite.Migrate(context.Background(), db); err != nil {
		t.Fatalf("failed to migrate db: %v", err)
	}
	return db
}

// newFixture seeds two users, one owned account and three builds (Miyabi,
// Ellen, Lycaon) with disjoint equipment.
func newFixture(t *testing.T) *fixtureEnv {
	t.Helper()

	db := openTestDB(t)
	users := sqlite.NewUserRepo(db)
	accounts := sqlite.NewAccountRepo(db)
	builds := sqlite.NewBuildRepo(db)
	teams := sqlite.NewTeamRepo(db)

	env := &fixtureEnv{
		db:       db,
		svc:      New(teams, builds, accounts),
		builds:   builds,
		teams:    teams,
		accounts: accounts,
	}

	for _, u := range []*domain.User{
		{DiscordID: "owner", Username: "owner"},
		{DiscordID: "foreign", Username: "foreign"},
	} {
		if err := users.Create(context.Background(), u); err != nil {
			t.Fatalf("failed to seed user: %v", err)
		}
	}
	owner, _ := users.GetByDiscordID(context.Background(), "owner")
	foreign, _ := users.GetByDiscordID(context.Background(), "foreign")
	env.ownerID = owner.ID
	env.foreignID = foreign.ID

	account := &domain.GameAccount{UserID: env.ownerID, UID: "1504687050"}
	if err := accounts.Create(context.Background(), account); err != nil {
		t.Fatalf("failed to seed account: %v", err)
	}
	env.accountID = account.ID

	for i, spec := range []struct {
		agentID int
		name    string
	}{
		{1511, "Miyabi"},
		{1411, "Ellen"},
		{1181, "Lycaon"},
	} {
		if err := builds.Create(context.Background(), testBuild(env.ownerID, account.ID, spec.agentID, spec.name, i)); err != nil {
			t.Fatalf("failed to seed build: %v", err)
		}
	}
	return env
}

var discCounter int

func testBuild(userID, accountID uuid.UUID, agentID int, agentName string, seq int) *domain.AgentBuild {
	discCounter++
	return &domain.AgentBuild{
		UserID:        userID,
		GameAccountID: accountID,
		AgentID:       agentID,
		AgentName:     agentName,
		Name:          agentName + " Build",
		DiscUIDs:      []string{"33041_" + strconv.Itoa(100000+discCounter)},
		RawData:       json.RawMessage(`{"Id":` + strconv.Itoa(agentID) + `}`),
		BuildData:     json.RawMessage(`{"id":` + strconv.Itoa(agentID) + `}`),
	}
}

// buildIDs returns the seeded builds in slot order.
func (env *fixtureEnv) buildIDs(t *testing.T) []uuid.UUID {
	t.Helper()

	list, err := env.builds.ListByAccount(context.Background(), env.accountID)
	if err != nil {
		t.Fatalf("failed to list seeded builds: %v", err)
	}
	ids := make([]uuid.UUID, 0, len(list))
	for _, b := range list {
		ids = append(ids, b.ID)
	}
	return ids
}

func TestValidate_CleanComposition(t *testing.T) {
	env := newFixture(t)

	report, err := env.svc.Validate(context.Background(), env.ownerID, env.buildIDs(t))
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}
	if !report.IsValid {
		t.Errorf("expected clean report, got %+v", report.Errors)
	}
}

func TestValidate_DetectsConflicts(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()

	ids := env.buildIDs(t)

	// Simulate equipment drift: the second build now also carries the first
	// build's disc (equipment payloads are immutable via the API, so the test
	// writes the drift straight into storage).
	first, _ := env.builds.GetByID(ctx, ids[0])
	shared := first.DiscUIDs[0]
	secondDiscs, _ := json.Marshal([]string{"33041_" + strconv.Itoa(200000), shared})
	if _, err := env.db.ExecContext(ctx,
		`UPDATE agent_builds SET disc_uids = ? WHERE id = ?;`,
		string(secondDiscs), ids[1].String(),
	); err != nil {
		t.Fatalf("failed to simulate drift: %v", err)
	}

	report, err := env.svc.Validate(ctx, env.ownerID, ids)
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}
	if report.IsValid {
		t.Fatal("expected conflicting composition")
	}
	found := false
	for _, e := range report.Errors {
		if e.Code == domain.ConflictItemReuse && e.ItemUID == shared {
			found = true
		}
	}
	if !found {
		t.Errorf("expected ITEM_REUSE for shared disc, got %+v", report.Errors)
	}
}

func TestCreate_SavesTeamWithSlots(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()

	ids := env.buildIDs(t)
	description := "Shiyu 7"
	team, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Ice Mono",
		Description:   &description,
		BuildIDs:      ids,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	detail, err := env.svc.Get(ctx, env.ownerID, team.ID)
	if err != nil {
		t.Fatalf("get detail failed: %v", err)
	}
	if len(detail.Members) != 3 {
		t.Fatalf("expected 3 members, got %d", len(detail.Members))
	}
	for i, m := range detail.Members {
		if m.Member.SlotNumber != i+1 {
			t.Errorf("expected slot %d, got %d", i+1, m.Member.SlotNumber)
		}
		if m.Build.AgentName == "" {
			t.Errorf("expected build payload loaded for slot %d", m.Member.SlotNumber)
		}
	}
	if detail.Team.Description == nil || *detail.Team.Description != description {
		t.Errorf("expected description preserved, got %v", detail.Team.Description)
	}
}

func TestCreate_RejectsConflictsAtomically(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()

	ids := env.buildIDs(t)

	// Duplicate the same build twice → same agent twice → DUPLICATE_AGENT.
	_, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Broken",
		BuildIDs:      []uuid.UUID{ids[0], ids[0]},
	})

	var validationErr *ValidationError
	if !errors.As(err, &validationErr) {
		t.Fatalf("expected ValidationError, got %v", err)
	}
	if validationErr.Report.IsValid {
		t.Error("expected invalid report")
	}

	// No partial data must remain.
	teams, err := env.svc.List(ctx, env.ownerID, env.accountID)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(teams) != 0 {
		t.Errorf("expected rejected team to leave no rows, got %d", len(teams))
	}
}

func TestCreate_InputValidation(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	cases := []struct {
		name string
		in   CreateInput
		want error
	}{
		{"empty name with empty agent names", func() CreateInput {
			blankBuild := &domain.AgentBuild{
				UserID: env.ownerID, GameAccountID: env.accountID, AgentID: 9999, AgentName: "   ",
				Name: "No Agent Name", DiscUIDs: []string{"99999_2"}, RawData: json.RawMessage(`{"Id":9999}`),
			}
			if err := env.builds.Create(ctx, blankBuild); err != nil {
				t.Fatalf("seed failed: %v", err)
			}
			return CreateInput{UserID: env.ownerID, GameAccountID: env.accountID, BuildIDs: []uuid.UUID{blankBuild.ID}}
		}(), domain.ErrInvalidInput},
		{"no builds", CreateInput{UserID: env.ownerID, GameAccountID: env.accountID,
			Name: "Empty"}, domain.ErrInvalidInput},
		{"too many builds", CreateInput{UserID: env.ownerID, GameAccountID: env.accountID,
			Name: "Big", BuildIDs: []uuid.UUID{ids[0], ids[1], ids[2], uuid.New()}}, domain.ErrInvalidInput},
		{"unknown account", CreateInput{UserID: env.ownerID, GameAccountID: uuid.New(),
			Name: "X", BuildIDs: ids[:1]}, domain.ErrNotFound},
		{"foreign account", CreateInput{UserID: env.foreignID, GameAccountID: env.accountID,
			Name: "X", BuildIDs: ids[:1]}, domain.ErrForbidden},
		{"unknown build", CreateInput{UserID: env.ownerID, GameAccountID: env.accountID,
			Name: "X", BuildIDs: []uuid.UUID{uuid.New()}}, domain.ErrNotFound},
		{"build of another account", func() CreateInput {
			otherAccount := &domain.GameAccount{UserID: env.ownerID, UID: "1504699999"}
			if err := env.accounts.Create(ctx, otherAccount); err != nil {
				t.Fatalf("seed failed: %v", err)
			}
			other := &domain.AgentBuild{
				UserID: env.ownerID, GameAccountID: otherAccount.ID, AgentID: 1221, AgentName: "Zhu Yuan",
				Name: "Other Account", DiscUIDs: []string{"99999_1"}, RawData: json.RawMessage(`{"Id":1221}`),
			}
			if err := env.builds.Create(ctx, other); err != nil {
				t.Fatalf("seed failed: %v", err)
			}
			return CreateInput{UserID: env.ownerID, GameAccountID: env.accountID,
				Name: "Mixed", BuildIDs: []uuid.UUID{other.ID}}
		}(), domain.ErrForbidden},
	}
	for _, tc := range cases {
		if _, err := env.svc.Create(ctx, tc.in); !errors.Is(err, tc.want) {
			t.Errorf("%s: expected %v, got %v", tc.name, tc.want, err)
		}
	}
}

func TestList_ReturnsValidityReports(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()

	ids := env.buildIDs(t)
	if _, err := env.svc.Create(ctx, CreateInput{
		UserID: env.ownerID, GameAccountID: env.accountID, Name: "Good", BuildIDs: ids,
	}); err != nil {
		t.Fatalf("create failed: %v", err)
	}

	summaries, err := env.svc.List(ctx, env.ownerID, env.accountID)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("expected 1 summary, got %d", len(summaries))
	}
	if summaries[0].Team.Name != "Good" || !summaries[0].Report.IsValid {
		t.Errorf("unexpected summary: %+v", summaries[0])
	}

	if _, err := env.svc.List(ctx, env.foreignID, env.accountID); !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("expected ErrForbidden listing foreign account, got %v", err)
	}
}

func TestGetAndDelete_OwnershipEnforced(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()

	ids := env.buildIDs(t)
	team, err := env.svc.Create(ctx, CreateInput{
		UserID: env.ownerID, GameAccountID: env.accountID, Name: "Mine", BuildIDs: ids[:1],
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	if _, err := env.svc.Get(ctx, env.foreignID, team.ID); !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("expected ErrForbidden reading foreign team, got %v", err)
	}
	if err := env.svc.Delete(ctx, env.foreignID, team.ID); !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("expected ErrForbidden deleting foreign team, got %v", err)
	}
	if err := env.svc.Delete(ctx, env.ownerID, uuid.New()); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound deleting missing team, got %v", err)
	}

	if err := env.svc.Delete(ctx, env.ownerID, team.ID); err != nil {
		t.Fatalf("delete failed: %v", err)
	}
	if _, err := env.svc.Get(ctx, env.ownerID, team.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected deleted team to be gone, got %v", err)
	}

	// The referenced build survives team deletion.
	if _, err := env.builds.GetByID(ctx, ids[0]); err != nil {
		t.Errorf("expected referenced build to survive, got %v", err)
	}
}

func TestUpdate_SuccessAndConflict(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()

	ids := env.buildIDs(t)
	team, err := env.svc.Create(ctx, CreateInput{
		UserID: env.ownerID, GameAccountID: env.accountID, Name: "Original", BuildIDs: ids[:2],
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	// Update to 3 members with new name.
	desc := "Updated description"
	updated, err := env.svc.Update(ctx, UpdateInput{
		TeamID:        team.ID,
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Updated Name",
		Description:   &desc,
		BuildIDs:      ids[:3],
	})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if updated.Name != "Updated Name" || updated.Description == nil || *updated.Description != desc {
		t.Errorf("unexpected updated team: %+v", updated)
	}

	detail, err := env.svc.Get(ctx, env.ownerID, team.ID)
	if err != nil {
		t.Fatalf("get failed: %v", err)
	}
	if len(detail.Members) != 3 {
		t.Errorf("expected 3 members after update, got %d", len(detail.Members))
	}

	// Foreign update rejected.
	if _, err := env.svc.Update(ctx, UpdateInput{
		TeamID: team.ID, UserID: env.foreignID, GameAccountID: env.accountID, Name: "Hacked", BuildIDs: ids[:1],
	}); !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("expected ErrForbidden updating foreign team, got %v", err)
	}

	// Conflict update rejected.
	if _, err := env.svc.Update(ctx, UpdateInput{
		TeamID: team.ID, UserID: env.ownerID, GameAccountID: env.accountID, Name: "Dup", BuildIDs: []uuid.UUID{ids[0], ids[0]},
	}); err == nil {
		t.Fatal("expected conflict error updating team with duplicate agent")
	}
}

func TestService_CreateTeamLimitReached(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	for i := range domain.MaxTeamsPerAccount {
		_, err := env.svc.Create(ctx, CreateInput{
			UserID:        env.ownerID,
			GameAccountID: env.accountID,
			Name:          "Team " + strconv.Itoa(i),
			BuildIDs:      ids[:1],
		})
		if err != nil {
			t.Fatalf("failed to create team %d: %v", i, err)
		}
	}

	// 11th team should fail with ErrConflict
	_, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Overflow Team",
		BuildIDs:      ids[:1],
	})
	if !errors.Is(err, domain.ErrConflict) {
		t.Errorf("expected ErrConflict when max teams per account is reached, got %v", err)
	}
}

func TestService_CreateDuplicateBuildRejected(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	_, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Dup Team",
		BuildIDs:      []uuid.UUID{ids[0], ids[0]},
	})
	var valErr *ValidationError
	if !errors.As(err, &valErr) {
		t.Errorf("expected ValidationError for duplicate build in team, got %v", err)
	}
}

func TestCreate_AutoGeneratedName(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	// Create with empty name and 2 builds
	team, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "",
		BuildIDs:      []uuid.UUID{ids[0], ids[1]},
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	b0, _ := env.builds.GetByID(ctx, ids[0])
	b1, _ := env.builds.GetByID(ctx, ids[1])
	expected := b0.AgentName + "/" + b1.AgentName
	if team.Name != expected {
		t.Errorf("expected auto-generated name %q, got %q", expected, team.Name)
	}

	// Create with 3 builds
	team3, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "   ",
		BuildIDs:      []uuid.UUID{ids[0], ids[1], ids[2]},
	})
	if err != nil {
		t.Fatalf("create 3-member team failed: %v", err)
	}
	b2, _ := env.builds.GetByID(ctx, ids[2])
	expected3 := b0.AgentName + "/" + b1.AgentName + "/" + b2.AgentName
	if team3.Name != expected3 {
		t.Errorf("expected auto-generated name %q, got %q", expected3, team3.Name)
	}
}

func TestUpdate_AutoGeneratedName(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	team, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Custom Name",
		BuildIDs:      []uuid.UUID{ids[0]},
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	// Update with empty name to trigger auto-generation
	updated, err := env.svc.Update(ctx, UpdateInput{
		TeamID:        team.ID,
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "",
		BuildIDs:      []uuid.UUID{ids[1], ids[0]},
	})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	b1, _ := env.builds.GetByID(ctx, ids[1])
	b0, _ := env.builds.GetByID(ctx, ids[0])
	expected := b1.AgentName + "/" + b0.AgentName
	if updated.Name != expected {
		t.Errorf("expected auto-generated name %q, got %q", expected, updated.Name)
	}
}

func TestCreate_UnicodeNameAndSafeTruncation(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	// 100 Cyrillic characters (200 bytes) must succeed because it fits in 100 runes
	cyrillic100 := strings.Repeat("я", 100)
	team, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          cyrillic100,
		BuildIDs:      []uuid.UUID{ids[0]},
	})
	if err != nil {
		t.Fatalf("expected 100-character Cyrillic name to succeed, got %v", err)
	}
	if team.Name != cyrillic100 {
		t.Errorf("expected team name %q, got %q", cyrillic100, team.Name)
	}

	// 101 Cyrillic characters must fail
	cyrillic101 := strings.Repeat("я", 101)
	_, err = env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          cyrillic101,
		BuildIDs:      []uuid.UUID{ids[0]},
	})
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput for 101-character Cyrillic name, got %v", err)
	}
}
