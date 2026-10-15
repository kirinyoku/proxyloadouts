package http

import (
	"crypto/subtle"
	"net/http"
	"net/url"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/accountsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/authsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// AuthHandler implements the Discord OAuth2 endpoints.
type AuthHandler struct {
	auth     *authsvc.Service
	users    domain.UserRepository
	accounts *accountsvc.Service
	opts     Options
}

// NewAuthHandler creates the auth handler.
func NewAuthHandler(auth *authsvc.Service, users domain.UserRepository, accounts *accountsvc.Service, opts Options) *AuthHandler {
	return &AuthHandler{auth: auth, users: users, accounts: accounts, opts: opts}
}

// handleLogin redirects the browser to Discord with a CSRF state cookie set.
func (h *AuthHandler) handleLogin(w http.ResponseWriter, r *http.Request) {
	state, err := h.auth.GenerateState()
	if err != nil {
		respondDomainError(w, r, err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    state,
		Path:     "/api/v1/auth",
		MaxAge:   int((10 * time.Minute).Seconds()),
		HttpOnly: true,
		Secure:   h.opts.SecureCookies,
		SameSite: http.SameSiteLaxMode,
	})

	http.Redirect(w, r, h.auth.LoginURL(state), http.StatusFound)
}

// handleCallback validates the OAuth state, exchanges the code for a Discord
// profile and establishes the encrypted session cookie.
func (h *AuthHandler) handleCallback(w http.ResponseWriter, r *http.Request) {
	// If Discord returned an error parameter (e.g. user canceled: access_denied)
	if errParam := r.URL.Query().Get("error"); errParam != "" {
		if _, err := r.Cookie(stateCookieName); err == nil {
			http.SetCookie(w, &http.Cookie{
				Name:     stateCookieName,
				Value:    "",
				Path:     "/api/v1/auth",
				MaxAge:   -1,
				HttpOnly: true,
				Secure:   h.opts.SecureCookies,
				SameSite: http.SameSiteLaxMode,
			})
		}
		target := h.opts.FrontendURL + "/login?error=" + url.QueryEscape(errParam)
		if errDesc := r.URL.Query().Get("error_description"); errDesc != "" {
			target += "&error_description=" + url.QueryEscape(errDesc)
		}
		http.Redirect(w, r, target, http.StatusFound)
		return
	}

	stateCookie, err := r.Cookie(stateCookieName)
	if err != nil || stateCookie.Value == "" {
		respondError(w, http.StatusBadRequest, "missing oauth state cookie")
		return
	}

	// Invalidate the single-use OAuth state cookie immediately to prevent replay attacks.
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    "",
		Path:     "/api/v1/auth",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.opts.SecureCookies,
		SameSite: http.SameSiteLaxMode,
	})

	queryState := r.URL.Query().Get("state")
	if subtle.ConstantTimeCompare([]byte(queryState), []byte(stateCookie.Value)) != 1 {
		respondError(w, http.StatusUnauthorized, "oauth state mismatch")
		return
	}

	code := r.URL.Query().Get("code")
	user, err := h.auth.ExchangeCode(r.Context(), code)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}

	value, expiresAt, err := h.auth.IssueSession(user.ID, user.TokenVersion)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}

	cookieName := sessionCookieName(h.opts.SecureCookies)
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    value,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		Secure:   h.opts.SecureCookies,
		SameSite: http.SameSiteLaxMode,
	})
	http.Redirect(w, r, h.opts.FrontendURL, http.StatusFound)
}

// handleMe returns the current user together with linked game accounts.
func (h *AuthHandler) handleMe(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	accounts, err := h.accounts.List(r.Context(), user.ID)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}

	respondJSON(w, http.StatusOK, meResponse{
		User:     newUserResponse(user),
		Accounts: newAccountListResponse(accounts),
	})
}

// handleLogout revokes active sessions for the current user and clears the session cookie.
func (h *AuthHandler) handleLogout(w http.ResponseWriter, r *http.Request) {
	cookieName := sessionCookieName(h.opts.SecureCookies)
	var userID uuid.UUID
	if user, ok := UserFromContext(r.Context()); ok {
		userID = user.ID
	} else if cookie, err := r.Cookie(cookieName); err == nil && cookie.Value != "" {
		if session, err := h.auth.VerifySession(cookie.Value); err == nil {
			userID = session.UserID
		}
	} else if h.opts.SecureCookies {
		if cookie, err := r.Cookie(defaultSessionCookieName); err == nil && cookie.Value != "" {
			if session, err := h.auth.VerifySession(cookie.Value); err == nil {
				userID = session.UserID
			}
		}
	}

	if userID != uuid.Nil {
		_ = h.auth.RevokeSession(r.Context(), userID)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.opts.SecureCookies,
		SameSite: http.SameSiteLaxMode,
	})
	if h.opts.SecureCookies {
		http.SetCookie(w, &http.Cookie{
			Name:     defaultSessionCookieName,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   h.opts.SecureCookies,
			SameSite: http.SameSiteLaxMode,
		})
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleDeleteMe permanently deletes the current user and all cascading records (accounts, builds, teams),
// and invalidates the session cookie.
func (h *AuthHandler) handleDeleteMe(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok || user == nil {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	if err := h.users.Delete(r.Context(), user.ID); err != nil {
		respondDomainError(w, r, err)
		return
	}

	cookieName := sessionCookieName(h.opts.SecureCookies)
	http.SetCookie(w, &http.Cookie{
		Name:     cookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.opts.SecureCookies,
		SameSite: http.SameSiteLaxMode,
	})
	if h.opts.SecureCookies {
		http.SetCookie(w, &http.Cookie{
			Name:     defaultSessionCookieName,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   h.opts.SecureCookies,
			SameSite: http.SameSiteLaxMode,
		})
	}
	w.WriteHeader(http.StatusNoContent)
}

type meResponse struct {
	User     userResponse      `json:"user"`
	Accounts []accountResponse `json:"accounts"`
}

type userResponse struct {
	ID        string  `json:"id"`
	DiscordID string  `json:"discord_id"`
	Username  string  `json:"username"`
	AvatarURL *string `json:"avatar_url"`
	CreatedAt string  `json:"created_at"`
}

func newUserResponse(u *domain.User) userResponse {
	return userResponse{
		ID:        u.ID.String(),
		DiscordID: u.DiscordID,
		Username:  u.Username,
		AvatarURL: u.AvatarURL,
		CreatedAt: u.CreatedAt.UTC().Format(time.RFC3339),
	}
}
