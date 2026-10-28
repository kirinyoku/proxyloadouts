package accountsvc

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
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

func (m *mockAccountStore) UpdateProfileMetadata(_ context.Context, id uuid.UUID, nickname, avatarURL *string) error {
	acc, ok := m.accounts[id]
	if !ok {
		return domain.ErrNotFound
	}
	acc.Nickname = nickname
	acc.AvatarURL = avatarURL
	return nil
}

func (m *mockAccountStore) UpdateSettings(_ context.Context, id uuid.UUID, isPublicShowcase, showDiscord bool) error {
	acc, ok := m.accounts[id]
	if !ok {
		return domain.ErrNotFound
	}
	acc.IsPublicShowcase = isPublicShowcase
	acc.ShowDiscord = showDiscord
	return nil
}

func (m *mockAccountStore) VerifyOwnership(_ context.Context, accountID uuid.UUID, uid string, verifiedAt time.Time, nickname, avatarURL *string) error {
	acc, ok := m.accounts[accountID]
	if !ok {
		return domain.ErrNotFound
	}
	for _, a := range m.accounts {
		if a.UID == uid && a.ID != accountID && a.VerifiedAt != nil {
			a.VerifiedAt = nil
			a.IsPublicShowcase = false
		}
	}
	acc.VerifiedAt = &verifiedAt
	acc.IsPublicShowcase = true
	if nickname != nil {
		acc.Nickname = nickname
	}
	if avatarURL != nil {
		acc.AvatarURL = avatarURL
	}
	return nil
}

func (m *mockAccountStore) GetVerifiedByUID(_ context.Context, uid string) (*domain.GameAccount, *domain.PublicOwnerInfo, error) {
	for _, a := range m.accounts {
		if a.UID == uid && a.VerifiedAt != nil {
			return a, &domain.PublicOwnerInfo{
				UID:        a.UID,
				Region:     a.Region,
				Nickname:   a.Nickname,
				AvatarURL:  a.AvatarURL,
				IsVerified: true,
			}, nil
		}
	}
	return nil, nil, domain.ErrNotFound
}

