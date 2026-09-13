package authsvc

import (
	"encoding/base64"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

func TestNewSessionCodec_Validation(t *testing.T) {
	if _, err := newSessionCodec(""); err == nil {
		t.Error("expected error for empty secret")
	}

	codec, err := newSessionCodec("valid-session-secret-key-12345")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if codec == nil {
		t.Fatal("expected non-nil codec")
	}
}

func TestSessionCodec_EncodeDecode(t *testing.T) {
	codec, err := newSessionCodec("super-secret-key")
	if err != nil {
		t.Fatalf("failed to create codec: %v", err)
	}

	session := domain.NewSession(uuid.New(), 1, 24*time.Hour)
	encoded, err := codec.encode(session)
	if err != nil {
		t.Fatalf("failed to encode: %v", err)
	}
	if encoded == "" {
		t.Fatal("expected non-empty encoded session")
	}

	decoded, err := codec.decode(encoded)
	if err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if decoded.UserID != session.UserID {
		t.Errorf("expected user ID %s, got %s", session.UserID, decoded.UserID)
	}
	if decoded.Version != session.Version {
		t.Errorf("expected version %d, got %d", session.Version, decoded.Version)
	}
	if !decoded.ExpiresAt.Equal(session.ExpiresAt) {
		t.Errorf("expected expiresAt %v, got %v", session.ExpiresAt, decoded.ExpiresAt)
	}
}

func TestSessionCodec_TamperedCiphertext(t *testing.T) {
	codec, err := newSessionCodec("super-secret-key")
	if err != nil {
		t.Fatalf("failed to create codec: %v", err)
	}

	session := domain.NewSession(uuid.New(), 1, 24*time.Hour)
	encoded, err := codec.encode(session)
	if err != nil {
		t.Fatalf("failed to encode: %v", err)
	}

	raw, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		t.Fatalf("failed to decode base64: %v", err)
	}

	// Flip bit in the ciphertext (beyond nonce)
	raw[len(raw)-1] ^= 0x01
	tampered := base64.RawURLEncoding.EncodeToString(raw)

	_, err = codec.decode(tampered)
	if err == nil {
		t.Fatal("expected error for tampered ciphertext, got nil")
	}
	if !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected domain.ErrUnauthorized, got %v", err)
	}
}

func TestSessionCodec_TruncatedAndMalformed(t *testing.T) {
	codec, err := newSessionCodec("super-secret-key")
	if err != nil {
		t.Fatalf("failed to create codec: %v", err)
	}

	// Invalid base64
	if _, err := codec.decode("???not-valid-base64???"); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected domain.ErrUnauthorized for invalid base64, got %v", err)
	}

	// Truncated (less than GCM nonce size of 12 bytes)
	short := base64.RawURLEncoding.EncodeToString([]byte("short"))
	if _, err := codec.decode(short); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected domain.ErrUnauthorized for truncated cookie, got %v", err)
	}
}

func TestSessionCodec_KeyDerivationIsolation(t *testing.T) {
	codec1, err := newSessionCodec("secret-one")
	if err != nil {
		t.Fatalf("failed to create codec1: %v", err)
	}

	codec2, err := newSessionCodec("secret-two")
	if err != nil {
		t.Fatalf("failed to create codec2: %v", err)
	}

	session := domain.NewSession(uuid.New(), 1, 24*time.Hour)
	encoded, err := codec1.encode(session)
	if err != nil {
		t.Fatalf("failed to encode: %v", err)
	}

	// codec2 with different key must fail authentication
	if _, err := codec2.decode(encoded); !errors.Is(err, domain.ErrUnauthorized) {
		t.Errorf("expected codec2 to reject session from codec1 with ErrUnauthorized, got %v", err)
	}

	// codec1 duplicate instance with identical secret must succeed (deterministic HKDF)
	codec1Same, err := newSessionCodec("secret-one")
	if err != nil {
		t.Fatalf("failed to create duplicate codec1: %v", err)
	}
	if _, err := codec1Same.decode(encoded); err != nil {
		t.Errorf("expected codec with identical secret to decode, got %v", err)
	}
}
