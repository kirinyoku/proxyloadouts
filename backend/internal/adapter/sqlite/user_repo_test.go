package sqlite

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestUserRepo_CreateGetRoundtrip(t *testing.T) {
	db := newMigratedTestDB(t)
	repo := NewUserRepo(db)
	ctx := context.Background()

	avatar := "https://cdn.discordapp.com/avatars/1.png"
	user := &domain.User{
		DiscordID: "123456789012345678",
		Username:  "kirin",
		AvatarURL: &avatar,
	}
	if err := repo.Create(ctx, user); err != nil {
		t.Fatalf("failed to create user: %v", err)
	}
	if user.ID == uuid.Nil {
		t.Error("expected generated user ID")
	}
	if user.TokenVersion != 1 {
		t.Errorf("expected default token version 1, got %d", user.TokenVersion)
	}
	if user.CreatedAt.IsZero() {
		t.Error("expected CreatedAt to be set after create")
	}

	got, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("failed to get user by id: %v", err)
	}
	if got.DiscordID != user.DiscordID || got.Username != user.Username {
		t.Errorf("roundtrip mismatch: %+v vs %+v", got, user)
	}
	if got.TokenVersion != 1 {
		t.Errorf("expected roundtrip token version 1, got %d", got.TokenVersion)
	}
	if got.AvatarURL == nil || *got.AvatarURL != avatar {
		t.Errorf("expected avatar %q, got %v", avatar, got.AvatarURL)
	}
	assertTimeEqual(t, user.CreatedAt, got.CreatedAt)

	byDiscord, err := repo.GetByDiscordID(ctx, user.DiscordID)
	if err != nil {
		t.Fatalf("failed to get user by discord id: %v", err)
	}
	if byDiscord.ID != user.ID {
		t.Errorf("expected id %s, got %s", user.ID, byDiscord.ID)
	}
	if byDiscord.TokenVersion != 1 {
		t.Errorf("expected discord roundtrip token version 1, got %d", byDiscord.TokenVersion)
	}
}

func TestUserRepo_IncrementTokenVersion(t *testing.T) {
	db := newMigratedTestDB(t)
	repo := NewUserRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, repo, "555555555555555555")
	if user.TokenVersion != 1 {
		t.Fatalf("expected initial token version 1, got %d", user.TokenVersion)
	}

	if err := repo.IncrementTokenVersion(ctx, user.ID); err != nil {
		t.Fatalf("failed to increment token version: %v", err)
	}

	got, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("failed to get user: %v", err)
	}
	if got.TokenVersion != 2 {
		t.Errorf("expected token version 2, got %d", got.TokenVersion)
	}

	if err := repo.IncrementTokenVersion(ctx, uuid.New()); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound incrementing missing user, got %v", err)
	}
}

func TestUserRepo_NullableAvatar(t *testing.T) {
	db := newMigratedTestDB(t)
	repo := NewUserRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, repo, "111111111111111111")
	got, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("failed to get user: %v", err)
	}
	if got.AvatarURL != nil {
		t.Errorf("expected nil avatar, got %q", *got.AvatarURL)
	}
}

func TestUserRepo_DuplicateDiscordID(t *testing.T) {
	db := newMigratedTestDB(t)
	repo := NewUserRepo(db)
	ctx := context.Background()

	discordID := "222222222222222222"
	seedUser(t, ctx, repo, discordID)

	duplicate := &domain.User{DiscordID: discordID, Username: "other"}
	if err := repo.Create(ctx, duplicate); !errors.Is(err, domain.ErrConflict) {
		t.Errorf("expected ErrConflict for duplicate discord_id, got %v", err)
	}
}

func TestUserRepo_UpdateProfile(t *testing.T) {
	db := newMigratedTestDB(t)
	repo := NewUserRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, repo, "333333333333333333")

	newAvatar := "https://example.com/new.png"
	user.Username = "kirin-renamed"
	user.AvatarURL = &newAvatar
	if err := repo.Update(ctx, user); err != nil {
		t.Fatalf("failed to update user: %v", err)
	}

	got, _ := repo.GetByID(ctx, user.ID)
	if got.Username != "kirin-renamed" || got.AvatarURL == nil || *got.AvatarURL != newAvatar {
		t.Errorf("update not applied: %+v", got)
	}

	// Resetting the avatar to nil must persist as SQL NULL.
	user.AvatarURL = nil
	if err := repo.Update(ctx, user); err != nil {
		t.Fatalf("failed to clear avatar: %v", err)
	}
	got, _ = repo.GetByID(ctx, user.ID)
	if got.AvatarURL != nil {
		t.Errorf("expected cleared avatar, got %q", *got.AvatarURL)
	}
}

