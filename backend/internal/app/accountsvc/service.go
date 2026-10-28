// Package accountsvc implements the game account use cases: linking ZZZ
// accounts (UIDs) to a user, listing owned accounts, and deleting them with
// ownership validation.
package accountsvc

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

const (
	challengeAlphabet   = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
	challengeCodePrefix = "PXL-"
	challengeCodeLength = 4
	verificationTTL     = 30 * time.Minute
	confirmCooldown     = 30 * time.Second
)

// VerificationChallenge represents an active challenge code issued to verify game account ownership.
type VerificationChallenge struct {
	Code            string    `json:"code"`
	ExpiresAt       time.Time `json:"expires_at"`
	CooldownSeconds int       `json:"cooldown_seconds"`
}

type challengeEntry struct {
	code          string
	expiresAt     time.Time
	lastAttemptAt time.Time
}

// ChallengeStore stores in-memory verification challenges per game account.
type ChallengeStore struct {
	mu         sync.Mutex
	challenges map[string]challengeEntry
}

// NewChallengeStore creates a new in-memory challenge store.
func NewChallengeStore() *ChallengeStore {
	return &ChallengeStore{
		challenges: make(map[string]challengeEntry),
	}
}

// PruneExpired removes all expired verification challenges from the store.
func (cs *ChallengeStore) PruneExpired(now time.Time) {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	for k, v := range cs.challenges {
		if !now.Before(v.expiresAt) {
			delete(cs.challenges, k)
		}
	}
}

// AccountStore persists and queries game accounts.
type AccountStore interface {
	Create(ctx context.Context, account *domain.GameAccount) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.GameAccount, error)
	GetByUserAndUID(ctx context.Context, userID uuid.UUID, uid string) (*domain.GameAccount, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.GameAccount, error)
	CountByUser(ctx context.Context, userID uuid.UUID) (int, error)
	UpdateProfileMetadata(ctx context.Context, id uuid.UUID, nickname, avatarURL *string) error
	UpdateSettings(ctx context.Context, id uuid.UUID, isPublicShowcase, showDiscord bool) error
	VerifyOwnership(ctx context.Context, accountID uuid.UUID, uid string, verifiedAt time.Time, nickname, avatarURL *string) error
	Delete(ctx context.Context, id uuid.UUID) error
}

// UserStore retrieves users to check custom quotas.
type UserStore interface {
	GetByID(ctx context.Context, id uuid.UUID) (*domain.User, error)
}

// ProfileScanner validates and scans ZZZ showcases by UID.
type ProfileScanner interface {
	ScanByUID(ctx context.Context, uid string, lang ...string) (*scannersvc.ShowcaseResponse, error)
}

// ProfileVerifier fetches fresh profile metadata and signature for ownership verification.
type ProfileVerifier interface {
	FetchFreshProfile(ctx context.Context, uid string) (*scannersvc.FreshVerificationProfile, error)
}

// Option configures optional Service dependencies.
type Option func(*Service)

// WithUsers configures an optional UserStore to enforce custom per-user account quotas.
func WithUsers(users UserStore) Option {
	return func(s *Service) {
		s.users = users
	}
}

// WithScanner configures an optional ProfileScanner to fetch player metadata upon linking.
func WithScanner(scanner ProfileScanner) Option {
	return func(s *Service) {
		s.scanner = scanner
	}
}

// WithVerifier configures an optional ProfileVerifier to check in-game signatures.
func WithVerifier(verifier ProfileVerifier) Option {
	return func(s *Service) {
		s.verifier = verifier
	}
}

// WithChallengeStore configures a custom in-memory challenge store.
func WithChallengeStore(challenges *ChallengeStore) Option {
	return func(s *Service) {
		s.challenges = challenges
	}
}

// WithClock sets a custom clock function for time-dependent operations.
func WithClock(nowFn func() time.Time) Option {
	return func(s *Service) {
		s.now = nowFn
	}
}

// Service implements game account use cases.
type Service struct {
	accounts   AccountStore
	users      UserStore
	scanner    ProfileScanner
	verifier   ProfileVerifier
	challenges *ChallengeStore
	now        func() time.Time
}

// New creates a new game account service.
func New(accounts AccountStore, opts ...Option) *Service {
	s := &Service{
		accounts:   accounts,
		challenges: NewChallengeStore(),
		now:        time.Now,
	}
	for _, opt := range opts {
		opt(s)
	}
	if s.verifier == nil && s.scanner != nil {
		if v, ok := s.scanner.(ProfileVerifier); ok {
			s.verifier = v
		}
	}
	return s
}

