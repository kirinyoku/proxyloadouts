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
	ID            string            `json:"id"`
	GameAccountID string            `json:"game_account_id"`
	AgentID       int               `json:"agent_id"`
	AgentName     string            `json:"agent_name"`
	Name          string            `json:"name"`
	Description   *string           `json:"description"`
	WeaponUID     *string           `json:"weapon_uid"`
	WeaponID      *int              `json:"weapon_id"`
	DiscUIDs      []string          `json:"disc_uids"`
	BuildData     json.RawMessage   `json:"build_data"`
	IsPublic      bool              `json:"is_public"`
	IsNotePublic  bool              `json:"is_note_public"`
	FaeRating     *domain.FaeRating `json:"fae_rating,omitempty"`
	CreatedAt     string            `json:"created_at"`
	UpdatedAt     string            `json:"updated_at"`
}

func newBuildResponse(b *domain.AgentBuild, audience noteAudience) buildResponse {
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
		Description:   audience.description(b.Description, b.IsNotePublic),
		WeaponUID:     b.WeaponUID,
		WeaponID:      b.WeaponID,
		DiscUIDs:      discUIDs,
		BuildData:     b.BuildData,
		IsPublic:      b.IsPublic,
		IsNotePublic:  b.IsNotePublic,
		FaeRating:     b.FaeRating,
		CreatedAt:     b.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:     b.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func newBuildListResponse(builds []*domain.AgentBuild, audience noteAudience) []buildResponse {
	out := make([]buildResponse, 0, len(builds))
	for _, b := range builds {
		out = append(out, newBuildResponse(b, audience))
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
	respondJSON(w, http.StatusCreated, newBuildResponse(build, ownerNotes))
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
	respondJSON(w, http.StatusOK, newBuildListResponse(builds, ownerNotes))
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
	respondJSON(w, http.StatusOK, newBuildResponse(build, ownerNotes))
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

	input := buildsvc.PatchInput{UserID: user.ID, BuildID: buildID}
	if value, ok := raw["name"]; ok {
		var name string
		if err := json.Unmarshal(value, &name); err != nil {
			respondError(w, http.StatusBadRequest, "invalid name")
			return
		}
		input.Name = &name
	}
	if value, ok := raw["description"]; ok {
		if err := json.Unmarshal(value, &input.Description); err != nil {
			respondError(w, http.StatusBadRequest, "invalid description")
			return
		}
		input.ClearDescription = input.Description == nil
	}
	if value, ok := raw["is_public"]; ok {
		var isPublic bool
		if err := json.Unmarshal(value, &isPublic); err != nil {
			respondError(w, http.StatusBadRequest, "invalid is_public")
			return
		}
		input.IsPublic = &isPublic
	}
	if value, ok := raw["is_note_public"]; ok {
		if err := json.Unmarshal(value, &input.IsNotePublic); err != nil || input.IsNotePublic == nil {
			respondError(w, http.StatusBadRequest, "invalid is_note_public")
			return
		}
	}
	if input.Name == nil && input.Description == nil && !input.ClearDescription && input.IsPublic == nil && input.IsNotePublic == nil {
		respondError(w, http.StatusBadRequest, "at least one of 'name', 'description', 'is_public', or 'is_note_public' must be provided")
		return
	}
	if _, err := h.builds.Patch(r.Context(), input); err != nil {
		respondDomainError(w, r, err)
		return
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