func TestUserRepo_NotFoundAndDelete(t *testing.T) {
	db := newMigratedTestDB(t)
	repo := NewUserRepo(db)
	ctx := context.Background()

	if _, err := repo.GetByID(ctx, uuid.New()); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound on missing user, got %v", err)
	}

	user := seedUser(t, ctx, repo, "444444444444444444")
	if err := repo.Delete(ctx, user.ID); err != nil {
		t.Fatalf("failed to delete user: %v", err)
	}
	if _, err := repo.GetByID(ctx, user.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound after delete, got %v", err)
	}
	if err := repo.Delete(ctx, user.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound deleting missing user, got %v", err)
	}
}

func TestUserRepo_CustomLimitsRoundtrip(t *testing.T) {
	db := newMigratedTestDB(t)
	repo := NewUserRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, repo, "999999999999999999")
	if user.CustomMaxBuildsPerAgent != nil || user.CustomMaxTeams != nil {
		t.Fatalf("expected nil custom limits by default, got builds=%v teams=%v", user.CustomMaxBuildsPerAgent, user.CustomMaxTeams)
	}
	if user.EffectiveMaxBuildsPerAgent() != domain.MaxBuildsPerAgent {
		t.Errorf("expected default builds limit %d, got %d", domain.MaxBuildsPerAgent, user.EffectiveMaxBuildsPerAgent())
	}
	if user.EffectiveMaxTeams() != domain.MaxTeamsPerAccount {
		t.Errorf("expected default teams limit %d, got %d", domain.MaxTeamsPerAccount, user.EffectiveMaxTeams())
	}

	// Update limits
	customBuilds := 25
	customTeams := 100
	if err := repo.UpdateLimits(ctx, user.ID, &customBuilds, &customTeams); err != nil {
		t.Fatalf("failed to update limits: %v", err)
	}

	got, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("failed to get user: %v", err)
	}
	if got.CustomMaxBuildsPerAgent == nil || *got.CustomMaxBuildsPerAgent != 25 {
		t.Errorf("expected CustomMaxBuildsPerAgent 25, got %v", got.CustomMaxBuildsPerAgent)
	}
	if got.CustomMaxTeams == nil || *got.CustomMaxTeams != 100 {
		t.Errorf("expected CustomMaxTeams 100, got %v", got.CustomMaxTeams)
	}
	if got.EffectiveMaxBuildsPerAgent() != 25 {
		t.Errorf("expected effective builds limit 25, got %d", got.EffectiveMaxBuildsPerAgent())
	}
	if got.EffectiveMaxTeams() != 100 {
		t.Errorf("expected effective teams limit 100, got %d", got.EffectiveMaxTeams())
	}

	// Reset limits back to NULL (defaults)
	if err := repo.UpdateLimits(ctx, user.ID, nil, nil); err != nil {
		t.Fatalf("failed to reset limits: %v", err)
	}
	resetUser, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("failed to get user after reset: %v", err)
	}
	if resetUser.CustomMaxBuildsPerAgent != nil || resetUser.CustomMaxTeams != nil {
		t.Errorf("expected nil limits after reset, got builds=%v teams=%v", resetUser.CustomMaxBuildsPerAgent, resetUser.CustomMaxTeams)
	}
	if resetUser.EffectiveMaxBuildsPerAgent() != domain.MaxBuildsPerAgent {
		t.Errorf("expected effective builds limit %d, got %d", domain.MaxBuildsPerAgent, resetUser.EffectiveMaxBuildsPerAgent())
	}
	if resetUser.EffectiveMaxTeams() != domain.MaxTeamsPerAccount {
		t.Errorf("expected effective teams limit %d, got %d", domain.MaxTeamsPerAccount, resetUser.EffectiveMaxTeams())
	}
}

func TestUserRepo_BanAndUnban(t *testing.T) {
	db := newMigratedTestDB(t)
	repo := NewUserRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, repo, "888888888888888888")
	if user.IsBanned() {
		t.Fatalf("expected user not to be banned initially")
	}

	reason := "Terms of Service violation"
	if err := repo.SetBan(ctx, user.ID, true, &reason); err != nil {
		t.Fatalf("SetBan(true) failed: %v", err)
	}

	bannedUser, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if !bannedUser.IsBanned() || bannedUser.BannedAt == nil {
		t.Errorf("expected user to be banned, got BannedAt=%v", bannedUser.BannedAt)
	}
	if bannedUser.BanReason == nil || *bannedUser.BanReason != reason {
		t.Errorf("expected ban reason %q, got %v", reason, bannedUser.BanReason)
	}
	if bannedUser.TokenVersion != 2 {
		t.Errorf("expected token_version incremented to 2 upon ban, got %d", bannedUser.TokenVersion)
	}

	// Unban
	if err := repo.SetBan(ctx, user.ID, false, nil); err != nil {
		t.Fatalf("SetBan(false) failed: %v", err)
	}
	unbannedUser, err := repo.GetByID(ctx, user.ID)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if unbannedUser.IsBanned() || unbannedUser.BannedAt != nil || unbannedUser.BanReason != nil {
		t.Errorf("expected user to be unbanned, got BannedAt=%v BanReason=%v", unbannedUser.BannedAt, unbannedUser.BanReason)
	}
}