// Create links a ZZZ UID to the specified user after validating format and region.
// Attempting to link a UID already linked by this user returns domain.ErrConflict.
func (s *Service) Create(ctx context.Context, userID uuid.UUID, uid, region string) (*domain.GameAccount, error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("%w: user id is required", domain.ErrInvalidInput)
	}

	cleanUID := strings.TrimSpace(uid)
	if err := domain.ValidateUID(cleanUID); err != nil {
		return nil, fmt.Errorf("%w: %w", domain.ErrInvalidInput, err)
	}

	cleanRegion := strings.TrimSpace(region)
	if cleanRegion == "" {
		if r, ok := domain.RegionFromUID(cleanUID); ok {
			cleanRegion = r
		} else {
			cleanRegion = domain.DefaultRegion
		}
	}
	if !domain.IsValidRegion(cleanRegion) {
		return nil, fmt.Errorf("%w: unsupported region %q", domain.ErrInvalidInput, cleanRegion)
	}

	maxAccounts := domain.MaxAccountsPerUser
	if s.users != nil {
		if u, err := s.users.GetByID(ctx, userID); err == nil && u != nil {
			maxAccounts = u.EffectiveMaxAccounts()
		}
	}

	count, err := s.accounts.CountByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	if count >= maxAccounts {
		return nil, fmt.Errorf("%w: limit of %d linked accounts reached", domain.ErrConflict, maxAccounts)
	}

	// Duplicate UID for the same user is rejected up front.
	if _, err := s.accounts.GetByUserAndUID(ctx, userID, cleanUID); err == nil {
		return nil, fmt.Errorf("%w: this uid is already linked to your account", domain.ErrConflict)
	}

	var nickname *string
	var avatarURL *string
	if s.scanner != nil {
		if showcase, err := s.scanner.ScanByUID(ctx, cleanUID); err == nil && showcase != nil {
			if showcase.Nickname != "" {
				nickname = &showcase.Nickname
			}
			if showcase.AvatarURL != "" {
				avatarURL = &showcase.AvatarURL
			}
		}
	}

	account := &domain.GameAccount{
		UserID:    userID,
		UID:       cleanUID,
		Region:    cleanRegion,
		Nickname:  nickname,
		AvatarURL: avatarURL,
	}
	if err := s.accounts.Create(ctx, account); err != nil {
		return nil, err
	}
	return account, nil
}

// UpdateProfileMetadata updates the display nickname and avatar URL of a game account.
func (s *Service) UpdateProfileMetadata(ctx context.Context, id uuid.UUID, nickname, avatarURL *string) error {
	return s.accounts.UpdateProfileMetadata(ctx, id, nickname, avatarURL)
}

// List returns all linked game accounts for the given user.
func (s *Service) List(ctx context.Context, userID uuid.UUID) ([]*domain.GameAccount, error) {
	if userID == uuid.Nil {
		return nil, fmt.Errorf("%w: user id is required", domain.ErrInvalidInput)
	}
	return s.accounts.ListByUser(ctx, userID)
}

// Delete removes an owned game account, cascading to builds and teams.
// Attempting to delete an account belonging to another user returns domain.ErrForbidden.
func (s *Service) Delete(ctx context.Context, userID, accountID uuid.UUID) error {
	if userID == uuid.Nil || accountID == uuid.Nil {
		return fmt.Errorf("%w: user and account ids are required", domain.ErrInvalidInput)
	}

	account, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return err
	}
	if account.UserID != userID {
		return fmt.Errorf("%w: you do not own this account", domain.ErrForbidden)
	}

	return s.accounts.Delete(ctx, accountID)
}

// StartVerification initiates an ownership verification challenge for the given game account.
// If an unexpired challenge already exists for the account, it is returned without regenerating.
func (s *Service) StartVerification(ctx context.Context, userID, accountID uuid.UUID) (*VerificationChallenge, error) {
	if userID == uuid.Nil || accountID == uuid.Nil {
		return nil, fmt.Errorf("%w: user and account ids are required", domain.ErrInvalidInput)
	}

	account, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return nil, err
	}
	if account.UserID != userID {
		return nil, fmt.Errorf("%w: you do not own this account", domain.ErrForbidden)
	}

	s.challenges.mu.Lock()
	defer s.challenges.mu.Unlock()

	now := s.now()
	key := accountID.String()

	if entry, ok := s.challenges.challenges[key]; ok && now.Before(entry.expiresAt) {
		return &VerificationChallenge{
			Code:            entry.code,
			ExpiresAt:       entry.expiresAt,
			CooldownSeconds: int(confirmCooldown.Seconds()),
		}, nil
	}

	code, err := generateChallengeCode()
	if err != nil {
		return nil, err
	}

	expiresAt := now.Add(verificationTTL)
	s.challenges.challenges[key] = challengeEntry{
		code:      code,
		expiresAt: expiresAt,
	}

	if len(s.challenges.challenges) > 1000 {
		for k, v := range s.challenges.challenges {
			if !now.Before(v.expiresAt) {
				delete(s.challenges.challenges, k)
			}
		}
	}

	return &VerificationChallenge{
		Code:            code,
		ExpiresAt:       expiresAt,
		CooldownSeconds: int(confirmCooldown.Seconds()),
	}, nil
}

