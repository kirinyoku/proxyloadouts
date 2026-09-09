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
