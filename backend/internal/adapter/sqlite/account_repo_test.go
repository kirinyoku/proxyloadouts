package sqlite

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestAccountRepo_CreateGetRoundtrip(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	repo := NewAccountRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, users, "101010101010101010")
	account := &domain.GameAccount{
		UserID: user.ID,
		UID:    "1504687050",
		Region: domain.RegionAsia,
	}
	if err := repo.Create(ctx, account); err != nil {
		t.Fatalf("failed to create account: %v", err)
	}
	if account.ID == uuid.Nil {
		t.Error("expected generated account ID")
	}

	got, err := repo.GetByID(ctx, account.ID)
	if err != nil {
		t.Fatalf("failed to get account: %v", err)
	}
	if got.UID != account.UID || got.Region != domain.RegionAsia || got.UserID != user.ID {
		t.Errorf("roundtrip mismatch: %+v", got)
	}
	assertTimeEqual(t, account.CreatedAt, got.CreatedAt)
}

func TestAccountRepo_DefaultRegionApplied(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	repo := NewAccountRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, users, "111111101010101010")
	account := &domain.GameAccount{UserID: user.ID, UID: "1504687051"}
	if err := repo.Create(ctx, account); err != nil {
		t.Fatalf("failed to create account: %v", err)
	}

	got, _ := repo.GetByID(ctx, account.ID)
	if got.Region != domain.DefaultRegion {
		t.Errorf("expected default region %q, got %q", domain.DefaultRegion, got.Region)
	}
}

func TestAccountRepo_DuplicateUIDPerUser(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	repo := NewAccountRepo(db)
	ctx := context.Background()

	userA := seedUser(t, ctx, users, "202020202020202020")
	userB := seedUser(t, ctx, users, "202020202020202021")

	uid := "1504687052"
	seedAccount(t, ctx, repo, userA.ID, uid)

	// Same user + same UID → conflict.
	if err := repo.Create(ctx, &domain.GameAccount{UserID: userA.ID, UID: uid}); !errors.Is(err, domain.ErrConflict) {
		t.Errorf("expected ErrConflict for duplicate (user, uid), got %v", err)
	}
	// Same UID but different user → allowed.
	if err := repo.Create(ctx, &domain.GameAccount{UserID: userB.ID, UID: uid}); err != nil {
		t.Errorf("expected same uid for different user to succeed, got %v", err)
	}
}

func TestAccountRepo_GetByUserAndUID(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	repo := NewAccountRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, users, "303030303030303030")
	account := seedAccount(t, ctx, repo, user.ID, "1504687053")

	got, err := repo.GetByUserAndUID(ctx, user.ID, "1504687053")
	if err != nil {
		t.Fatalf("failed to get by user and uid: %v", err)
	}
	if got.ID != account.ID {
		t.Errorf("expected account %s, got %s", account.ID, got.ID)
	}

	if _, err := repo.GetByUserAndUID(ctx, user.ID, "9999999999"); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for unknown uid, got %v", err)
	}
}

func TestAccountRepo_ListByUser(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	repo := NewAccountRepo(db)
	ctx := context.Background()

	userA := seedUser(t, ctx, users, "404040404040404040")
	userB := seedUser(t, ctx, users, "404040404040404041")

	seedAccount(t, ctx, repo, userA.ID, "1504687001")
	seedAccount(t, ctx, repo, userA.ID, "1504687002")
	seedAccount(t, ctx, repo, userB.ID, "1504687003")

	list, err := repo.ListByUser(ctx, userA.ID)
	if err != nil {
		t.Fatalf("failed to list accounts: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 accounts for user A, got %d", len(list))
	}
	if list[0].UID != "1504687001" || list[1].UID != "1504687002" {
		t.Errorf("expected stable ordering, got %s, %s", list[0].UID, list[1].UID)
	}
}

func TestAccountRepo_DeleteCascadesBuilds(t *testing.T) {
	db := newMigratedTestDB(t)
	ctx := context.Background()

	users := NewUserRepo(db)
	accounts := NewAccountRepo(db)
	builds := NewBuildRepo(db)

	user := seedUser(t, ctx, users, "505050505050505050")
	account := seedAccount(t, ctx, accounts, user.ID, "1504687054")
	if err := builds.Create(ctx, makeDomainBuild(user.ID, account.ID, "Main", 1511)); err != nil {
		t.Fatalf("failed to seed build: %v", err)
	}

	if err := accounts.Delete(ctx, account.ID); err != nil {
		t.Fatalf("failed to delete account: %v", err)
	}

	list, err := builds.ListByAccount(ctx, account.ID)
	if err != nil {
		t.Fatalf("failed to list builds: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected builds to cascade with account, got %d", len(list))
	}
	if err := accounts.Delete(ctx, account.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound deleting missing account, got %v", err)
	}
}

