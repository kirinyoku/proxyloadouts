package authsvc

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

const (
	sessionKeyInfo = "pl-session-key"
)

var (
	// sessionKeySalt provides domain separation for RFC 5869 key derivation.
	sessionKeySalt = []byte("pl-session-salt")
)

// sessionCodec encodes domain sessions into opaque, tamper-proof cookie
// values: AES-256-GCM (AEAD) keyed by HKDF-SHA256 of SESSION_SECRET. The cookie
// value leaks nothing but ciphertext and is authenticated, so any bit flip or
// forgery attempt fails decryption.
type sessionCodec struct {
	gcm cipher.AEAD
}

// newSessionCodec derives the 256-bit AES key from the secret using HKDF-SHA256
// (RFC 5869) with domain-separated info and salt, and initializes the codec.
func newSessionCodec(secret string) (*sessionCodec, error) {
	if secret == "" {
		return nil, errors.New("session secret must not be empty")
	}

	key, err := hkdf.Key(sha256.New, []byte(secret), sessionKeySalt, sessionKeyInfo, 32)
	if err != nil {
		return nil, fmt.Errorf("failed to derive session key: %w", err)
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("failed to create GCM: %w", err)
	}
	return &sessionCodec{gcm: gcm}, nil
}

// encode encrypts the session into a base64url cookie value.
func (c *sessionCodec) encode(session *domain.Session) (string, error) {
	plaintext, err := json.Marshal(session)
	if err != nil {
		return "", fmt.Errorf("failed to marshal session: %w", err)
	}

	nonce := make([]byte, c.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := c.gcm.Seal(nonce, nonce, plaintext, nil)
	return base64.RawURLEncoding.EncodeToString(ciphertext), nil
}

// decode decrypts and validates a cookie value back into a session. Any
// malformed, forged or corrupted value maps to domain.ErrUnauthorized.
func (c *sessionCodec) decode(value string) (*domain.Session, error) {
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return nil, fmt.Errorf("%w: malformed session cookie", domain.ErrUnauthorized)
	}
	if len(raw) < c.gcm.NonceSize() {
		return nil, fmt.Errorf("%w: malformed session cookie", domain.ErrUnauthorized)
	}

	nonce, ciphertext := raw[:c.gcm.NonceSize()], raw[c.gcm.NonceSize():]
	plaintext, err := c.gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid session cookie", domain.ErrUnauthorized)
	}

	var session domain.Session
	if err := json.Unmarshal(plaintext, &session); err != nil {
		return nil, fmt.Errorf("%w: corrupted session payload", domain.ErrUnauthorized)
	}
	return &session, nil
}
