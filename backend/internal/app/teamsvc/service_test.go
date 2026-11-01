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
	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	fairy "github.com/kirinyoku/fairy"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildenrich"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

type fixtureEnv struct {
	db        *sql.DB
	svc       *Service
	users     *sqlite.SQLiteUserRepo
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
		svc:      New(teams, builds, accounts, WithUsers(users)),
		users:    users,
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

	// Next team should fail with ErrConflict
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

func TestService_CreateTeamCustomLimit(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	// Set lower custom limit: 2 teams
	customLimit := 2
	if err := env.users.UpdateLimits(ctx, env.ownerID, nil, &customLimit, nil); err != nil {
		t.Fatalf("failed to update limits: %v", err)
	}

	for i := range customLimit {
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

	// 3rd team must fail because custom limit is 2
	_, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Overflow Team",
		BuildIDs:      ids[:1],
	})
	if !errors.Is(err, domain.ErrConflict) {
		t.Errorf("expected ErrConflict for lowered custom team limit, got %v", err)
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

func TestService_GetPublic_PrivateTeamReturnsNotFound(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	isPrivate := false
	team, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Private Team",
		IsPublic:      &isPrivate,
		BuildIDs:      ids[:1],
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	_, err = env.svc.GetPublic(ctx, team.ID)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound reading private team via GetPublic, got %v", err)
	}
}

func TestService_Create_DefaultIsPublicTrue(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	team, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Default Public Team",
		BuildIDs:      ids[:1],
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if !team.IsPublic {
		t.Errorf("expected team to default to is_public = true, got %v", team.IsPublic)
	}
}

type mockEnricher struct{}

func (m *mockEnricher) EnrichAgent(raw *zzz.AvatarData, _ fairy.Language) (*fairy.Agent, error) {
	return &fairy.Agent{
		ID:   raw.ID,
		Name: "Enriched Agent",
	}, nil
}

func TestService_GetPublic_ImplicitMemberRead(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	enricher := buildenrich.New(&mockEnricher{}, nil, 0)
	svc := New(env.teams, env.builds, env.accounts, WithEnricher(enricher), WithUsers(env.users))

	// Ensure all 3 builds are private (IsPublic = false)
	for _, id := range ids {
		b, err := env.builds.GetByID(ctx, id)
		if err != nil {
			t.Fatalf("GetByID failed: %v", err)
		}
		if b.IsPublic {
			t.Fatalf("expected seeded build %s to be private", id)
		}
	}

	nick := "SquadLeader"
	avatar := "https://example.com/squad.png"
	if err := env.accounts.UpdateProfileMetadata(ctx, env.accountID, &nick, &avatar); err != nil {
		t.Fatalf("UpdateProfileMetadata failed: %v", err)
	}

	// Create public team with the 3 private builds
	isPublic := true
	team, err := svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Public Team with Private Builds",
		BuildIDs:      ids,
		IsPublic:      &isPublic,
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	detail, err := svc.GetPublic(ctx, team.ID)
	if err != nil {
		t.Fatalf("GetPublic failed: %v", err)
	}
	if detail.Team == nil || detail.Team.ID != team.ID {
		t.Fatalf("expected team %s, got %v", team.ID, detail.Team)
	}
	if !detail.Team.IsPublic {
		t.Errorf("expected team.IsPublic = true, got %v", detail.Team.IsPublic)
	}
	if len(detail.Members) != 3 {
		t.Fatalf("expected 3 members loaded by Implicit Member Read, got %d", len(detail.Members))
	}

	for i, m := range detail.Members {
		if m.Build == nil {
			t.Fatalf("slot %d: expected non-nil build", i+1)
		}
		if m.Build.AgentName == "" {
			t.Errorf("slot %d: expected non-empty AgentName", i+1)
		}
		if len(m.Build.DiscUIDs) == 0 {
			t.Errorf("slot %d: expected non-empty DiscUIDs", i+1)
		}
		if len(m.Build.BuildData) == 0 {
			t.Errorf("slot %d: expected non-empty BuildData", i+1)
		}
		if m.Build.IsPublic {
			t.Errorf("slot %d: expected build to remain private (is_public=false)", i+1)
		}
	}

	if !detail.Report.IsValid {
		t.Errorf("expected valid conflict report, got %+v", detail.Report.Errors)
	}

	if detail.Owner == nil {
		t.Fatal("expected non-nil Owner")
	}
	if detail.Owner.Nickname == nil || *detail.Owner.Nickname != nick {
		t.Errorf("expected owner nickname %q, got %v", nick, detail.Owner.Nickname)
	}
	if detail.Owner.AvatarURL == nil || *detail.Owner.AvatarURL != avatar {
		t.Errorf("expected owner avatar %q, got %v", avatar, detail.Owner.AvatarURL)
	}
}

func TestService_SetVisibility_AndUpdateIsPublic(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	// Create private team initially
	isPrivate := false
	team, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Initial Private Team",
		IsPublic:      &isPrivate,
		BuildIDs:      ids[:1],
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}
	if team.IsPublic {
		t.Errorf("expected team.IsPublic = false initially")
	}

	// 1. Update with IsPublic: true
	makePublic := true
	updated, err := env.svc.Update(ctx, UpdateInput{
		TeamID:        team.ID,
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Updated Public Team",
		BuildIDs:      ids[:1],
		IsPublic:      &makePublic,
	})
	if err != nil {
		t.Fatalf("update failed: %v", err)
	}
	if !updated.IsPublic {
		t.Errorf("expected team.IsPublic = true after update")
	}

	// 2. Update with IsPublic: nil preserves existing IsPublic (true)
	updated2, err := env.svc.Update(ctx, UpdateInput{
		TeamID:        team.ID,
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Updated Public Team Retained",
		BuildIDs:      ids[:1],
		IsPublic:      nil,
	})
	if err != nil {
		t.Fatalf("update with nil is_public failed: %v", err)
	}
	if !updated2.IsPublic {
		t.Errorf("expected team.IsPublic to be retained as true")
	}

	// 3. SetVisibility back to false
	teamAfter, err := env.svc.SetVisibility(ctx, env.ownerID, team.ID, false)
	if err != nil {
		t.Fatalf("SetVisibility(false) failed: %v", err)
	}
	if teamAfter == nil || teamAfter.IsPublic {
		t.Errorf("expected teamAfter.IsPublic == false, got %v", teamAfter)
	}
	if _, err := env.svc.GetPublic(ctx, team.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for private team, got %v", err)
	}

	// 4. Foreign user cannot SetVisibility
	if _, err := env.svc.SetVisibility(ctx, env.foreignID, team.ID, true); !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("expected ErrForbidden for foreign user, got %v", err)
	}
}