func TestAccountRepo_UpdateProfileMetadata(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	repo := NewAccountRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, users, "555555555555555555")
	account := seedAccount(t, ctx, repo, user.ID, "1504687055")

	nick := "Belle"
	avatar := "https://example.com/belle.png"
	if err := repo.UpdateProfileMetadata(ctx, account.ID, &nick, &avatar); err != nil {
		t.Fatalf("failed to update profile metadata: %v", err)
	}

	got, err := repo.GetByID(ctx, account.ID)
	if err != nil {
		t.Fatalf("failed to get account: %v", err)
	}
	if got.Nickname == nil || *got.Nickname != nick {
		t.Errorf("expected nickname %q, got %v", nick, got.Nickname)
	}
	if got.AvatarURL == nil || *got.AvatarURL != avatar {
		t.Errorf("expected avatar_url %q, got %v", avatar, got.AvatarURL)
	}

	missingID := uuid.New()
	if err := repo.UpdateProfileMetadata(ctx, missingID, &nick, &avatar); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound updating missing account, got %v", err)
	}
}

func TestAccountRepo_GetPublicOwnerInfoByAccountID(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	repo := NewAccountRepo(db)
	ctx := context.Background()

	discordAvatar := "https://cdn.discordapp.com/avatars/user.png"
	user := &domain.User{
		DiscordID: "565656565656565656",
		Username:  "Phaethon",
		AvatarURL: &discordAvatar,
	}
	if err := users.Create(ctx, user); err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}

	now := time.Now()
	nick := "Wise"
	avatar := "https://example.com/wise.png"
	account := &domain.GameAccount{
		UserID:           user.ID,
		UID:              "1504687056",
		Region:           domain.RegionEurope,
		Nickname:         &nick,
		AvatarURL:        &avatar,
		VerifiedAt:       &now,
		IsPublicShowcase: true,
		ShowDiscord:      true,
	}
	if err := repo.Create(ctx, account); err != nil {
		t.Fatalf("failed to create account: %v", err)
	}

	// 1. Full public owner info when ShowDiscord == true
	owner, err := repo.GetPublicOwnerInfoByAccountID(ctx, account.ID)
	if err != nil {
		t.Fatalf("failed to get public owner info: %v", err)
	}
	if owner.UID != "1504687056" || owner.Region != domain.RegionEurope {
		t.Errorf("owner UID/region mismatch: %+v", owner)
	}
	if owner.Nickname == nil || *owner.Nickname != nick {
		t.Errorf("expected nickname %q, got %v", nick, owner.Nickname)
	}
	if owner.AvatarURL == nil || *owner.AvatarURL != avatar {
		t.Errorf("expected avatar URL %q, got %v", avatar, owner.AvatarURL)
	}
	if !owner.IsVerified {
		t.Error("expected owner.IsVerified == true")
	}
	if owner.DiscordUsername == nil || *owner.DiscordUsername != "Phaethon" {
		t.Errorf("expected DiscordUsername %q, got %v", "Phaethon", owner.DiscordUsername)
	}
	if owner.DiscordAvatarURL == nil || *owner.DiscordAvatarURL != discordAvatar {
		t.Errorf("expected DiscordAvatarURL %q, got %v", discordAvatar, owner.DiscordAvatarURL)
	}

	// 2. Masking Discord fields when ShowDiscord == false
	accountNoDiscord := &domain.GameAccount{
		UserID:      user.ID,
		UID:         "1504687057",
		Region:      domain.RegionEurope,
		ShowDiscord: false,
	}
	if err := repo.Create(ctx, accountNoDiscord); err != nil {
		t.Fatalf("failed to create account: %v", err)
	}
	ownerNoDiscord, err := repo.GetPublicOwnerInfoByAccountID(ctx, accountNoDiscord.ID)
	if err != nil {
		t.Fatalf("failed to get public owner info for account without discord: %v", err)
	}
	if ownerNoDiscord.DiscordUsername != nil || ownerNoDiscord.DiscordAvatarURL != nil {
		t.Errorf("expected masked discord fields, got username=%v, avatar=%v", ownerNoDiscord.DiscordUsername, ownerNoDiscord.DiscordAvatarURL)
	}
	if ownerNoDiscord.IsVerified {
		t.Error("expected unverified account to have IsVerified == false")
	}

	// 3. User banned -> GetPublicOwnerInfoByAccountID returns domain.ErrNotFound
	reason := "TOS violation"
	if err := users.SetBan(ctx, user.ID, true, &reason); err != nil {
		t.Fatalf("failed to ban user: %v", err)
	}
	if _, err := repo.GetPublicOwnerInfoByAccountID(ctx, account.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for banned user, got %v", err)
	}

	// 4. Missing account returns domain.ErrNotFound
	if _, err := repo.GetPublicOwnerInfoByAccountID(ctx, uuid.New()); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for non-existent account, got %v", err)
	}
}

