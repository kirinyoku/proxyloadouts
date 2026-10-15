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
	ID        string `json:"id"`
	UID       string `json:"uid"`
	Region    string `json:"region"`
	CreatedAt string `json:"created_at"`
}

func newAccountResponse(a *domain.GameAccount) accountResponse {
	return accountResponse{
		ID:        a.ID.String(),
		UID:       a.UID,
		Region:    a.Region,
		CreatedAt: a.CreatedAt.UTC().Format(time.RFC3339),
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
