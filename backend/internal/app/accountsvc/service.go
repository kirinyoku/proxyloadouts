// Package accountsvc implements the game account use cases: linking ZZZ
// accounts (UIDs) to a user, listing owned accounts, and deleting them with
// ownership validation.
package accountsvc

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// AccountStore persists and queries game accounts.
type AccountStore interface {
	Create(ctx context.Context, account *domain.GameAccount) error
	GetByID(ctx context.Context, id uuid.UUID) (*domain.GameAccount, error)
	GetByUserAndUID(ctx context.Context, userID uuid.UUID, uid string) (*domain.GameAccount, error)
	ListByUser(ctx context.Context, userID uuid.UUID) ([]*domain.GameAccount, error)
	CountByUser(ctx context.Context, userID uuid.UUID) (int, error)
	UpdateProfileMetadata(ctx context.Context, id uuid.UUID, nickname, avatarURL *string) error
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

// Service implements game account use cases.
type Service struct {
	accounts AccountStore
	users    UserStore
	scanner  ProfileScanner
}

// New creates a new game account service.
func New(accounts AccountStore, opts ...Option) *Service {
	s := &Service{accounts: accounts}
	for _, opt := range opts {
		opt(s)
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
