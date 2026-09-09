package sqlite

import (
	"context"
	"errors"
	"testing"

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
