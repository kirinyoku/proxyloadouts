package sqlite

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestAdminRepo_GetStats(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	userRepo := NewUserRepo(db)
	accountRepo := NewAccountRepo(db)
	buildRepo := NewBuildRepo(db)
	teamRepo := NewTeamRepo(db)
	adminRepo := NewAdminRepo(db)

	fixedNow := time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)
	adminRepo.now = func() time.Time { return fixedNow }

	customBuilds := 20
	u1 := &domain.User{
		ID:                      uuid.New(),
		DiscordID:               "111",
		Username:                "alice",
		CustomMaxBuildsPerAgent: &customBuilds,
		CreatedAt:               fixedNow.Add(-2 * time.Hour),
	}
	u2 := &domain.User{
		ID:        uuid.New(),
		DiscordID: "222",
		Username:  "bob",
		CreatedAt: fixedNow.Add(-5 * 24 * time.Hour),
	}
	for _, u := range []*domain.User{u1, u2} {
		if err := userRepo.Create(ctx, u); err != nil {
			t.Fatalf("failed to create user: %v", err)
		}
	}

	acc1 := &domain.GameAccount{
		ID:        uuid.New(),
		UserID:    u1.ID,
		UID:       "1500000001",
		Region:    "Europe",
		CreatedAt: fixedNow.Add(-1 * time.Hour),
	}
	acc2 := &domain.GameAccount{
		ID:        uuid.New(),
		UserID:    u2.ID,
		UID:       "1300000002",
		Region:    "Asia",
		CreatedAt: fixedNow.Add(-10 * 24 * time.Hour),
	}
	for _, a := range []*domain.GameAccount{acc1, acc2} {
		if err := accountRepo.Create(ctx, a); err != nil {
			t.Fatalf("failed to create account: %v", err)
		}
	}

	b1 := &domain.AgentBuild{
		ID:            uuid.New(),
		UserID:        u1.ID,
		GameAccountID: acc1.ID,
		AgentID:       1511,
		AgentName:     "Miyabi",
		Name:          "Frost Anomaly",
		RawData:       json.RawMessage(`{"id":1511}`),
		CreatedAt:     fixedNow.Add(-30 * time.Minute),
		UpdatedAt:     fixedNow.Add(-30 * time.Minute),
	}
	b2 := &domain.AgentBuild{
		ID:            uuid.New(),
		UserID:        u1.ID,
		GameAccountID: acc1.ID,
		AgentID:       1411,
		AgentName:     "Ellen",
		Name:          "Shark Crit",
		RawData:       json.RawMessage(`{"id":1411}`),
		CreatedAt:     fixedNow.Add(-2 * 24 * time.Hour),
		UpdatedAt:     fixedNow.Add(-2 * 24 * time.Hour),
	}
	for _, b := range []*domain.AgentBuild{b1, b2} {
		if err := buildRepo.Create(ctx, b); err != nil {
			t.Fatalf("failed to create build: %v", err)
		}
	}

	team := &domain.Team{
		ID:            uuid.New(),
		UserID:        u1.ID,
		GameAccountID: acc1.ID,
		Name:          "Ice Squad",
		CreatedAt:     fixedNow.Add(-15 * time.Minute),
		UpdatedAt:     fixedNow.Add(-15 * time.Minute),
	}
	if err := teamRepo.Create(ctx, team, []domain.TeamMember{
		{ID: uuid.New(), TeamID: team.ID, SlotNumber: 1, BuildID: b1.ID},
	}); err != nil {
		t.Fatalf("failed to create team: %v", err)
	}

	stats, err := adminRepo.GetStats(ctx, 7)
	if err != nil {
		t.Fatalf("GetStats failed: %v", err)
	}

	if stats.Counts.Users.Total != 2 || stats.Counts.Users.Last24h != 1 || stats.Counts.Users.Last7d != 2 {
		t.Errorf("unexpected user counts: %+v", stats.Counts.Users)
	}
	if stats.Counts.Accounts.Total != 2 || stats.Counts.Accounts.Last24h != 1 || stats.Counts.Accounts.Last30d != 2 {
		t.Errorf("unexpected account counts: %+v", stats.Counts.Accounts)
	}
	if stats.Counts.Builds.Total != 2 || stats.Counts.Builds.Last24h != 1 || stats.Counts.Builds.Last7d != 2 {
		t.Errorf("unexpected build counts: %+v", stats.Counts.Builds)
	}
	if stats.Counts.Teams.Total != 1 || stats.Counts.Teams.Last24h != 1 {
		t.Errorf("unexpected team counts: %+v", stats.Counts.Teams)
	}
	if stats.Counts.CustomLimitsUsers != 1 {
		t.Errorf("expected 1 custom limits user, got %d", stats.Counts.CustomLimitsUsers)
	}
	if len(stats.TopAgents) != 2 || stats.TopAgents[0].AgentID != 1511 || stats.TopAgents[0].TeamsCount != 1 {
		t.Errorf("unexpected top agents: %+v", stats.TopAgents)
	}
	if len(stats.DailyActivity) != 7 {
		t.Fatalf("expected 7 daily points, got %d", len(stats.DailyActivity))
	}
	lastPoint := stats.DailyActivity[len(stats.DailyActivity)-1]
	if lastPoint.Date != "2026-10-24" || lastPoint.Users != 1 || lastPoint.Builds != 1 || lastPoint.Teams != 1 {
		t.Errorf("unexpected today point: %+v", lastPoint)
	}
}

