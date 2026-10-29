package sqlite

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// seedTeamBuilds creates a user, an account and three builds; returns them.
func seedTeamFixtures(t *testing.T, ctx context.Context) (*domain.User, *domain.GameAccount, []*domain.AgentBuild, *SQLiteTeamRepo) {
	t.Helper()

	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	builds := NewBuildRepo(db)
	teams := NewTeamRepo(db)

	user := seedUser(t, ctx, users, "707070707070707070")
	account := seedAccount(t, ctx, accounts, user.ID, "1504687070")

	var created []*domain.AgentBuild
	for i, agentID := range []int{1511, 1411, 1181} {
		build := makeDomainBuild(user.ID, account.ID, string(rune('A'+i)), agentID)
		if err := builds.Create(ctx, build); err != nil {
			t.Fatalf("failed to create fixture build: %v", err)
		}
		created = append(created, build)
	}
	return user, account, created, teams
}

func TestTeamRepo_CreateTransactionalWithMembers(t *testing.T) {
	ctx := context.Background()
	user, account, buildsList, repo := seedTeamFixtures(t, ctx)

	description := "Shiyu 7"
	team := &domain.Team{
		UserID:        user.ID,
		GameAccountID: account.ID,
		Name:          "Ice Mono",
		Description:   &description,
	}
	members := []domain.TeamMember{
		{SlotNumber: 1, BuildID: buildsList[0].ID},
		{SlotNumber: 2, BuildID: buildsList[1].ID},
		{SlotNumber: 3, BuildID: buildsList[2].ID},
	}

	if err := repo.Create(ctx, team, members); err != nil {
		t.Fatalf("failed to create team: %v", err)
	}
	if team.ID == uuid.Nil {
		t.Error("expected generated team ID")
	}
	for _, m := range members {
		if m.TeamID != team.ID || m.ID == uuid.Nil {
			t.Fatalf("expected member fields to be populated, got %+v", m)
		}
	}

	got, err := repo.GetByID(ctx, team.ID)
	if err != nil {
		t.Fatalf("failed to get team: %v", err)
	}
	if got.Name != "Ice Mono" || got.Description == nil || *got.Description != description {
		t.Errorf("team roundtrip mismatch: %+v", got)
	}
	assertTimeEqual(t, team.CreatedAt, got.CreatedAt)

	roster, err := repo.GetMembers(ctx, team.ID)
	if err != nil {
		t.Fatalf("failed to get members: %v", err)
	}
	if len(roster) != 3 {
		t.Fatalf("expected 3 members, got %d", len(roster))
	}
	for i, m := range roster {
		if m.SlotNumber != i+1 {
			t.Errorf("expected slot %d at position %d, got %d", i+1, i, m.SlotNumber)
		}
		if m.BuildID != buildsList[i].ID {
			t.Errorf("slot %d: expected build %s, got %s", m.SlotNumber, buildsList[i].ID, m.BuildID)
		}
	}
}

func TestTeamRepo_DuplicateSlotConflict(t *testing.T) {
	ctx := context.Background()
	user, account, buildsList, repo := seedTeamFixtures(t, ctx)

	team := &domain.Team{UserID: user.ID, GameAccountID: account.ID, Name: "Broken"}
	members := []domain.TeamMember{
		{SlotNumber: 1, BuildID: buildsList[0].ID},
		{SlotNumber: 1, BuildID: buildsList[1].ID},
	}

	err := repo.Create(ctx, team, members)
	if !errors.Is(err, domain.ErrConflict) {
		t.Errorf("expected ErrConflict for duplicate slot, got %v", err)
	}
	// Atomicity: the team must not be left half-inserted.
	if _, getErr := repo.GetByID(ctx, team.ID); !errors.Is(getErr, domain.ErrNotFound) {
		t.Errorf("expected failed creation to leave no team row, got %v", getErr)
	}
}

func TestTeamRepo_SlotOutOfRangeRejected(t *testing.T) {
	ctx := context.Background()
	user, account, buildsList, repo := seedTeamFixtures(t, ctx)

	team := &domain.Team{UserID: user.ID, GameAccountID: account.ID, Name: "Overflow"}
	members := []domain.TeamMember{{SlotNumber: 4, BuildID: buildsList[0].ID}}

	if err := repo.Create(ctx, team, members); !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput for slot 4, got %v", err)
	}
}

