package sqlite

import (
	"context"
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestBuildRepo_CreateGetRoundtrip(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	repo := NewBuildRepo(db)

	user := seedUser(t, ctx, users, "606060606060606060")
	account := seedAccount(t, ctx, accounts, user.ID, "1504687060")

	build := makeDomainBuild(user.ID, account.ID, "Anomaly Main", 1511)
	if err := repo.Create(ctx, build); err != nil {
		t.Fatalf("failed to create build: %v", err)
	}
	if build.ID == uuid.Nil {
		t.Error("expected generated build ID")
	}

	got, err := repo.GetByID(ctx, build.ID)
	if err != nil {
		t.Fatalf("failed to get build: %v", err)
	}
	if got.AgentID != 1511 || got.AgentName != "Miyabi" || got.Name != "Anomaly Main" {
		t.Errorf("metadata mismatch: %+v", got)
	}
	if got.WeaponUID == nil || *got.WeaponUID != "1511_9903502" {
		t.Errorf("expected weapon uid preserved, got %v", got.WeaponUID)
	}
	if got.WeaponID == nil || *got.WeaponID != 14109 {
		t.Errorf("expected weapon id preserved, got %v", got.WeaponID)
	}
	if len(got.DiscUIDs) != 6 || got.DiscUIDs[0] != "33041_1" || got.DiscUIDs[5] != "34100_6" {
		t.Errorf("expected disc uids preserved, got %v", got.DiscUIDs)
	}

	var payload map[string]any
	if err := json.Unmarshal(got.RawData, &payload); err != nil {
		t.Fatalf("raw_data is not valid json: %v", err)
	}
	if int(payload["Id"].(float64)) != 1511 {
		t.Errorf("expected Id in raw_data, got %v", payload["Id"])
	}

	assertTimeEqual(t, build.CreatedAt, got.CreatedAt)
	assertTimeEqual(t, build.UpdatedAt, got.UpdatedAt)
}

func TestBuildRepo_BuildWithoutWeapon(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	repo := NewBuildRepo(db)

	user := seedUser(t, ctx, users, "616161616161616161")
	account := seedAccount(t, ctx, accounts, user.ID, "1504687061")

	build := makeDomainBuild(user.ID, account.ID, "Partial", 1511)
	build.WeaponUID = nil
	build.WeaponID = nil
	build.DiscUIDs = []string{"33041_1"}

	if err := repo.Create(ctx, build); err != nil {
		t.Fatalf("failed to create partial build: %v", err)
	}

	got, err := repo.GetByID(ctx, build.ID)
	if err != nil {
		t.Fatalf("failed to get partial build: %v", err)
	}
	if got.WeaponUID != nil || got.WeaponID != nil {
		t.Errorf("expected nil weapon fields, got %+v / %+v", got.WeaponUID, got.WeaponID)
	}
	if len(got.DiscUIDs) != 1 {
		t.Errorf("expected single disc, got %v", got.DiscUIDs)
	}
}

func TestBuildRepo_ListByAccountFiltersAndOrders(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	repo := NewBuildRepo(db)

	user := seedUser(t, ctx, users, "626262626262626262")
	accountA := seedAccount(t, ctx, accounts, user.ID, "1504687062")
	accountB := seedAccount(t, ctx, accounts, user.ID, "1504687063")

	first := makeDomainBuild(user.ID, accountA.ID, "First", 1511)
	second := makeDomainBuild(user.ID, accountA.ID, "Second", 1411)
	other := makeDomainBuild(user.ID, accountB.ID, "Other", 1181)

	for _, b := range []*domain.AgentBuild{first, second, other} {
		if err := repo.Create(ctx, b); err != nil {
			t.Fatalf("failed to create build: %v", err)
		}
		time.Sleep(10 * time.Millisecond)
	}

	list, err := repo.ListByAccount(ctx, accountA.ID)
	if err != nil {
		t.Fatalf("failed to list builds: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 builds for account A, got %d", len(list))
	}
	if list[0].Name != "First" || list[1].Name != "Second" {
		t.Errorf("expected insertion order, got %s, %s", list[0].Name, list[1].Name)
	}
}

func TestBuildRepo_UpdateName(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	repo := NewBuildRepo(db)

	user := seedUser(t, ctx, users, "636363636363636363")
	account := seedAccount(t, ctx, accounts, user.ID, "1504687064")
	build := makeDomainBuild(user.ID, account.ID, "Old Name", 1511)
	if err := repo.Create(ctx, build); err != nil {
		t.Fatalf("failed to create build: %v", err)
	}

	time.Sleep(10 * time.Millisecond)
	if err := repo.UpdateName(ctx, build.ID, "New Name"); err != nil {
		t.Fatalf("failed to rename build: %v", err)
	}

	got, _ := repo.GetByID(ctx, build.ID)
	if got.Name != "New Name" {
		t.Errorf("expected renamed build, got %q", got.Name)
	}
	// Equipment payload stays immutable.
	if len(got.DiscUIDs) != 6 {
		t.Errorf("expected equipment untouched by rename, got %v", got.DiscUIDs)
	}
	if !got.UpdatedAt.After(got.CreatedAt) {
		t.Errorf("expected updated_at refreshed after rename, created=%v updated=%v", got.CreatedAt, got.UpdatedAt)
	}

	if err := repo.UpdateName(ctx, uuid.New(), "Ghost"); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound renaming missing build, got %v", err)
	}
}

func TestBuildRepo_DeleteProtectedByTeamUsage(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	builds := NewBuildRepo(db)
	teams := NewTeamRepo(db)

	user := seedUser(t, ctx, users, "646464646464646464")
	account := seedAccount(t, ctx, accounts, user.ID, "1504687065")

	used := makeDomainBuild(user.ID, account.ID, "Used In Team", 1511)
	free := makeDomainBuild(user.ID, account.ID, "Free", 1411)
	for _, b := range []*domain.AgentBuild{used, free} {
		if err := builds.Create(ctx, b); err != nil {
			t.Fatalf("failed to create build: %v", err)
		}
	}

	team := &domain.Team{UserID: user.ID, GameAccountID: account.ID, Name: "Ice Mono"}
	members := []domain.TeamMember{{SlotNumber: 1, BuildID: used.ID}}
	if err := teams.Create(ctx, team, members); err != nil {
		t.Fatalf("failed to seed team: %v", err)
	}

	if err := builds.Delete(ctx, used.ID); !errors.Is(err, domain.ErrConflict) {
		t.Errorf("expected ErrConflict deleting team-used build, got %v", err)
	}
	if _, err := builds.GetByID(ctx, used.ID); err != nil {
		t.Errorf("expected used build to survive delete attempt: %v", err)
	}

	if err := builds.Delete(ctx, free.ID); err != nil {
		t.Fatalf("expected unused build deletion to succeed, got %v", err)
	}
	if _, err := builds.GetByID(ctx, free.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected deleted build to be gone, got %v", err)
	}
}