func TestAccountRepo_UpdateSettings(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	repo := NewAccountRepo(db)
	ctx := context.Background()

	user := seedUser(t, ctx, users, "404040404040404040")
	account := seedAccount(t, ctx, repo, user.ID, "1504687090")

	// 1. Enable showcase and discord
	if err := repo.UpdateSettings(ctx, account.ID, true, true); err != nil {
		t.Fatalf("failed to update settings: %v", err)
	}

	got, err := repo.GetByID(ctx, account.ID)
	if err != nil {
		t.Fatalf("failed to get account: %v", err)
	}
	if !got.IsPublicShowcase || !got.ShowDiscord {
		t.Errorf("expected IsPublicShowcase=true and ShowDiscord=true, got %+v", got)
	}

	// 2. Disable showcase and keep discord
	if err := repo.UpdateSettings(ctx, account.ID, false, true); err != nil {
		t.Fatalf("failed to update settings: %v", err)
	}
	got, _ = repo.GetByID(ctx, account.ID)
	if got.IsPublicShowcase || !got.ShowDiscord {
		t.Errorf("expected IsPublicShowcase=false and ShowDiscord=true, got %+v", got)
	}

	// 3. Not found for non-existent account
	if err := repo.UpdateSettings(ctx, uuid.New(), true, true); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for non-existent account, got %v", err)
	}
}

func TestAccountRepo_VerifyOwnership_And_Reclaim(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	repo := NewAccountRepo(db)
	ctx := context.Background()

	userA := seedUser(t, ctx, users, "505050505050505050")
	userB := seedUser(t, ctx, users, "505050505050505051")

	uid := "1504687091"
	accountA := seedAccount(t, ctx, repo, userA.ID, uid)
	accountB := seedAccount(t, ctx, repo, userB.ID, uid)

	nowA := time.Now().Truncate(time.Millisecond)
	nickA := "NickA"
	avatarA := "https://example.com/avatarA.png"

	// 1. Verify User A's account
	if err := repo.VerifyOwnership(ctx, accountA.ID, uid, nowA, &nickA, &avatarA); err != nil {
		t.Fatalf("failed to verify ownership for account A: %v", err)
	}

	gotA, err := repo.GetByID(ctx, accountA.ID)
	if err != nil {
		t.Fatalf("failed to get account A: %v", err)
	}
	if gotA.VerifiedAt == nil || !gotA.IsPublicShowcase {
		t.Fatalf("expected account A to be verified and have public showcase, got %+v", gotA)
	}
	if gotA.Nickname == nil || *gotA.Nickname != nickA {
		t.Errorf("expected nickname %q, got %v", nickA, gotA.Nickname)
	}
	if gotA.AvatarURL == nil || *gotA.AvatarURL != avatarA {
		t.Errorf("expected avatarURL %q, got %v", avatarA, gotA.AvatarURL)
	}

	// 2. Re-claim: User B verifies the SAME UID
	nowB := nowA.Add(5 * time.Minute)
	nickB := "NickB"
	if err := repo.VerifyOwnership(ctx, accountB.ID, uid, nowB, &nickB, nil); err != nil {
		t.Fatalf("failed to verify ownership for account B (re-claim): %v", err)
	}

	// User A should now be reset: verified_at = nil, is_public_showcase = false
	gotAAfter, err := repo.GetByID(ctx, accountA.ID)
	if err != nil {
		t.Fatalf("failed to get account A after reclaim: %v", err)
	}
	if gotAAfter.VerifiedAt != nil {
		t.Errorf("expected account A verified_at to be reset to nil, got %v", gotAAfter.VerifiedAt)
	}
	if gotAAfter.IsPublicShowcase {
		t.Error("expected account A is_public_showcase to be reset to false")
	}

	// User B should now be verified with public showcase
	gotB, err := repo.GetByID(ctx, accountB.ID)
	if err != nil {
		t.Fatalf("failed to get account B: %v", err)
	}
	if gotB.VerifiedAt == nil || !gotB.IsPublicShowcase {
		t.Fatalf("expected account B to be verified and have public showcase, got %+v", gotB)
	}
	if gotB.Nickname == nil || *gotB.Nickname != nickB {
		t.Errorf("expected nickname %q, got %v", nickB, gotB.Nickname)
	}

	// 3. Not found for non-existent account
	if err := repo.VerifyOwnership(ctx, uuid.New(), uid, time.Now(), nil, nil); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for non-existent account, got %v", err)
	}
}

