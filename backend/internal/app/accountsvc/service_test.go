package accountsvc

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

type mockAccountStore struct {
	accounts map[uuid.UUID]*domain.GameAccount
}

func newMockAccountStore() *mockAccountStore {
	return &mockAccountStore{accounts: make(map[uuid.UUID]*domain.GameAccount)}
}

func (m *mockAccountStore) Create(_ context.Context, account *domain.GameAccount) error {
	if account.ID == uuid.Nil {
		account.ID = uuid.New()
	}
	m.accounts[account.ID] = account
	return nil
}

func (m *mockAccountStore) GetByID(_ context.Context, id uuid.UUID) (*domain.GameAccount, error) {
	acc, ok := m.accounts[id]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return acc, nil
}

func (m *mockAccountStore) GetByUserAndUID(_ context.Context, userID uuid.UUID, uid string) (*domain.GameAccount, error) {
	for _, acc := range m.accounts {
		if acc.UserID == userID && acc.UID == uid {
			return acc, nil
		}
	}
	return nil, domain.ErrNotFound
}

func (m *mockAccountStore) ListByUser(_ context.Context, userID uuid.UUID) ([]*domain.GameAccount, error) {
	var list []*domain.GameAccount
	for _, acc := range m.accounts {
		if acc.UserID == userID {
			list = append(list, acc)
		}
	}
	return list, nil
}

func (m *mockAccountStore) CountByUser(_ context.Context, userID uuid.UUID) (int, error) {
	var count int
	for _, acc := range m.accounts {
		if acc.UserID == userID {
			count++
		}
	}
	return count, nil
}

func (m *mockAccountStore) Delete(_ context.Context, id uuid.UUID) error {
	if _, ok := m.accounts[id]; !ok {
		return domain.ErrNotFound
	}
	delete(m.accounts, id)
	return nil
}

func TestAccountService_CreateLimitReached(t *testing.T) {
	store := newMockAccountStore()
	svc := New(store)

	userID := uuid.New()
	for i := range domain.MaxAccountsPerUser {
		uid := fmt.Sprintf("150468705%d", i)
		if _, err := svc.Create(context.Background(), userID, uid, "Europe"); err != nil {
			t.Fatalf("failed to create account %d: %v", i, err)
		}
	}

	// Next create exceeds limit
	_, err := svc.Create(context.Background(), userID, "1504687099", "Europe")
	if !errors.Is(err, domain.ErrConflict) {
		t.Errorf("expected ErrConflict when account limit reached, got %v", err)
	}
}

func TestAccountService_CreateSuccess(t *testing.T) {
	store := newMockAccountStore()
	svc := New(store)

	userID := uuid.New()
	account, err := svc.Create(context.Background(), userID, "1504687050", "Europe")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if account.UID != "1504687050" || account.Region != "Europe" || account.UserID != userID {
		t.Errorf("unexpected account: %+v", account)
	}
}

func TestAccountService_CreateDefaultRegion(t *testing.T) {
	store := newMockAccountStore()
	svc := New(store)

	userID := uuid.New()
	account, err := svc.Create(context.Background(), userID, "123456789", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if account.Region != domain.DefaultRegion {
		t.Errorf("expected default region %s, got %s", domain.DefaultRegion, account.Region)
	}
}

func TestAccountService_CreateAutoDetectRegion(t *testing.T) {
	cases := []struct {
		uid        string
		wantRegion string
	}{
		{"1004687050", domain.RegionAmerica},
		{"1304687050", domain.RegionAsia},
		{"1504687050", domain.RegionEurope},
		{"1704687050", domain.RegionTWHKMO},
	}

	for _, tc := range cases {
		store := newMockAccountStore()
		svc := New(store)
		account, err := svc.Create(context.Background(), uuid.New(), tc.uid, "")
		if err != nil {
			t.Fatalf("Create(%q) unexpected error: %v", tc.uid, err)
		}
		if account.Region != tc.wantRegion {
			t.Errorf("Create(%q) region = %q, want %q", tc.uid, account.Region, tc.wantRegion)
		}
	}
}

func TestAccountService_CreateInvalidInput(t *testing.T) {
	store := newMockAccountStore()
	svc := New(store)

	userID := uuid.New()

	// Invalid UID
	if _, err := svc.Create(context.Background(), userID, "123", "Europe"); !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput for short UID, got %v", err)
	}

	// Unsupported Region
	if _, err := svc.Create(context.Background(), userID, "1504687050", "Antarctica"); !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput for invalid region, got %v", err)
	}

	// Missing user
	if _, err := svc.Create(context.Background(), uuid.Nil, "1504687050", "Europe"); !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput for nil user, got %v", err)
	}
}

func TestAccountService_CreateDuplicateUID(t *testing.T) {
	store := newMockAccountStore()
	svc := New(store)

	userID := uuid.New()
	if _, err := svc.Create(context.Background(), userID, "1504687050", "Europe"); err != nil {
		t.Fatalf("first create failed: %v", err)
	}

	if _, err := svc.Create(context.Background(), userID, "1504687050", "Europe"); !errors.Is(err, domain.ErrConflict) {
		t.Errorf("expected ErrConflict on duplicate create, got %v", err)
	}
}

func TestAccountService_List(t *testing.T) {
	store := newMockAccountStore()
	svc := New(store)

	userA := uuid.New()
	userB := uuid.New()

	_, _ = svc.Create(context.Background(), userA, "1504687051", "Europe")
	_, _ = svc.Create(context.Background(), userA, "1504687052", "America")
	_, _ = svc.Create(context.Background(), userB, "1504687053", "Asia")

	listA, err := svc.List(context.Background(), userA)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(listA) != 2 {
		t.Errorf("expected 2 accounts for userA, got %d", len(listA))
	}
}

func TestAccountService_Delete(t *testing.T) {
	store := newMockAccountStore()
	svc := New(store)

	userA := uuid.New()
	userB := uuid.New()

	acc, err := svc.Create(context.Background(), userA, "1504687051", "Europe")
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	// User B cannot delete user A's account
	if err := svc.Delete(context.Background(), userB, acc.ID); !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("expected ErrForbidden when foreign user deletes account, got %v", err)
	}

	// User A can delete
	if err := svc.Delete(context.Background(), userA, acc.ID); err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	// Deleting non-existent account returns ErrNotFound
	if err := svc.Delete(context.Background(), userA, acc.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for deleted account, got %v", err)
	}
}

type mockUserStore struct {
	users map[uuid.UUID]*domain.User
}

func (m *mockUserStore) GetByID(_ context.Context, id uuid.UUID) (*domain.User, error) {
	if u, ok := m.users[id]; ok {
		return u, nil
	}
	return nil, domain.ErrNotFound
}

func TestAccountService_CreateCustomLimit(t *testing.T) {
	store := newMockAccountStore()
	customLimit := 5
	userID := uuid.New()
	userStore := &mockUserStore{
		users: map[uuid.UUID]*domain.User{
			userID: {
				ID:                userID,
				CustomMaxAccounts: &customLimit,
			},
		},
	}
	svc := New(store, WithUsers(userStore))

	for i := range customLimit {
		uid := fmt.Sprintf("150468705%d", i)
		if _, err := svc.Create(context.Background(), userID, uid, "Europe"); err != nil {
			t.Fatalf("failed to create account %d within custom limit: %v", i, err)
		}
	}

	// 6th creation exceeds custom limit of 5
	_, err := svc.Create(context.Background(), userID, "1504687099", "Europe")
	if !errors.Is(err, domain.ErrConflict) {
		t.Errorf("expected ErrConflict when custom account limit reached, got %v", err)
	}
}