func (m *mockAccountStore) GetPublicOwnerInfoByAccountID(_ context.Context, accountID uuid.UUID) (*domain.PublicOwnerInfo, error) {
	a, ok := m.accounts[accountID]
	if !ok {
		return nil, domain.ErrNotFound
	}
	return &domain.PublicOwnerInfo{
		UID:        a.UID,
		Region:     a.Region,
		Nickname:   a.Nickname,
		AvatarURL:  a.AvatarURL,
		IsVerified: a.IsVerified(),
	}, nil
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

type mockScanner struct {
	resp *scannersvc.ShowcaseResponse
	err  error
}

func (m *mockScanner) ScanByUID(_ context.Context, _ string, _ ...string) (*scannersvc.ShowcaseResponse, error) {
	return m.resp, m.err
}

func TestAccountService_CreateWithScannerPopulatesMetadata(t *testing.T) {
	store := newMockAccountStore()
	scanner := &mockScanner{
		resp: &scannersvc.ShowcaseResponse{
			UID:       "1504687050",
			Nickname:  "ProxyKirin",
			AvatarURL: "https://example.com/avatar.png",
		},
	}
	svc := New(store, WithScanner(scanner))

	userID := uuid.New()
	account, err := svc.Create(context.Background(), userID, "1504687050", "Europe")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if account.Nickname == nil || *account.Nickname != "ProxyKirin" {
		t.Errorf("expected Nickname ProxyKirin, got %v", account.Nickname)
	}
	if account.AvatarURL == nil || *account.AvatarURL != "https://example.com/avatar.png" {
		t.Errorf("expected AvatarURL https://example.com/avatar.png, got %v", account.AvatarURL)
	}
}

func TestAccountService_UpdateProfileMetadata(t *testing.T) {
	store := newMockAccountStore()
	svc := New(store)

	userID := uuid.New()
	account, err := svc.Create(context.Background(), userID, "1504687050", "Europe")
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	newNick := "UpdatedNick"
	newAvatar := "https://example.com/new.png"
	if err := svc.UpdateProfileMetadata(context.Background(), account.ID, &newNick, &newAvatar); err != nil {
		t.Fatalf("UpdateProfileMetadata failed: %v", err)
	}

	updated, err := store.GetByID(context.Background(), account.ID)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if updated.Nickname == nil || *updated.Nickname != newNick {
		t.Errorf("expected Nickname %q, got %v", newNick, updated.Nickname)
	}
	if updated.AvatarURL == nil || *updated.AvatarURL != newAvatar {
		t.Errorf("expected AvatarURL %q, got %v", newAvatar, updated.AvatarURL)
	}
}

type mockVerifier struct {
	profile *scannersvc.FreshVerificationProfile
	err     error
	calls   int
}

func (m *mockVerifier) FetchFreshProfile(_ context.Context, _ string) (*scannersvc.FreshVerificationProfile, error) {
	m.calls++
	return m.profile, m.err
}

func TestAccountService_StartVerification_GenerationAndTTL(t *testing.T) {
	store := newMockAccountStore()
	currTime := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	svc := New(store, WithClock(func() time.Time { return currTime }))

	userID := uuid.New()
	account, err := svc.Create(context.Background(), userID, "1504687050", "Europe")
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	// 1. Generation format check
	challenge1, err := svc.StartVerification(context.Background(), userID, account.ID)
	if err != nil {
		t.Fatalf("StartVerification failed: %v", err)
	}

	codeRegex := regexp.MustCompile(`^PXL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$`)
	if !codeRegex.MatchString(challenge1.Code) {
		t.Fatalf("challenge code %q does not match expected pattern ^PXL-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$", challenge1.Code)
	}
	expectedExpiry1 := currTime.Add(30 * time.Minute)
	if !challenge1.ExpiresAt.Equal(expectedExpiry1) {
		t.Errorf("expected expiresAt %v, got %v", expectedExpiry1, challenge1.ExpiresAt)
	}
	if challenge1.CooldownSeconds != 30 {
		t.Errorf("expected cooldown_seconds 30, got %d", challenge1.CooldownSeconds)
	}

	// 2. Idempotency before TTL expiration (e.g. 10 minutes later)
	currTime = currTime.Add(10 * time.Minute)
	challenge2, err := svc.StartVerification(context.Background(), userID, account.ID)
	if err != nil {
		t.Fatalf("second StartVerification failed: %v", err)
	}
	if challenge2.Code != challenge1.Code {
		t.Errorf("expected idempotent code %q, got %q", challenge1.Code, challenge2.Code)
	}
	if !challenge2.ExpiresAt.Equal(challenge1.ExpiresAt) {
		t.Errorf("expected same expiresAt %v, got %v", challenge1.ExpiresAt, challenge2.ExpiresAt)
	}

	// 3. Regeneration after TTL expiration (> 30 min)
	currTime = currTime.Add(25 * time.Minute) // 35 minutes since first start
	challenge3, err := svc.StartVerification(context.Background(), userID, account.ID)
	if err != nil {
		t.Fatalf("third StartVerification failed: %v", err)
	}
	if !codeRegex.MatchString(challenge3.Code) {
		t.Fatalf("new code %q invalid format", challenge3.Code)
	}
	expectedExpiry3 := currTime.Add(30 * time.Minute)
	if !challenge3.ExpiresAt.Equal(expectedExpiry3) {
		t.Errorf("expected new expiresAt %v, got %v", expectedExpiry3, challenge3.ExpiresAt)
	}
}

func TestAccountService_ConfirmVerification_CooldownRateLimited(t *testing.T) {
	store := newMockAccountStore()
	currTime := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)

	verifier := &mockVerifier{
		profile: &scannersvc.FreshVerificationProfile{
			UID:       "1504687050",
			Nickname:  "ProxyMaster",
			Signature: "no code here yet",
		},
	}

	svc := New(store,
		WithVerifier(verifier),
		WithClock(func() time.Time { return currTime }),
	)

	userID := uuid.New()
	account, err := svc.Create(context.Background(), userID, "1504687050", "Europe")
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	challenge, err := svc.StartVerification(context.Background(), userID, account.ID)
	if err != nil {
		t.Fatalf("StartVerification failed: %v", err)
	}

	// First attempt: signature does not contain code -> ErrConflict
	_, err = svc.ConfirmVerification(context.Background(), userID, account.ID)
	if !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("expected ErrConflict on first mismatch attempt, got %v", err)
	}

	// Immediate second attempt (0 seconds later) -> ErrRateLimited
	_, err = svc.ConfirmVerification(context.Background(), userID, account.ID)
	if !errors.Is(err, domain.ErrRateLimited) {
		t.Fatalf("expected ErrRateLimited on immediate second attempt, got %v", err)
	}

	// 15 seconds later (< 30s) -> still ErrRateLimited
	currTime = currTime.Add(15 * time.Second)
	_, err = svc.ConfirmVerification(context.Background(), userID, account.ID)
	if !errors.Is(err, domain.ErrRateLimited) {
		t.Fatalf("expected ErrRateLimited after 15 seconds, got %v", err)
	}

	// 31 seconds later (> 30s) -> allowed to retry, returns ErrConflict again
	currTime = currTime.Add(16 * time.Second)
	_, err = svc.ConfirmVerification(context.Background(), userID, account.ID)
	if !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("expected ErrConflict after cooldown elapses, got %v", err)
	}

	// Now set signature to match code and advance 31 seconds
	currTime = currTime.Add(31 * time.Second)
	verifier.profile.Signature = fmt.Sprintf("My signature with %s included", challenge.Code)
	verified, err := svc.ConfirmVerification(context.Background(), userID, account.ID)
	if err != nil {
		t.Fatalf("expected successful verification after cooldown, got %v", err)
	}
	if verified.VerifiedAt == nil {
		t.Fatal("expected account to be verified")
	}
}