// ConfirmVerification verifies account ownership by checking that the player's
// in-game profile signature contains the active verification challenge code.
func (s *Service) ConfirmVerification(ctx context.Context, userID, accountID uuid.UUID) (*domain.GameAccount, error) {
	if userID == uuid.Nil || accountID == uuid.Nil {
		return nil, fmt.Errorf("%w: user and account ids are required", domain.ErrInvalidInput)
	}

	account, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return nil, err
	}
	if account.UserID != userID {
		return nil, fmt.Errorf("%w: you do not own this account", domain.ErrForbidden)
	}

	key := accountID.String()
	now := s.now()

	s.challenges.mu.Lock()
	entry, ok := s.challenges.challenges[key]
	if !ok || !now.Before(entry.expiresAt) {
		s.challenges.mu.Unlock()
		return nil, fmt.Errorf("%w: verification challenge expired or not found", domain.ErrNotFound)
	}

	if !entry.lastAttemptAt.IsZero() && now.Sub(entry.lastAttemptAt) < confirmCooldown {
		s.challenges.mu.Unlock()
		return nil, fmt.Errorf("%w: please wait before retrying verification", domain.ErrRateLimited)
	}

	entry.lastAttemptAt = now
	s.challenges.challenges[key] = entry
	challengeCode := entry.code
	s.challenges.mu.Unlock()

	if s.verifier == nil {
		return nil, fmt.Errorf("%w: profile verifier is not configured", domain.ErrSourceUnavailable)
	}

	profile, err := s.verifier.FetchFreshProfile(ctx, account.UID)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, fmt.Errorf("%w: empty profile received from game data source", domain.ErrNotFound)
	}

	if !strings.Contains(profile.Signature, challengeCode) && !strings.Contains(strings.ToUpper(profile.Signature), challengeCode) {
		return nil, fmt.Errorf("%w: verification code %s not found in player signature", domain.ErrConflict, challengeCode)
	}

	var nicknamePtr *string
	if profile.Nickname != "" {
		nicknamePtr = &profile.Nickname
	}
	var avatarPtr *string
	if profile.AvatarURL != "" {
		avatarPtr = &profile.AvatarURL
	}

	if err := s.accounts.VerifyOwnership(ctx, account.ID, account.UID, now, nicknamePtr, avatarPtr); err != nil {
		return nil, err
	}

	s.challenges.mu.Lock()
	delete(s.challenges.challenges, key)
	s.challenges.mu.Unlock()

	return s.accounts.GetByID(ctx, account.ID)
}

// UpdateSettings updates the public showcase visibility and discord visibility of a game account.
// Attempting to enable public showcase on an unverified account returns domain.ErrConflict.
func (s *Service) UpdateSettings(ctx context.Context, userID, accountID uuid.UUID, isPublicShowcase, showDiscord *bool) (*domain.GameAccount, error) {
	if userID == uuid.Nil || accountID == uuid.Nil {
		return nil, fmt.Errorf("%w: user and account ids are required", domain.ErrInvalidInput)
	}

	account, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return nil, err
	}
	if account.UserID != userID {
		return nil, fmt.Errorf("%w: you do not own this account", domain.ErrForbidden)
	}

	targetPublicShowcase := account.IsPublicShowcase
	if isPublicShowcase != nil {
		targetPublicShowcase = *isPublicShowcase
	}

	targetShowDiscord := account.ShowDiscord
	if showDiscord != nil {
		targetShowDiscord = *showDiscord
	}

	if targetPublicShowcase && !account.IsVerified() {
		return nil, fmt.Errorf("%w: cannot enable public showcase on an unverified account", domain.ErrConflict)
	}

	if err := s.accounts.UpdateSettings(ctx, accountID, targetPublicShowcase, targetShowDiscord); err != nil {
		return nil, err
	}

	return s.accounts.GetByID(ctx, accountID)
}

func generateChallengeCode() (string, error) {
	chars := make([]byte, challengeCodeLength)
	alphabetLen := big.NewInt(int64(len(challengeAlphabet)))
	for i := range chars {
		idx, err := rand.Int(rand.Reader, alphabetLen)
		if err != nil {
			return "", fmt.Errorf("failed to generate verification code: %w", err)
		}
		chars[i] = challengeAlphabet[idx.Int64()]
	}
	return challengeCodePrefix + string(chars), nil
}