func TestAccountRepo_GetVerifiedByUID(t *testing.T) {
	db := newMigratedTestDB(t)
	users := NewUserRepo(db)
	repo := NewAccountRepo(db)
	ctx := context.Background()

	discordAvatar := "https://cdn.discordapp.com/avatars/user.png"
	user := &domain.User{
		DiscordID: "606060606060606060",
		Username:  "VerifiedOwnerUser",
		AvatarURL: &discordAvatar,
	}
	if err := users.Create(ctx, user); err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	uid := "1504687092"
	account := seedAccount(t, ctx, repo, user.ID, uid)

	// 1. Unverified UID -> ErrNotFound
	if _, _, err := repo.GetVerifiedByUID(ctx, uid); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for unverified UID, got %v", err)
	}

	// 2. Verify account
	now := time.Now().Truncate(time.Millisecond)
	nick := "VerifiedNick"
	avatar := "https://example.com/avatar.png"
	if err := repo.VerifyOwnership(ctx, account.ID, uid, now, &nick, &avatar); err != nil {
		t.Fatalf("failed to verify ownership: %v", err)
	}

	// 3. With ShowDiscord = false -> Discord fields masked
	gotAcc, owner, err := repo.GetVerifiedByUID(ctx, uid)
	if err != nil {
		t.Fatalf("failed to get verified by UID: %v", err)
	}
	if gotAcc.ID != account.ID || gotAcc.UID != uid {
		t.Errorf("account mismatch: %+v", gotAcc)
	}
	if !owner.IsVerified {
		t.Error("expected owner.IsVerified == true")
	}
	if owner.DiscordUsername != nil || owner.DiscordAvatarURL != nil {
		t.Errorf("expected masked discord fields when ShowDiscord=false, got username=%v, avatar=%v", owner.DiscordUsername, owner.DiscordAvatarURL)
	}

	// 4. Update ShowDiscord = true -> Discord fields revealed
	if err := repo.UpdateSettings(ctx, account.ID, true, true); err != nil {
		t.Fatalf("failed to enable show_discord: %v", err)
	}
	_, ownerDiscord, err := repo.GetVerifiedByUID(ctx, uid)
	if err != nil {
		t.Fatalf("failed to get verified by UID with discord enabled: %v", err)
	}
	if ownerDiscord.DiscordUsername == nil || *ownerDiscord.DiscordUsername != "VerifiedOwnerUser" {
		t.Errorf("expected DiscordUsername %q, got %v", "VerifiedOwnerUser", ownerDiscord.DiscordUsername)
	}
	if ownerDiscord.DiscordAvatarURL == nil || *ownerDiscord.DiscordAvatarURL != discordAvatar {
		t.Errorf("expected DiscordAvatarURL %q, got %v", discordAvatar, ownerDiscord.DiscordAvatarURL)
	}

	// 5. Banned user -> ErrNotFound
	reason := "Spam"
	if err := users.SetBan(ctx, user.ID, true, &reason); err != nil {
		t.Fatalf("failed to ban user: %v", err)
	}
	if _, _, err := repo.GetVerifiedByUID(ctx, uid); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for banned verified owner, got %v", err)
	}
}
