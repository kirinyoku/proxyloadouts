// Package authsvc implements the Discord OAuth2 login use case and the
// stateless encrypted session lifecycle.
package authsvc

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

const (
	defaultSessionTTL = 7 * 24 * time.Hour
	stateSize         = 16
)

// DiscordClient abstracts the Discord OAuth and user profile provider.
type DiscordClient interface {
	AuthorizeURL(state string) string
	ExchangeCode(ctx context.Context, code string) (accessToken string, err error)
	FetchUser(ctx context.Context, accessToken string) (*domain.User, error)
}

// UserStore manages user persistence.
type UserStore interface {
	GetByDiscordID(ctx context.Context, discordID string) (*domain.User, error)
	Create(ctx context.Context, user *domain.User) error
	Update(ctx context.Context, user *domain.User) error
	IncrementTokenVersion(ctx context.Context, id uuid.UUID) error
}

// Options holds service configuration.
type Options struct {
	SessionSecret string
	SessionTTL    time.Duration
}

// Service implements authentication use cases.
type Service struct {
	users   UserStore
	discord DiscordClient
	opts    Options
	codec   *sessionCodec
}

// New creates the auth service.
//
// Discord client may be nil in development if unconfigured. The service still
// starts (health, showcase and static routes work), but login flows return
// an error until configured.
func New(users UserStore, discord DiscordClient, opts Options) (*Service, error) {
	if opts.SessionTTL <= 0 {
		opts.SessionTTL = defaultSessionTTL
	}

	codec, err := newSessionCodec(opts.SessionSecret)
	if err != nil {
		return nil, err
	}

	return &Service{
		users:   users,
		discord: discord,
		opts:    opts,
		codec:   codec,
	}, nil
}

// GenerateState returns a cryptographically random OAuth state parameter for
// CSRF protection of the login flow.
func (s *Service) GenerateState() (string, error) {
	buf := make([]byte, stateSize)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("failed to generate oauth state: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// LoginURL builds the Discord authorization redirect URL for the given state.
func (s *Service) LoginURL(state string) string {
	if s.discord == nil {
		return ""
	}
	return s.discord.AuthorizeURL(state)
}

// ExchangeCode swaps the OAuth authorization code for a Discord profile and
// creates or refreshes the local user.
func (s *Service) ExchangeCode(ctx context.Context, code string) (*domain.User, error) {
	if strings.TrimSpace(code) == "" {
		return nil, fmt.Errorf("%w: empty oauth code", domain.ErrInvalidInput)
	}
	if s.discord == nil {
		return nil, fmt.Errorf("%w: discord client not configured", domain.ErrSourceUnavailable)
	}

	token, err := s.discord.ExchangeCode(ctx, code)
	if err != nil {
		return nil, err
	}

	profile, err := s.discord.FetchUser(ctx, token)
	if err != nil {
		return nil, err
	}

	user, err := s.upsertUser(ctx, profile)
	if err != nil {
		return nil, err
	}
	return user, nil
}

// IssueSession creates a fresh session for the user with the specified token
// version and returns its encrypted cookie value together with the expiry timestamp.
func (s *Service) IssueSession(userID uuid.UUID, version int) (cookieValue string, expiresAt time.Time, err error) {
	session := domain.NewSession(userID, version, s.opts.SessionTTL)

	value, err := s.codec.encode(session)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("failed to encode session: %w", err)
	}
	return value, session.ExpiresAt, nil
}

// RevokeSession increments the user's token version in the store, immediately
// invalidating all previously issued session cookies for this user.
func (s *Service) RevokeSession(ctx context.Context, userID uuid.UUID) error {
	return s.users.IncrementTokenVersion(ctx, userID)
}

// VerifySession decrypts a cookie value and validates its expiry. Expired or
// forged cookies map to domain.ErrUnauthorized.
func (s *Service) VerifySession(cookieValue string) (*domain.Session, error) {
	session, err := s.codec.decode(cookieValue)
	if err != nil {
		return nil, err
	}
	if !session.Valid(time.Now()) {
		return nil, fmt.Errorf("%w: session expired", domain.ErrUnauthorized)
	}
	return session, nil
}

func (s *Service) upsertUser(ctx context.Context, profile *domain.User) (*domain.User, error) {
	existing, err := s.users.GetByDiscordID(ctx, profile.DiscordID)
	switch {
	case err == nil:
		if existing.IsBanned() {
			return nil, fmt.Errorf("%w: user %s is banned", domain.ErrUserBanned, existing.ID)
		}
		existing.Username = profile.Username
		existing.AvatarURL = profile.AvatarURL
		if updateErr := s.users.Update(ctx, existing); updateErr != nil {
			return nil, updateErr
		}
		return existing, nil
	case errors.Is(err, domain.ErrNotFound):
		user := &domain.User{
			DiscordID: profile.DiscordID,
			Username:  profile.Username,
			AvatarURL: profile.AvatarURL,
		}
		if createErr := s.users.Create(ctx, user); createErr != nil {
			return nil, createErr
		}
		return user, nil
	default:
		return nil, err
	}
}