func TestTeamRepo_MemberMissingBuildConflict(t *testing.T) {
	ctx := context.Background()
	user, account, _, repo := seedTeamFixtures(t, ctx)

	team := &domain.Team{UserID: user.ID, GameAccountID: account.ID, Name: "Ghost Slot"}
	members := []domain.TeamMember{{SlotNumber: 1, BuildID: uuid.New()}}

	if err := repo.Create(ctx, team, members); !errors.Is(err, domain.ErrConflict) {
		t.Errorf("expected ErrConflict for missing build reference, got %v", err)
	}
}

func TestTeamRepo_ListByAccountAndDeleteCascades(t *testing.T) {
	ctx := context.Background()
	db := newMigratedTestDB(t)

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	builds := NewBuildRepo(db)
	repo := NewTeamRepo(db)

	user := seedUser(t, ctx, users, "808080808080808080")
	accountA := seedAccount(t, ctx, accounts, user.ID, "1504687080")
	accountB := seedAccount(t, ctx, accounts, user.ID, "1504687081")

	build := makeDomainBuild(user.ID, accountA.ID, "Main", 1511)
	if err := builds.Create(ctx, build); err != nil {
		t.Fatalf("failed to create build: %v", err)
	}

	teamA := &domain.Team{UserID: user.ID, GameAccountID: accountA.ID, Name: "Team A"}
	teamB := &domain.Team{UserID: user.ID, GameAccountID: accountB.ID, Name: "Team B"}
	if err := repo.Create(ctx, teamA, []domain.TeamMember{{SlotNumber: 1, BuildID: build.ID}}); err != nil {
		t.Fatalf("failed to create team A: %v", err)
	}
	if err := repo.Create(ctx, teamB, nil); err != nil {
		t.Fatalf("failed to create empty team B: %v", err)
	}

	listA, err := repo.ListByAccount(ctx, accountA.ID)
	if err != nil {
		t.Fatalf("failed to list teams: %v", err)
	}
	if len(listA) != 1 || listA[0].Name != "Team A" {
		t.Errorf("expected only Team A for account A, got %+v", listA)
	}

	if err := repo.Delete(ctx, teamA.ID); err != nil {
		t.Fatalf("failed to delete team: %v", err)
	}

	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM team_members WHERE team_id = ?`, teamA.ID.String()).Scan(&count); err != nil {
		t.Fatalf("failed to count orphaned members: %v", err)
	}
	if count != 0 {
		t.Errorf("expected members to cascade with team, got %d remaining", count)
	}

	if err := repo.Delete(ctx, teamA.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound deleting missing team, got %v", err)
	}

	roster, _ := repo.GetMembers(ctx, teamA.ID)
	if roster != nil {
		t.Errorf("expected no members after delete, got %v", roster)
	}
}

func TestTeamRepo_GetByIDNotFound(t *testing.T) {
	ctx := context.Background()
	_, _, _, repo := seedTeamFixtures(t, ctx)

	if _, err := repo.GetByID(ctx, uuid.New()); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for missing team, got %v", err)
	}
}

func TestTeamRepo_GetMembersByTeams(t *testing.T) {
	ctx := context.Background()
	user, account, buildsList, repo := seedTeamFixtures(t, ctx)

	// Test with empty slice
	emptyResult, err := repo.GetMembersByTeams(ctx, nil)
	if err != nil {
		t.Fatalf("expected nil error for empty team IDs, got %v", err)
	}
	if len(emptyResult) != 0 {
		t.Fatalf("expected empty map, got %v", emptyResult)
	}

	// Create 2 teams
	team1 := &domain.Team{
		UserID:        user.ID,
		GameAccountID: account.ID,
		Name:          "Team 1",
	}
	members1 := []domain.TeamMember{
		{SlotNumber: 1, BuildID: buildsList[0].ID},
		{SlotNumber: 2, BuildID: buildsList[1].ID},
	}
	if err := repo.Create(ctx, team1, members1); err != nil {
		t.Fatalf("failed to create team 1: %v", err)
	}

	team2 := &domain.Team{
		UserID:        user.ID,
		GameAccountID: account.ID,
		Name:          "Team 2",
	}
	members2 := []domain.TeamMember{
		{SlotNumber: 1, BuildID: buildsList[2].ID},
	}
	if err := repo.Create(ctx, team2, members2); err != nil {
		t.Fatalf("failed to create team 2: %v", err)
	}

	result, err := repo.GetMembersByTeams(ctx, []uuid.UUID{team1.ID, team2.ID})
	if err != nil {
		t.Fatalf("GetMembersByTeams failed: %v", err)
	}

	if len(result) != 2 {
		t.Fatalf("expected 2 teams in result, got %d", len(result))
	}
	if len(result[team1.ID]) != 2 {
		t.Errorf("expected 2 members for team 1, got %d", len(result[team1.ID]))
	}
	if len(result[team2.ID]) != 1 {
		t.Errorf("expected 1 member for team 2, got %d", len(result[team2.ID]))
	}
	if result[team1.ID][0].BuildID != buildsList[0].ID || result[team1.ID][1].BuildID != buildsList[1].ID {
		t.Errorf("unexpected members for team 1: %+v", result[team1.ID])
	}
	if result[team2.ID][0].BuildID != buildsList[2].ID {
		t.Errorf("unexpected members for team 2: %+v", result[team2.ID])
	}
}

func TestTeamRepo_ConcurrentCreateAndUpdateNoDeadlock(t *testing.T) {
	ctx := context.Background()
	user, account, buildsList, repo := seedTeamFixtures(t, ctx)

	const concurrency = 10
	var wg sync.WaitGroup
	errs := make(chan error, concurrency*2)

	// Concurrently create teams
	for i := range concurrency {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			desc := fmt.Sprintf("Concurrent team %d", idx)
			team := &domain.Team{
				UserID:        user.ID,
				GameAccountID: account.ID,
				Name:          fmt.Sprintf("Team %d", idx),
				Description:   &desc,
			}
			members := []domain.TeamMember{
				{SlotNumber: 1, BuildID: buildsList[0].ID},
				{SlotNumber: 2, BuildID: buildsList[1].ID},
			}
			if err := repo.Create(ctx, team, members); err != nil {
				errs <- fmt.Errorf("create %d failed: %w", idx, err)
				return
			}

			// Immediately update the team in the same concurrency pool
			team.Name = fmt.Sprintf("Updated Team %d", idx)
			members = append(members, domain.TeamMember{
				SlotNumber: 3,
				BuildID:    buildsList[2].ID,
			})
			if err := repo.Update(ctx, team, members); err != nil {
				errs <- fmt.Errorf("update %d failed: %w", idx, err)
			}
		}(i)
	}

	wg.Wait()
	close(errs)

	for err := range errs {
		t.Errorf("concurrent operation error: %v", err)
	}

	count, err := repo.CountByAccount(ctx, account.ID)
	if err != nil {
		t.Fatalf("failed to count teams: %v", err)
	}
	if count != concurrency {
		t.Errorf("expected %d teams, got %d", concurrency, count)
	}
}

func TestTeamRepo_CreateUpdatePreservesIsPublic(t *testing.T) {
	ctx := context.Background()
	user, account, buildsList, repo := seedTeamFixtures(t, ctx)

	team := &domain.Team{
		UserID:        user.ID,
		GameAccountID: account.ID,
		Name:          "Public Squad",
		IsPublic:      true,
	}
	members := []domain.TeamMember{
		{SlotNumber: 1, BuildID: buildsList[0].ID},
	}

	if err := repo.Create(ctx, team, members); err != nil {
		t.Fatalf("failed to create public team: %v", err)
	}

	got, err := repo.GetByID(ctx, team.ID)
	if err != nil {
		t.Fatalf("failed to get team: %v", err)
	}
	if !got.IsPublic {
		t.Error("expected team.IsPublic == true after create")
	}

	got.IsPublic = false
	if err := repo.Update(ctx, got, members); err != nil {
		t.Fatalf("failed to update team to private: %v", err)
	}

	got2, err := repo.GetByID(ctx, team.ID)
	if err != nil {
		t.Fatalf("failed to get team after update: %v", err)
	}
	if got2.IsPublic {
		t.Error("expected team.IsPublic == false after update")
	}
}

func TestTeamRepo_GetPublicByID(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	builds := NewBuildRepo(db)
	teams := NewTeamRepo(db)

	discordAvatar := "https://cdn.discordapp.com/avatars/teamowner.png"
	user := &domain.User{
		DiscordID: "777777777777777777",
		Username:  "SquadCaptain",
		AvatarURL: &discordAvatar,
	}
	if err := users.Create(ctx, user); err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	now := time.Now()
	nick := "Captain"
	account := &domain.GameAccount{
		UserID:         user.ID,
		UID:            "1504687077",
		Region:         domain.RegionEurope,
		Nickname:       &nick,
		VerifiedAt:     &now,
		IsPublicRoster: true,
		IsPublicTeams:  true,
		ShowDiscord:    true,
	}
	if err := accounts.Create(ctx, account); err != nil {
		t.Fatalf("failed to create account: %v", err)
	}

	build := makeDomainBuild(user.ID, account.ID, "Member Build", 1511)
	if err := builds.Create(ctx, build); err != nil {
		t.Fatalf("failed to create build: %v", err)
	}

	desc := "Public Anomaly Comp"
	team := &domain.Team{
		UserID:        user.ID,
		GameAccountID: account.ID,
		Name:          "Anomaly Comp",
		Description:   &desc,
		IsPublic:      true,
	}
	members := []domain.TeamMember{
		{SlotNumber: 1, BuildID: build.ID},
	}
	if err := teams.Create(ctx, team, members); err != nil {
		t.Fatalf("failed to create team: %v", err)
	}

	// 1. Success with ShowDiscord = true
	gotTeam, owner, err := teams.GetPublicByID(ctx, team.ID)
	if err != nil {
		t.Fatalf("failed to get public team: %v", err)
	}
	if gotTeam.ID != team.ID || gotTeam.Name != "Anomaly Comp" || !gotTeam.IsPublic {
		t.Errorf("team mismatch: %+v", gotTeam)
	}
	if owner.UID != "1504687077" || owner.Region != domain.RegionEurope {
		t.Errorf("owner mismatch: %+v", owner)
	}
	if owner.DiscordUsername == nil || *owner.DiscordUsername != "SquadCaptain" {
		t.Errorf("expected DiscordUsername %q, got %v", "SquadCaptain", owner.DiscordUsername)
	}
	if owner.DiscordAvatarURL == nil || *owner.DiscordAvatarURL != discordAvatar {
		t.Errorf("expected DiscordAvatarURL %q, got %v", discordAvatar, owner.DiscordAvatarURL)
	}

	// 2. Account with ShowDiscord = false hides Discord identity
	accountNoDiscord := &domain.GameAccount{
		UserID:      user.ID,
		UID:         "1504687078",
		Region:      domain.RegionEurope,
		ShowDiscord: false,
	}
	if err := accounts.Create(ctx, accountNoDiscord); err != nil {
		t.Fatalf("failed to create second account: %v", err)
	}
	buildNoDiscord := makeDomainBuild(user.ID, accountNoDiscord.ID, "Member Build 2", 1511)
	if err := builds.Create(ctx, buildNoDiscord); err != nil {
		t.Fatalf("failed to create second build: %v", err)
	}
	teamNoDiscord := &domain.Team{
		UserID:        user.ID,
		GameAccountID: accountNoDiscord.ID,
		Name:          "Anonymous Squad",
		IsPublic:      true,
	}
	if err := teams.Create(ctx, teamNoDiscord, []domain.TeamMember{{SlotNumber: 1, BuildID: buildNoDiscord.ID}}); err != nil {
		t.Fatalf("failed to create team without discord: %v", err)
	}

	_, ownerNoDiscord, err := teams.GetPublicByID(ctx, teamNoDiscord.ID)
	if err != nil {
		t.Fatalf("failed to get public team for account without discord: %v", err)
	}
	if ownerNoDiscord.DiscordUsername != nil || ownerNoDiscord.DiscordAvatarURL != nil {
		t.Errorf("expected masked discord fields, got username=%v, avatar=%v", ownerNoDiscord.DiscordUsername, ownerNoDiscord.DiscordAvatarURL)
	}

	// 3. is_public = 0 -> domain.ErrNotFound
	team.IsPublic = false
	if err := teams.Update(ctx, team, members); err != nil {
		t.Fatalf("failed to make team private: %v", err)
	}
	if _, _, err := teams.GetPublicByID(ctx, team.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for private team, got %v", err)
	}

	// 4. Banned owner -> domain.ErrNotFound
	team.IsPublic = true
	if err := teams.Update(ctx, team, members); err != nil {
		t.Fatalf("failed to make team public again: %v", err)
	}
	reason := "Spam"
	if err := users.SetBan(ctx, user.ID, true, &reason); err != nil {
		t.Fatalf("failed to ban user: %v", err)
	}
	if _, _, err := teams.GetPublicByID(ctx, team.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for banned user's public team, got %v", err)
	}

	// 5. Unknown team ID -> domain.ErrNotFound
	if _, _, err := teams.GetPublicByID(ctx, uuid.New()); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for non-existent team, got %v", err)
	}
}

func TestTeamRepo_ListPublicByAccount(t *testing.T) {
	ctx := context.Background()
	user, account, buildsList, repo := seedTeamFixtures(t, ctx)

	t1 := &domain.Team{
		UserID:        user.ID,
		GameAccountID: account.ID,
		Name:          "Public Team 1",
		IsPublic:      true,
		CreatedAt:     time.Now().UTC().Add(-time.Second),
	}
	if err := repo.Create(ctx, t1, []domain.TeamMember{{SlotNumber: 1, BuildID: buildsList[0].ID}}); err != nil {
		t.Fatalf("failed to create team 1: %v", err)
	}

	t2 := &domain.Team{
		UserID:        user.ID,
		GameAccountID: account.ID,
		Name:          "Private Team",
		IsPublic:      false,
	}
	if err := repo.Create(ctx, t2, []domain.TeamMember{{SlotNumber: 1, BuildID: buildsList[0].ID}}); err != nil {
		t.Fatalf("failed to create team 2: %v", err)
	}

	t3 := &domain.Team{
		UserID:        user.ID,
		GameAccountID: account.ID,
		Name:          "Public Team 2",
		IsPublic:      true,
	}
	if err := repo.Create(ctx, t3, []domain.TeamMember{{SlotNumber: 1, BuildID: buildsList[0].ID}}); err != nil {
		t.Fatalf("failed to create team 3: %v", err)
	}

	publicTeams, err := repo.ListPublicByAccount(ctx, account.ID)
	if err != nil {
		t.Fatalf("failed to list public teams: %v", err)
	}
	if len(publicTeams) != 2 {
		t.Fatalf("expected 2 public teams, got %d", len(publicTeams))
	}
	if publicTeams[0].ID != t1.ID || publicTeams[1].ID != t3.ID {
		t.Errorf("expected public teams [%s, %s], got [%s, %s]", t1.ID, t3.ID, publicTeams[0].ID, publicTeams[1].ID)
	}
}

func TestTeamRepo_UpdateVisibility(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	builds := NewBuildRepo(db)
	repo := NewTeamRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, users, "787878787878787878")
	account := seedAccount(t, ctx, accounts, user.ID, "1504687079")
	b := makeDomainBuild(user.ID, account.ID, "Preset 1", 1511)
	if err := builds.Create(ctx, b); err != nil {
		t.Fatalf("failed to create build: %v", err)
	}

	team := &domain.Team{
		UserID:        user.ID,
		GameAccountID: account.ID,
		Name:          "Initial Private Team",
		IsPublic:      false,
	}
	if err := repo.Create(ctx, team, []domain.TeamMember{{SlotNumber: 1, BuildID: b.ID}}); err != nil {
		t.Fatalf("failed to create team: %v", err)
	}

	createdTeam, err := repo.GetByID(ctx, team.ID)
	if err != nil {
		t.Fatalf("failed to get created team: %v", err)
	}

	time.Sleep(10 * time.Millisecond)

	// Update visibility to true
	if err := repo.UpdateVisibility(ctx, team.ID, true); err != nil {
		t.Fatalf("failed to update visibility to true: %v", err)
	}

	got, err := repo.GetByID(ctx, team.ID)
	if err != nil {
		t.Fatalf("failed to get team after update: %v", err)
	}
	if !got.IsPublic {
		t.Errorf("expected team.IsPublic == true after update")
	}
	assertTimeEqual(t, createdTeam.UpdatedAt, got.UpdatedAt)

	// Update visibility to false
	if err := repo.UpdateVisibility(ctx, team.ID, false); err != nil {
		t.Fatalf("failed to update visibility to false: %v", err)
	}
	got2, _ := repo.GetByID(ctx, team.ID)
	if got2.IsPublic {
		t.Errorf("expected team.IsPublic == false after second update")
	}

	// Missing team
	if err := repo.UpdateVisibility(ctx, uuid.New(), true); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for non-existent team, got %v", err)
	}
}