func TestAccountService_ConfirmVerification_ConflictWhenSignatureMissing(t *testing.T) {
	store := newMockAccountStore()
	currTime := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)

	verifier := &mockVerifier{
		profile: &scannersvc.FreshVerificationProfile{
			UID:       "1504687050",
			Nickname:  "ProxyMaster",
			Signature: "Just playing Zenless Zone Zero!",
		},
	}

	svc := New(store,
		WithVerifier(verifier),
		WithClock(func() time.Time { return currTime }),
	)

	userID := uuid.New()
	account, err := svc.Create(context.Background(), userID, "1504687050", "Europe")
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	challenge, err := svc.StartVerification(context.Background(), userID, account.ID)
	if err != nil {
		t.Fatalf("StartVerification failed: %v", err)
	}

	_, err = svc.ConfirmVerification(context.Background(), userID, account.ID)
	if !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("expected ErrConflict (409), got %v", err)
	}

	expectedMsg := fmt.Sprintf("verification code %s not found in player signature", challenge.Code)
	if !strings.Contains(err.Error(), expectedMsg) {
		t.Errorf("expected error message to contain %q, got %q", expectedMsg, err.Error())
	}

	// Account remains unverified
	acc, err := store.GetByID(context.Background(), account.ID)
	if err != nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if acc.VerifiedAt != nil || acc.IsPublicShowcase {
		t.Errorf("account must remain unverified, got VerifiedAt=%v, IsPublicShowcase=%v", acc.VerifiedAt, acc.IsPublicShowcase)
	}
}

func TestAccountService_ConfirmVerification_SuccessAndReclaim(t *testing.T) {
	store := newMockAccountStore()
	currTime := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)

	verifier := &mockVerifier{
		profile: &scannersvc.FreshVerificationProfile{
			UID:       "1504687050",
			Nickname:  "UserANick",
			AvatarURL: "https://example.com/avatarA.png",
		},
	}

	svc := New(store,
		WithVerifier(verifier),
		WithClock(func() time.Time { return currTime }),
	)

	userA := uuid.New()
	userB := uuid.New()
	uid := "1504687050"

	// 1. User A links and verifies account A
	accA, err := svc.Create(context.Background(), userA, uid, "Europe")
	if err != nil {
		t.Fatalf("user A create failed: %v", err)
	}

	challengeA, err := svc.StartVerification(context.Background(), userA, accA.ID)
	if err != nil {
		t.Fatalf("user A start failed: %v", err)
	}

	verifier.profile.Signature = "User A bio " + challengeA.Code
	verifiedA, err := svc.ConfirmVerification(context.Background(), userA, accA.ID)
	if err != nil {
		t.Fatalf("user A confirm failed: %v", err)
	}
	if verifiedA.VerifiedAt == nil || !verifiedA.IsPublicShowcase {
		t.Fatalf("expected user A account to be verified with public showcase, got %+v", verifiedA)
	}
	if verifiedA.Nickname == nil || *verifiedA.Nickname != "UserANick" {
		t.Errorf("expected user A nickname UserANick, got %v", verifiedA.Nickname)
	}

	// Verification code consumed: repeated confirm should fail with ErrNotFound
	currTime = currTime.Add(31 * time.Second)
	if _, err := svc.ConfirmVerification(context.Background(), userA, accA.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected ErrNotFound for consumed challenge code, got %v", err)
	}

	// 2. User B links the SAME UID and verifies it (Re-claim scenario)
	accB, err := svc.Create(context.Background(), userB, uid, "Europe")
	if err != nil {
		t.Fatalf("user B create failed: %v", err)
	}

	currTime = currTime.Add(5 * time.Minute)
	challengeB, err := svc.StartVerification(context.Background(), userB, accB.ID)
	if err != nil {
		t.Fatalf("user B start failed: %v", err)
	}

	verifier.profile.Nickname = "UserBNick"
	verifier.profile.AvatarURL = "https://example.com/avatarB.png"
	verifier.profile.Signature = "User B bio " + challengeB.Code

	verifiedB, err := svc.ConfirmVerification(context.Background(), userB, accB.ID)
	if err != nil {
		t.Fatalf("user B confirm (re-claim) failed: %v", err)
	}
	if verifiedB.VerifiedAt == nil || !verifiedB.IsPublicShowcase {
		t.Fatalf("expected user B account to be verified, got %+v", verifiedB)
	}
	if verifiedB.Nickname == nil || *verifiedB.Nickname != "UserBNick" {
		t.Errorf("expected user B nickname UserBNick, got %v", verifiedB.Nickname)
	}

	// Check that User A's account has been reset: verified_at = nil, is_public_showcase = false
	// but the account still exists in store for User A (preserving User A's private builds)
	accAReset, err := store.GetByID(context.Background(), accA.ID)
	if err != nil {
		t.Fatalf("failed to retrieve User A account: %v", err)
	}
	if accAReset.VerifiedAt != nil {
		t.Errorf("expected User A verified_at to be reset to nil, got %v", accAReset.VerifiedAt)
	}
	if accAReset.IsPublicShowcase {
		t.Errorf("expected User A is_public_showcase to be reset to false")
	}
	if accAReset.UserID != userA {
		t.Errorf("expected User A account to remain owned by user A, got %v", accAReset.UserID)
	}
}

