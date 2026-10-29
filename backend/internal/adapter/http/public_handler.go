package http

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// PublicHandler handles unauthenticated requests for shared builds and teams.
type PublicHandler struct {
	builds *buildsvc.Service
	teams  *teamsvc.Service
}

// NewPublicHandler creates a new public handler.
func NewPublicHandler(builds *buildsvc.Service, teams *teamsvc.Service) *PublicHandler {
	return &PublicHandler{
		builds: builds,
		teams:  teams,
	}
}

type publicOwnerInfoResponse struct {
	UID              string  `json:"uid"`
	Region           string  `json:"region"`
	Nickname         *string `json:"nickname"`
	AvatarURL        *string `json:"avatar_url"`
	DiscordUsername  *string `json:"discord_username,omitempty"`
	DiscordAvatarURL *string `json:"discord_avatar_url,omitempty"`
}

func newPublicOwnerInfoResponse(o *domain.PublicOwnerInfo) publicOwnerInfoResponse {
	if o == nil {
		return publicOwnerInfoResponse{}
	}
	return publicOwnerInfoResponse{
		UID:              o.UID,
		Region:           o.Region,
		Nickname:         o.Nickname,
		AvatarURL:        o.AvatarURL,
		DiscordUsername:  o.DiscordUsername,
		DiscordAvatarURL: o.DiscordAvatarURL,
	}
}

type publicBuildResponse struct {
	Build buildResponse           `json:"build"`
	Owner publicOwnerInfoResponse `json:"owner"`
}

type publicTeamResponse struct {
	Team    teamResponse            `json:"team"`
	Report  domain.ConflictReport   `json:"report"`
	Members []teamMemberResponse    `json:"members"`
	Owner   publicOwnerInfoResponse `json:"owner"`
}

// handleGetBuild retrieves a single publicly shared agent build with owner metadata.
func (h *PublicHandler) handleGetBuild(w http.ResponseWriter, r *http.Request) {
	if h.builds == nil {
		respondError(w, http.StatusNotFound, "builds service unavailable")
		return
	}

	buildID, err := uuid.Parse(chi.URLParam(r, "buildID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid build id")
		return
	}

	lang := extractLang(r)
	detail, err := h.builds.GetPublic(r.Context(), buildID, lang)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}

	respondJSON(w, http.StatusOK, publicBuildResponse{
		Build: newBuildResponse(detail.Build),
		Owner: newPublicOwnerInfoResponse(detail.Owner),
	})
}

// handleGetTeam retrieves a single publicly shared team preset with member details and owner metadata.
func (h *PublicHandler) handleGetTeam(w http.ResponseWriter, r *http.Request) {
	if h.teams == nil {
		respondError(w, http.StatusNotFound, "teams service unavailable")
		return
	}

	teamID, err := uuid.Parse(chi.URLParam(r, "teamID"))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid team id")
		return
	}

	lang := extractLang(r)
	detail, err := h.teams.GetPublic(r.Context(), teamID, lang)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}

	members := make([]teamMemberResponse, 0, len(detail.Members))
	for _, m := range detail.Members {
		members = append(members, teamMemberResponse{
			SlotNumber: m.Member.SlotNumber,
			Build:      newBuildResponse(m.Build),
		})
	}

	respondJSON(w, http.StatusOK, publicTeamResponse{
		Team:    newTeamResponse(detail.Team),
		Report:  detail.Report,
		Members: members,
		Owner:   newPublicOwnerInfoResponse(detail.Owner),
	})
}
