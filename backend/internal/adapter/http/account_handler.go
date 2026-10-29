package http

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/accountsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// AccountHandler implements game account CRUD.
type AccountHandler struct {
	accounts *accountsvc.Service
}

// NewAccountHandler creates the account handler.
func NewAccountHandler(accounts *accountsvc.Service) *AccountHandler {
	return &AccountHandler{accounts: accounts}
}

type accountResponse struct {
	ID               string  `json:"id"`
	UID              string  `json:"uid"`
	Region           string  `json:"region"`
	Nickname         *string `json:"nickname"`
	AvatarURL        *string `json:"avatar_url"`
	VerifiedAt       *string `json:"verified_at"`
	IsPublicRoster   bool    `json:"is_public_roster"`
	IsPublicTeams    bool    `json:"is_public_teams"`
	IsPublicShowcase bool    `json:"is_public_showcase"`
	ShowDiscord      bool    `json:"show_discord"`
	CreatedAt        string  `json:"created_at"`
}

func newAccountResponse(a *domain.GameAccount) accountResponse {
	var verifiedAt *string
	if a.VerifiedAt != nil {
		v := a.VerifiedAt.UTC().Format(time.RFC3339)
		verifiedAt = &v
	}
	return accountResponse{
		ID:               a.ID.String(),
		UID:              a.UID,
		Region:           a.Region,
		Nickname:         a.Nickname,
		AvatarURL:        a.AvatarURL,
		VerifiedAt:       verifiedAt,
		IsPublicRoster:   a.IsPublicRoster,
		IsPublicTeams:    a.IsPublicTeams,
		IsPublicShowcase: a.IsPublicShowcase(),
		ShowDiscord:      a.ShowDiscord,
		CreatedAt:        a.CreatedAt.UTC().Format(time.RFC3339),
	}
}

func newAccountListResponse(accounts []*domain.GameAccount) []accountResponse {
	out := make([]accountResponse, 0, len(accounts))
	for _, a := range accounts {
		out = append(out, newAccountResponse(a))
	}
	return out
}

type createAccountRequest struct {
	UID    string `json:"uid"`
	Region string `json:"region"`
}

type updateAccountRequest struct {
	IsPublicRoster   *bool `json:"is_public_roster"`
	IsPublicTeams    *bool `json:"is_public_teams"`
	IsPublicShowcase *bool `json:"is_public_showcase"`
	ShowDiscord      *bool `json:"show_discord"`
}

type verificationChallengeResponse struct {
	Code            string `json:"code"`
	ExpiresAt       string `json:"expires_at"`
	CooldownSeconds int    `json:"cooldown_seconds"`
}

// handleCreate links a ZZZ UID to the current user.
func (h *AccountHandler) handleCreate(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	var req createAccountRequest
	if err := decodeJSON(r, &req); err != nil {
		respondDomainError(w, r, err)
		return
	}

	account, err := h.accounts.Create(r.Context(), user.ID, req.UID, req.Region)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	respondJSON(w, http.StatusCreated, newAccountResponse(account))
}

// handleList returns all linked accounts of the current user.
func (h *AccountHandler) handleList(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	accounts, err := h.accounts.List(r.Context(), user.ID)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, newAccountListResponse(accounts))
}

// handleDelete unlinks an owned account and cascades to its builds and teams.
func (h *AccountHandler) handleDelete(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	accountID, err := uuid.Parse(chi.URLParam(r, "accountID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid account id")
		return
	}

	if err := h.accounts.Delete(r.Context(), user.ID, accountID); err != nil {
		respondDomainError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleUpdate updates privacy settings of an owned game account.
func (h *AccountHandler) handleUpdate(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	accountID, err := uuid.Parse(chi.URLParam(r, "accountID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid account id")
		return
	}

	var req updateAccountRequest
	if err := decodeJSON(r, &req); err != nil {
		respondDomainError(w, r, err)
		return
	}

	isPublicRoster := req.IsPublicRoster
	isPublicTeams := req.IsPublicTeams
	if req.IsPublicShowcase != nil && isPublicRoster == nil && isPublicTeams == nil {
		isPublicRoster = req.IsPublicShowcase
		isPublicTeams = req.IsPublicShowcase
	}

	account, err := h.accounts.UpdateSettings(r.Context(), user.ID, accountID, isPublicRoster, isPublicTeams, req.ShowDiscord)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, newAccountResponse(account))
}

// handleVerifyChallenge generates or returns an active verification challenge code.
func (h *AccountHandler) handleVerifyChallenge(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	accountID, err := uuid.Parse(chi.URLParam(r, "accountID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid account id")
		return
	}

	challenge, err := h.accounts.StartVerificationForAccount(r.Context(), user.ID, accountID)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, verificationChallengeResponse{
		Code:            challenge.Code,
		ExpiresAt:       challenge.ExpiresAt.UTC().Format(time.RFC3339),
		CooldownSeconds: challenge.CooldownSeconds,
	})
}

// handleVerifyConfirm validates the in-game signature and completes verification.
func (h *AccountHandler) handleVerifyConfirm(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	accountID, err := uuid.Parse(chi.URLParam(r, "accountID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid account id")
		return
	}

	account, err := h.accounts.ConfirmVerificationForAccount(r.Context(), user.ID, accountID)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, newAccountResponse(account))
}

type verificationByUIDRequest struct {
	UID    string `json:"uid"`
	Region string `json:"region"`
}

// handleVerifyChallengeByUID generates or returns an active challenge code by UID and region.
func (h *AccountHandler) handleVerifyChallengeByUID(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	var req verificationByUIDRequest
	if err := decodeJSON(r, &req); err != nil {
		respondDomainError(w, r, err)
		return
	}

	challenge, err := h.accounts.StartVerification(r.Context(), user.ID, req.UID, req.Region)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, verificationChallengeResponse{
		Code:            challenge.Code,
		ExpiresAt:       challenge.ExpiresAt.UTC().Format(time.RFC3339),
		CooldownSeconds: challenge.CooldownSeconds,
	})
}

// handleVerifyConfirmByUID validates the in-game signature and atomically claims the verified UID.
func (h *AccountHandler) handleVerifyConfirmByUID(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	var req verificationByUIDRequest
	if err := decodeJSON(r, &req); err != nil {
		respondDomainError(w, r, err)
		return
	}

	account, err := h.accounts.ConfirmVerification(r.Context(), user.ID, req.UID, req.Region)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, newAccountResponse(account))
}