func TestAccountService_UpdateSettings(t *testing.T) {
	store := newMockAccountStore()
	svc := New(store)

	userA := uuid.New()
	userB := uuid.New()

	acc, err := svc.Create(context.Background(), userA, "1504687050", "Europe")
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	trueVal := true
	falseVal := false

	// 1. Unverified account cannot enable public showcase -> ErrConflict
	_, err = svc.UpdateSettings(context.Background(), userA, acc.ID, &trueVal, nil)
	if !errors.Is(err, domain.ErrConflict) {
		t.Fatalf("expected ErrConflict when enabling showcase on unverified account, got %v", err)
	}

	// 2. Unverified account CAN toggle showDiscord
	updated, err := svc.UpdateSettings(context.Background(), userA, acc.ID, &falseVal, &trueVal)
	if err != nil {
		t.Fatalf("UpdateSettings failed: %v", err)
	}
	if updated.ShowDiscord != true || updated.IsPublicShowcase != false {
		t.Fatalf("unexpected settings: ShowDiscord=%v, IsPublicShowcase=%v", updated.ShowDiscord, updated.IsPublicShowcase)
	}

	// 3. User B cannot modify User A's settings -> ErrForbidden
	_, err = svc.UpdateSettings(context.Background(), userB, acc.ID, &falseVal, &falseVal)
	if !errors.Is(err, domain.ErrForbidden) {
		t.Fatalf("expected ErrForbidden for foreign user, got %v", err)
	}

	// 4. Once verified, can toggle isPublicShowcase freely
	now := time.Now()
	acc.VerifiedAt = &now
	_ = store.VerifyOwnership(context.Background(), acc.ID, acc.UID, now, nil, nil)

	updatedVerified, err := svc.UpdateSettings(context.Background(), userA, acc.ID, &trueVal, &falseVal)
	if err != nil {
		t.Fatalf("UpdateSettings failed for verified account: %v", err)
	}
	if !updatedVerified.IsPublicShowcase || updatedVerified.ShowDiscord {
		t.Fatalf("unexpected settings for verified account: IsPublicShowcase=%v, ShowDiscord=%v",
			updatedVerified.IsPublicShowcase, updatedVerified.ShowDiscord)
	}
}

func TestAccountService_Verification_ValidationAndForbidden(t *testing.T) {
	store := newMockAccountStore()
	svc := New(store)

	userA := uuid.New()
	userB := uuid.New()

	acc, err := svc.Create(context.Background(), userA, "1504687050", "Europe")
	if err != nil {
		t.Fatalf("create failed: %v", err)
	}

	// Missing inputs
	if _, err := svc.StartVerification(context.Background(), uuid.Nil, acc.ID); !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput for nil user, got %v", err)
	}
	if _, err := svc.StartVerification(context.Background(), userA, uuid.Nil); !errors.Is(err, domain.ErrInvalidInput) {
		t.Errorf("expected ErrInvalidInput for nil account, got %v", err)
	}

	// Foreign user StartVerification -> ErrForbidden
	if _, err := svc.StartVerification(context.Background(), userB, acc.ID); !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("expected ErrForbidden when foreign user starts verification, got %v", err)
	}

	// Foreign user ConfirmVerification -> ErrForbidden
	if _, err := svc.ConfirmVerification(context.Background(), userB, acc.ID); !errors.Is(err, domain.ErrForbidden) {
		t.Errorf("expected ErrForbidden when foreign user confirms verification, got %v", err)
	}

	// Missing challenge -> ErrNotFound
	if _, err := svc.ConfirmVerification(context.Background(), userA, acc.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound when confirming without active challenge, got %v", err)
	}
}
