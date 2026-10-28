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

func TestBuildRepo_UpdateVisibility(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	repo := NewBuildRepo(db)

	user := seedUser(t, ctx, users, "656565656565656565")
	account := seedAccount(t, ctx, accounts, user.ID, "1504687066")

	build := makeDomainBuild(user.ID, account.ID, "Private Preset", 1511)
	build.IsPublic = false
	if err := repo.Create(ctx, build); err != nil {
		t.Fatalf("failed to create build: %v", err)
	}

	time.Sleep(10 * time.Millisecond)
	if err := repo.UpdateVisibility(ctx, build.ID, true); err != nil {
		t.Fatalf("failed to update visibility to true: %v", err)
	}

	got, err := repo.GetByID(ctx, build.ID)
	if err != nil {
		t.Fatalf("failed to get build: %v", err)
	}
	if !got.IsPublic {
		t.Error("expected build.IsPublic == true after update")
	}
	if !got.UpdatedAt.After(build.UpdatedAt) {
		t.Errorf("expected updated_at to advance, before=%v, after=%v", build.UpdatedAt, got.UpdatedAt)
	}

	if err := repo.UpdateVisibility(ctx, build.ID, false); err != nil {
		t.Fatalf("failed to update visibility to false: %v", err)
	}
	got2, _ := repo.GetByID(ctx, build.ID)
	if got2.IsPublic {
		t.Error("expected build.IsPublic == false after second update")
	}

	if err := repo.UpdateVisibility(ctx, uuid.New(), true); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound updating visibility of missing build, got %v", err)
	}
}

func TestBuildRepo_GetPublicByID(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	builds := NewBuildRepo(db)

	discordAvatar := "https://cdn.discordapp.com/avatars/phaethon.png"
	user := &domain.User{
		DiscordID: "666666666666666666",
		Username:  "PhaethonProxy",
		AvatarURL: &discordAvatar,
	}
	if err := users.Create(ctx, user); err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	now := time.Now()
	nick := "ProxyMaster"
	account := &domain.GameAccount{
		UserID:           user.ID,
		UID:              "1504687067",
		Region:           domain.RegionEurope,
		Nickname:         &nick,
		VerifiedAt:       &now,
		IsPublicShowcase: true,
		ShowDiscord:      true,
	}
	if err := accounts.Create(ctx, account); err != nil {
		t.Fatalf("failed to create account: %v", err)
	}

	build := makeDomainBuild(user.ID, account.ID, "Public Ice Preset", 1511)
	build.IsPublic = true
	if err := builds.Create(ctx, build); err != nil {
		t.Fatalf("failed to create public build: %v", err)
	}

	// 1. Success with ShowDiscord = true
	gotBuild, owner, err := builds.GetPublicByID(ctx, build.ID)
	if err != nil {
		t.Fatalf("failed to get public build: %v", err)
	}
	if gotBuild.ID != build.ID || gotBuild.Name != "Public Ice Preset" || !gotBuild.IsPublic {
		t.Errorf("build data mismatch: %+v", gotBuild)
	}
	if owner.UID != "1504687067" || owner.Region != domain.RegionEurope || !owner.IsVerified {
		t.Errorf("owner mismatch: %+v", owner)
	}
	if owner.DiscordUsername == nil || *owner.DiscordUsername != "PhaethonProxy" {
		t.Errorf("expected DiscordUsername %q, got %v", "PhaethonProxy", owner.DiscordUsername)
	}
	if owner.DiscordAvatarURL == nil || *owner.DiscordAvatarURL != discordAvatar {
		t.Errorf("expected DiscordAvatarURL %q, got %v", discordAvatar, owner.DiscordAvatarURL)
	}

	// 2. Account with ShowDiscord = false hides Discord identity
	accountNoDiscord := &domain.GameAccount{
		UserID:      user.ID,
		UID:         "1504687068",
		Region:      domain.RegionEurope,
		ShowDiscord: false,
	}
	if err := accounts.Create(ctx, accountNoDiscord); err != nil {
		t.Fatalf("failed to create second account: %v", err)
	}
	buildNoDiscord := makeDomainBuild(user.ID, accountNoDiscord.ID, "No Discord Preset", 1511)
	buildNoDiscord.IsPublic = true
	if err := builds.Create(ctx, buildNoDiscord); err != nil {
		t.Fatalf("failed to create build: %v", err)
	}

	_, ownerNoDiscord, err := builds.GetPublicByID(ctx, buildNoDiscord.ID)
	if err != nil {
		t.Fatalf("failed to get public build for account without discord: %v", err)
	}
	if ownerNoDiscord.DiscordUsername != nil || ownerNoDiscord.DiscordAvatarURL != nil {
		t.Errorf("expected masked discord fields, got username=%v, avatar=%v", ownerNoDiscord.DiscordUsername, ownerNoDiscord.DiscordAvatarURL)
	}

	// 3. is_public = 0 -> domain.ErrNotFound
	if err := builds.UpdateVisibility(ctx, build.ID, false); err != nil {
		t.Fatalf("failed to make build private: %v", err)
	}
	if _, _, err := builds.GetPublicByID(ctx, build.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for private build, got %v", err)
	}

	// 4. Banned owner -> domain.ErrNotFound
	if err := builds.UpdateVisibility(ctx, build.ID, true); err != nil {
		t.Fatalf("failed to make build public again: %v", err)
	}
	reason := "Abuse"
	if err := users.SetBan(ctx, user.ID, true, &reason); err != nil {
		t.Fatalf("failed to ban user: %v", err)
	}
	if _, _, err := builds.GetPublicByID(ctx, build.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for banned user's public build, got %v", err)
	}

	// 5. Unknown build ID -> domain.ErrNotFound
	if _, _, err := builds.GetPublicByID(ctx, uuid.New()); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for non-existent build, got %v", err)
	}
}

