package http

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// BuildHandler implements saved build CRUD.
type BuildHandler struct {
	builds *buildsvc.Service
}

// NewBuildHandler creates the build handler.
func NewBuildHandler(builds *buildsvc.Service) *BuildHandler {
	return &BuildHandler{builds: builds}
}

type buildResponse struct {
	ID            string          `json:"id"`
	GameAccountID string          `json:"game_account_id"`
	AgentID       int             `json:"agent_id"`
	AgentName     string          `json:"agent_name"`
	Name          string          `json:"name"`
	Description   *string         `json:"description"`
	WeaponUID     *string         `json:"weapon_uid"`
	WeaponID      *int            `json:"weapon_id"`
	DiscUIDs      []string        `json:"disc_uids"`
	BuildData     json.RawMessage `json:"build_data"`
	IsPublic      bool            `json:"is_public"`
	CreatedAt     string          `json:"created_at"`
	UpdatedAt     string          `json:"updated_at"`
}

func newBuildResponse(b *domain.AgentBuild) buildResponse {
	discUIDs := b.DiscUIDs
	if discUIDs == nil {
		discUIDs = []string{}
	}
	return buildResponse{
		ID:            b.ID.String(),
		GameAccountID: b.GameAccountID.String(),
		AgentID:       b.AgentID,
		AgentName:     b.AgentName,
		Name:          b.Name,
		Description:   b.Description,
		WeaponUID:     b.WeaponUID,
		WeaponID:      b.WeaponID,
		DiscUIDs:      discUIDs,
		BuildData:     b.BuildData,
		IsPublic:      b.IsPublic,
		CreatedAt:     b.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:     b.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func newBuildListResponse(builds []*domain.AgentBuild) []buildResponse {
	out := make([]buildResponse, 0, len(builds))
	for _, b := range builds {
		out = append(out, newBuildResponse(b))
	}
	return out
}

type createBuildRequest struct {
	GameAccountID   uuid.UUID       `json:"game_account_id"`
	Name            string          `json:"name"`
	Description     *string         `json:"description"`
	IsPublic        *bool           `json:"is_public,omitempty"`
	RawAgentPayload json.RawMessage `json:"raw_agent_payload"`
	RawData         json.RawMessage `json:"raw_data,omitempty"`
}

// handleCreate saves a build extracted from the showcase payload.
func (h *BuildHandler) handleCreate(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	var req createBuildRequest
	if err := decodeJSON(r, &req); err != nil {
		respondDomainError(w, r, err)
		return
	}

	build, err := h.builds.Create(r.Context(), buildsvc.CreateInput{
		UserID:          user.ID,
		GameAccountID:   req.GameAccountID,
		Name:            req.Name,
		Description:     req.Description,
		IsPublic:        req.IsPublic,
		RawAgentPayload: req.RawAgentPayload,
		RawData:         req.RawData,
	})
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	respondJSON(w, http.StatusCreated, newBuildResponse(build))
}

// handleList returns saved builds of an owned game account.
func (h *BuildHandler) handleList(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	accountID, err := uuid.Parse(r.URL.Query().Get("game_account_id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "game_account_id query parameter is required")
		return
	}

	lang := extractLang(r)
	builds, err := h.builds.ListByAccount(r.Context(), user.ID, accountID, lang)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, newBuildListResponse(builds))
}

// handleGet returns one owned build with the full equipment payload.
func (h *BuildHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	buildID, err := uuid.Parse(chi.URLParam(r, "buildID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid build id")
		return
	}

	lang := extractLang(r)
	build, err := h.builds.Get(r.Context(), user.ID, buildID, lang)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	respondJSON(w, http.StatusOK, newBuildResponse(build))
}

// handleUpdate renames, updates notes, or changes visibility on an owned build preset.
func (h *BuildHandler) handleUpdate(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	buildID, err := uuid.Parse(chi.URLParam(r, "buildID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid build id")
		return
	}

	var raw map[string]json.RawMessage
	if err := decodeJSON(r, &raw); err != nil {
		respondDomainError(w, r, err)
		return
	}

	nameRaw, hasName := raw["name"]
	descRaw, hasDesc := raw["description"]
	isPubRaw, hasIsPub := raw["is_public"]

	if !hasName && !hasDesc && !hasIsPub {
		respondError(w, http.StatusBadRequest, "at least one of 'name', 'description', or 'is_public' must be provided")
		return
	}

	var (
		name  string
		desc  *string
		isPub bool
	)

	if hasName {
		if err := json.Unmarshal(nameRaw, &name); err != nil {
			respondError(w, http.StatusBadRequest, "invalid name")
			return
		}
	}

	if hasDesc {
		if err := json.Unmarshal(descRaw, &desc); err != nil {
			respondError(w, http.StatusBadRequest, "invalid description")
			return
		}
	}

	if hasIsPub {
		if err := json.Unmarshal(isPubRaw, &isPub); err != nil {
			respondError(w, http.StatusBadRequest, "invalid is_public")
			return
		}
	}

	switch {
	case hasName && hasDesc:
		if err := h.builds.UpdateDetails(r.Context(), user.ID, buildID, name, desc); err != nil {
			respondDomainError(w, r, err)
			return
		}
	case hasName && !hasDesc:
		if err := h.builds.Rename(r.Context(), user.ID, buildID, name); err != nil {
			respondDomainError(w, r, err)
			return
		}
	case !hasName && hasDesc:
		if err := h.builds.UpdateDescription(r.Context(), user.ID, buildID, desc); err != nil {
			respondDomainError(w, r, err)
			return
		}
	}

	if hasIsPub {
		if err := h.builds.SetVisibility(r.Context(), user.ID, buildID, isPub); err != nil {
			respondDomainError(w, r, err)
			return
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// handleDelete removes an owned build; team-referenced builds get 409.
func (h *BuildHandler) handleDelete(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	buildID, err := uuid.Parse(chi.URLParam(r, "buildID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid build id")
		return
	}

	if err := h.builds.Delete(r.Context(), user.ID, buildID); err != nil {
		respondDomainError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