func TestService_ListPublicByAccount(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	// Initially empty
	publicTeams, err := env.svc.ListPublicByAccount(ctx, env.accountID)
	if err != nil {
		t.Fatalf("ListPublicByAccount failed: %v", err)
	}
	if len(publicTeams) != 0 {
		t.Fatalf("expected 0 public teams, got %d", len(publicTeams))
	}

	// Create private team
	isPrivate := false
	t1, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Private Team",
		IsPublic:      &isPrivate,
		BuildIDs:      []uuid.UUID{ids[0]},
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	publicTeams, _ = env.svc.ListPublicByAccount(ctx, env.accountID)
	if len(publicTeams) != 0 {
		t.Fatalf("expected 0 public teams, got %d", len(publicTeams))
	}

	// Create public team
	isPublic := true
	t2, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Public Team",
		IsPublic:      &isPublic,
		BuildIDs:      []uuid.UUID{ids[1]},
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	publicTeams, err = env.svc.ListPublicByAccount(ctx, env.accountID)
	if err != nil {
		t.Fatalf("ListPublicByAccount failed: %v", err)
	}
	if len(publicTeams) != 1 || publicTeams[0].Team.ID != t2.ID {
		t.Fatalf("expected 1 public team with ID %s, got %v", t2.ID, publicTeams)
	}

	// Make t1 public as well
	if _, err := env.svc.SetVisibility(ctx, env.ownerID, t1.ID, true); err != nil {
		t.Fatalf("SetVisibility failed: %v", err)
	}
	publicTeams, err = env.svc.ListPublicByAccount(ctx, env.accountID)
	if err != nil {
		t.Fatalf("ListPublicByAccount failed: %v", err)
	}
	if len(publicTeams) != 2 {
		t.Fatalf("expected 2 public teams, got %d", len(publicTeams))
	}
}

func TestService_Patch(t *testing.T) {
	env := newFixture(t)
	ctx := context.Background()
	ids := env.buildIDs(t)

	team, err := env.svc.Create(ctx, CreateInput{
		UserID:        env.ownerID,
		GameAccountID: env.accountID,
		Name:          "Original Team",
		BuildIDs:      ids[:2],
	})
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	// 1. Patch name and description
	newName := "Patched Team Name"
	newDesc := "Patched Description"
	summary, err := env.svc.Patch(ctx, PatchInput{
		TeamID:      team.ID,
		UserID:      env.ownerID,
		Name:        &newName,
		Description: &newDesc,
	})
	if err != nil {
		t.Fatalf("Patch failed: %v", err)
	}
	if summary.Team.Name != newName {
		t.Errorf("expected team name %q, got %q", newName, summary.Team.Name)
	}
	if summary.Team.Description == nil || *summary.Team.Description != newDesc {
		t.Errorf("expected team description %q, got %v", newDesc, summary.Team.Description)
	}
	if len(summary.Members) != 2 {
		t.Errorf("expected 2 members in summary, got %d", len(summary.Members))
	}

	// 2. Patch visibility alone: updated_at must NOT change
	oldUpdatedAt := summary.Team.UpdatedAt
	isPublicFalse := false
	summary2, err := env.svc.Patch(ctx, PatchInput{
		TeamID:   team.ID,
		UserID:   env.ownerID,
		IsPublic: &isPublicFalse,
	})
	if err != nil {
		t.Fatalf("Patch visibility failed: %v", err)
	}
	if summary2.Team.IsPublic {
		t.Errorf("expected team to be private")
	}
	if !summary2.Team.UpdatedAt.Equal(oldUpdatedAt) {
		t.Errorf("expected updated_at to remain unchanged on visibility toggle, got %v != %v",
			summary2.Team.UpdatedAt, oldUpdatedAt)
	}

	// 3. Foreign user cannot patch
	if _, err := env.svc.Patch(ctx, PatchInput{
		TeamID:   team.ID,
		UserID:   env.foreignID,
		IsPublic: &isPublicFalse,
	}); !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("expected ErrForbidden for foreign user patch, got %v", err)
	}

	// 4. Invalid name returns ErrInvalidInput
	emptyName := "   "
	if _, err := env.svc.Patch(ctx, PatchInput{
		TeamID: team.ID,
		UserID: env.ownerID,
		Name:   &emptyName,
	}); !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput for empty name, got %v", err)
	}
}
