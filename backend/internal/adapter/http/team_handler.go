package http

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// TeamHandler implements team CRUD and live conflict validation.
type TeamHandler struct {
	teams *teamsvc.Service
}

// NewTeamHandler creates the team handler.
func NewTeamHandler(teams *teamsvc.Service) *TeamHandler {
	return &TeamHandler{teams: teams}
}

type teamResponse struct {
	ID            string  `json:"id"`
	GameAccountID string  `json:"game_account_id"`
	Name          string  `json:"name"`
	Description   *string `json:"description"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

func newTeamResponse(t *domain.Team) teamResponse {
	return teamResponse{
		ID:            t.ID.String(),
		GameAccountID: t.GameAccountID.String(),
		Name:          t.Name,
		Description:   t.Description,
		CreatedAt:     t.CreatedAt.UTC().Format(time.RFC3339),
		UpdatedAt:     t.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

type teamDetailResponse struct {
	Team    teamResponse         `json:"team"`
	Members []teamMemberResponse `json:"members"`
}

type teamMemberResponse struct {
	SlotNumber int           `json:"slot_number"`
	Build      buildResponse `json:"build"`
}

type teamSummaryResponse struct {
	Team    teamResponse          `json:"team"`
	Report  domain.ConflictReport `json:"report"`
	Members []teamMemberResponse  `json:"members"`
}

// parseBuildIDsQuery reads the comma-separated build_ids query parameter.
//
// Validation is a pure read, so it is exposed as GET rather than POST: a
// cacheable verb lets the browser and any intermediary reuse the report for a
// composition that was already checked, instead of re-running the Conflict
// Engine on every visit to the same slot arrangement.
func parseBuildIDsQuery(r *http.Request) ([]uuid.UUID, error) {
	raw := strings.TrimSpace(r.URL.Query().Get("build_ids"))
	if raw == "" {
		return nil, fmt.Errorf("%w: build_ids query parameter is required", domain.ErrInvalidInput)
	}

	parts := strings.Split(raw, ",")
	ids := make([]uuid.UUID, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			return nil, fmt.Errorf("%w: build_ids contains an empty entry", domain.ErrInvalidInput)
		}
		id, err := uuid.Parse(trimmed)
		if err != nil {
			return nil, fmt.Errorf("%w: build_ids entry %q is not a uuid", domain.ErrInvalidInput, trimmed)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// handleValidate checks a candidate composition without saving.
func (h *TeamHandler) handleValidate(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	buildIDs, err := parseBuildIDsQuery(r)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	report, err := h.teams.Validate(r.Context(), user.ID, buildIDs)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	// The report is a deterministic function of the referenced builds, so it is
	// safe to let the browser reuse it briefly. `private` keeps it out of shared
	// caches, and Vary: Cookie keeps a shared cache from serving one session's
	// report to another for the same URL (the build IDs alone do not identify
	// the caller — ownership is enforced from the session).
	w.Header().Set("Cache-Control", "private, max-age=60")
	w.Header().Add("Vary", "Cookie")
	respondJSON(w, http.StatusOK, report)
}

type createTeamRequest struct {
	GameAccountID uuid.UUID   `json:"game_account_id"`
	Name          string      `json:"name"`
	Description   *string     `json:"description"`
	BuildIDs      []uuid.UUID `json:"build_ids"`
}

// handleCreate saves a conflict-free team.
func (h *TeamHandler) handleCreate(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	var req createTeamRequest
	if err := decodeJSON(r, &req); err != nil {
		respondDomainError(w, err)
		return
	}

	team, err := h.teams.Create(r.Context(), teamsvc.CreateInput{
		UserID:        user.ID,
		GameAccountID: req.GameAccountID,
		Name:          req.Name,
		Description:   req.Description,
		BuildIDs:      req.BuildIDs,
	})
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusCreated, newTeamResponse(team))
}

type updateTeamRequest struct {
	GameAccountID uuid.UUID   `json:"game_account_id"`
	Name          string      `json:"name"`
	Description   *string     `json:"description"`
	BuildIDs      []uuid.UUID `json:"build_ids"`
}

// handleUpdate updates an existing team and its member slots.
func (h *TeamHandler) handleUpdate(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	teamID, err := uuid.Parse(chi.URLParam(r, "teamID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid team id")
		return
	}

	var req updateTeamRequest
	if err := decodeJSON(r, &req); err != nil {
		respondDomainError(w, err)
		return
	}

	team, err := h.teams.Update(r.Context(), teamsvc.UpdateInput{
		TeamID:        teamID,
		UserID:        user.ID,
		GameAccountID: req.GameAccountID,
		Name:          req.Name,
		Description:   req.Description,
		BuildIDs:      req.BuildIDs,
	})
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, newTeamResponse(team))
}

// handleList returns teams of an owned account with validity reports.
func (h *TeamHandler) handleList(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	accountID, err := uuid.Parse(r.URL.Query().Get("game_account_id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "game_account_id query parameter is required")
		return
	}

	lang := extractLang(r)
	summaries, err := h.teams.List(r.Context(), user.ID, accountID, lang)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	out := make([]teamSummaryResponse, 0, len(summaries))
	for _, s := range summaries {
		members := make([]teamMemberResponse, 0, len(s.Members))
		for _, m := range s.Members {
			members = append(members, teamMemberResponse{
				SlotNumber: m.Member.SlotNumber,
				Build:      newBuildResponse(m.Build),
			})
		}
		out = append(out, teamSummaryResponse{
			Team:    newTeamResponse(s.Team),
			Report:  s.Report,
			Members: members,
		})
	}
	respondJSON(w, http.StatusOK, out)
}

// teamCountResponse reports how many teams exist on a game account.
type teamCountResponse struct {
	Count int `json:"count"`
}

// handleCount returns the number of teams on an owned account without
// serializing the teams themselves.
func (h *TeamHandler) handleCount(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	accountID, err := uuid.Parse(r.URL.Query().Get("game_account_id"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "game_account_id query parameter is required")
		return
	}

	count, err := h.teams.CountForAccount(r.Context(), user.ID, accountID)
	if err != nil {
		respondDomainError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, teamCountResponse{Count: count})
}

// handleGet returns the team roster with full build payloads.
func (h *TeamHandler) handleGet(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	teamID, err := uuid.Parse(chi.URLParam(r, "teamID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid team id")
		return
	}

	lang := extractLang(r)
	detail, err := h.teams.Get(r.Context(), user.ID, teamID, lang)
	if err != nil {
		respondDomainError(w, err)
		return
	}

	members := make([]teamMemberResponse, 0, len(detail.Members))
	for _, m := range detail.Members {
		members = append(members, teamMemberResponse{
			SlotNumber: m.Member.SlotNumber,
			Build:      newBuildResponse(m.Build),
		})
	}
	respondJSON(w, http.StatusOK, teamDetailResponse{Team: newTeamResponse(detail.Team), Members: members})
}

// handleDelete removes an owned team.
func (h *TeamHandler) handleDelete(w http.ResponseWriter, r *http.Request) {
	user := MustUserFromContext(r.Context())

	teamID, err := uuid.Parse(chi.URLParam(r, "teamID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid team id")
		return
	}

	if err := h.teams.Delete(r.Context(), user.ID, teamID); err != nil {
		respondDomainError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
