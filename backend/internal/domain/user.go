package domain

import (
	"time"

	"github.com/google/uuid"
)

// User is an authenticated user identified by their Discord identity.
type User struct {
	ID           uuid.UUID
	DiscordID    string
	Username     string
	AvatarURL    *string // nil when the Discord profile has no custom avatar
	TokenVersion int
	CreatedAt    time.Time
}

// Session is the authenticated session stored in an encrypted cookie.
// It carries the user ID, the active token version for immediate revocation,
// and the expiry timestamp.
type Session struct {
	UserID    uuid.UUID `json:"user_id"`
	Version   int       `json:"version"`
	ExpiresAt time.Time `json:"expires_at"`
}

// NewSession creates a session for the given user and token version valid for the provided TTL.
func NewSession(userID uuid.UUID, version int, ttl time.Duration) *Session {
	if version <= 0 {
		version = 1
	}
	return &Session{
		UserID:    userID,
		Version:   version,
		ExpiresAt: time.Now().Add(ttl).UTC(),
	}
}

// Valid reports whether the session is still active at the given moment.
// The session is considered expired once the current time reaches ExpiresAt.
func (s *Session) Valid(now time.Time) bool {
	return now.Before(s.ExpiresAt)
}