func TestAdminRepo_ListAndDetailUsers(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	userRepo := NewUserRepo(db)
	accountRepo := NewAccountRepo(db)
	buildRepo := NewBuildRepo(db)
	adminRepo := NewAdminRepo(db)

	customBuilds := 25
	customTeams := 100
	customAccounts := 5
	u1 := &domain.User{
		ID:                      uuid.New(),
		DiscordID:               "100001",
		Username:                "ProxyCreator",
		CustomMaxBuildsPerAgent: &customBuilds,
		CustomMaxTeams:          &customTeams,
		CustomMaxAccounts:       &customAccounts,
	}
	u2 := &domain.User{
		ID:        uuid.New(),
		DiscordID: "100002",
		Username:  "RegularPlayer",
	}
	for _, u := range []*domain.User{u1, u2} {
		if err := userRepo.Create(ctx, u); err != nil {
			t.Fatalf("Create user: %v", err)
		}
	}

	reason := "spam"
	if err := userRepo.SetBan(ctx, u2.ID, true, &reason); err != nil {
		t.Fatalf("SetBan: %v", err)
	}

	acc1 := &domain.GameAccount{
		ID:     uuid.New(),
		UserID: u1.ID,
		UID:    "1504687050",
		Region: "Europe",
	}
	if err := accountRepo.Create(ctx, acc1); err != nil {
		t.Fatalf("Create account: %v", err)
	}
	b1 := &domain.AgentBuild{
		ID:            uuid.New(),
		UserID:        u1.ID,
		GameAccountID: acc1.ID,
		AgentID:       1511,
		AgentName:     "Miyabi",
		Name:          "Miyabi S1",
		RawData:       json.RawMessage(`{"id":1511}`),
	}
	if err := buildRepo.Create(ctx, b1); err != nil {
		t.Fatalf("Create build: %v", err)
	}

	// Search by UID
	byUID, err := adminRepo.ListUsers(ctx, AdminUserFilter{Query: "1504687050"})
	if err != nil {
		t.Fatalf("ListUsers by UID: %v", err)
	}
	if byUID.Total != 1 || len(byUID.Items) != 1 || byUID.Items[0].ID != u1.ID.String() {
		t.Errorf("expected u1 when searching by UID, got %+v", byUID)
	}

	// Filter custom_limits
	customOnly, err := adminRepo.ListUsers(ctx, AdminUserFilter{Filter: "custom_limits"})
	if err != nil {
		t.Fatalf("ListUsers custom_limits: %v", err)
	}
	if customOnly.Total != 1 || customOnly.Items[0].EffectiveMaxBuildsPerAgent != 25 || customOnly.Items[0].EffectiveMaxTeams != 100 || customOnly.Items[0].EffectiveMaxAccounts != 5 {
		t.Errorf("unexpected custom_limits result: %+v", customOnly)
	}

	// Filter banned
	bannedOnly, err := adminRepo.ListUsers(ctx, AdminUserFilter{Filter: "banned"})
	if err != nil {
		t.Fatalf("ListUsers banned: %v", err)
	}
	if bannedOnly.Total != 1 || bannedOnly.Items[0].ID != u2.ID.String() || bannedOnly.Items[0].BannedAt == nil {
		t.Errorf("unexpected banned result: %+v", bannedOnly)
	}

	// GetUserDetail
	detail, err := adminRepo.GetUserDetail(ctx, u1.ID)
	if err != nil {
		t.Fatalf("GetUserDetail: %v", err)
	}
	if len(detail.Accounts) != 1 || detail.Accounts[0].UID != "1504687050" || len(detail.Accounts[0].Agents) != 1 {
		t.Errorf("unexpected user detail accounts: %+v", detail.Accounts)
	}
}