func TestBuildRepo_ListPublicByAccount(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	builds := NewBuildRepo(db)

	user := seedUser(t, ctx, users, "888888888888888888")
	account := seedAccount(t, ctx, accounts, user.ID, "1504687088")

	b1 := makeDomainBuild(user.ID, account.ID, "Public Build 1", 1511)
	b1.IsPublic = true
	b1.CreatedAt = time.Now().UTC().Add(-time.Second)
	if err := builds.Create(ctx, b1); err != nil {
		t.Fatalf("failed to create build 1: %v", err)
	}

	b2 := makeDomainBuild(user.ID, account.ID, "Private Build", 1511)
	b2.IsPublic = false
	if err := builds.Create(ctx, b2); err != nil {
		t.Fatalf("failed to create build 2: %v", err)
	}

	b3 := makeDomainBuild(user.ID, account.ID, "Public Build 2", 1512)
	b3.IsPublic = true
	if err := builds.Create(ctx, b3); err != nil {
		t.Fatalf("failed to create build 3: %v", err)
	}

	publicBuilds, err := builds.ListPublicByAccount(ctx, account.ID)
	if err != nil {
		t.Fatalf("failed to list public builds: %v", err)
	}
	if len(publicBuilds) != 2 {
		t.Fatalf("expected 2 public builds, got %d", len(publicBuilds))
	}
	if publicBuilds[0].ID != b1.ID || publicBuilds[1].ID != b3.ID {
		t.Errorf("expected public builds [%s, %s], got [%s, %s]", b1.ID, b3.ID, publicBuilds[0].ID, publicBuilds[1].ID)
	}
}

func TestBuildRepo_GetByIDs(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	builds := NewBuildRepo(db)

	// 1. Empty slice returns empty map
	emptyMap, err := builds.GetByIDs(ctx, nil)
	if err != nil {
		t.Fatalf("failed with nil IDs: %v", err)
	}
	if len(emptyMap) != 0 {
		t.Errorf("expected empty map for nil IDs, got %v", emptyMap)
	}

	user := seedUser(t, ctx, users, "898989898989898989")
	account := seedAccount(t, ctx, accounts, user.ID, "1504687089")

	b1 := makeDomainBuild(user.ID, account.ID, "Batch Build 1", 1511)
	if err := builds.Create(ctx, b1); err != nil {
		t.Fatalf("failed to create build 1: %v", err)
	}
	b2 := makeDomainBuild(user.ID, account.ID, "Batch Build 2", 1512)
	if err := builds.Create(ctx, b2); err != nil {
		t.Fatalf("failed to create build 2: %v", err)
	}

	// 2. Fetch existing and non-existing IDs
	missingID := uuid.New()
	gotMap, err := builds.GetByIDs(ctx, []uuid.UUID{b1.ID, b2.ID, missingID})
	if err != nil {
		t.Fatalf("failed to get builds by IDs: %v", err)
	}
	if len(gotMap) != 2 {
		t.Fatalf("expected map length 2, got %d", len(gotMap))
	}
	if gotMap[b1.ID] == nil || gotMap[b1.ID].Name != "Batch Build 1" {
		t.Errorf("expected build 1 in map, got %+v", gotMap[b1.ID])
	}
	if gotMap[b2.ID] == nil || gotMap[b2.ID].Name != "Batch Build 2" {
		t.Errorf("expected build 2 in map, got %+v", gotMap[b2.ID])
	}
	if gotMap[missingID] != nil {
		t.Errorf("expected missing ID not in map, got %+v", gotMap[missingID])
	}
}
