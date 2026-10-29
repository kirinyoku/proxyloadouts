package http

import (
	"context"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/accountsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// ShowcaseHandler implements public showcase scan and verified public roster endpoints.
type ShowcaseHandler struct {
	scanner  *scannersvc.Service
	accounts *accountsvc.Service
	builds   *buildsvc.Service
	teams    *teamsvc.Service
}

// NewShowcaseHandler creates the showcase handler with its dependencies.
func NewShowcaseHandler(
	scanner *scannersvc.Service,
	accounts *accountsvc.Service,
	builds *buildsvc.Service,
	teams *teamsvc.Service,
) *ShowcaseHandler {
	return &ShowcaseHandler{
		scanner:  scanner,
		accounts: accounts,
		builds:   builds,
		teams:    teams,
	}
}

type showcaseHTTPResponse struct {
	*scannersvc.ShowcaseResponse
	VerifiedOwner   *publicOwnerInfoResponse `json:"verified_owner"`
	HasPublicRoster bool                     `json:"has_public_roster"`
}

type publicShowcaseRosterResponse struct {
	Owner            publicOwnerInfoResponse `json:"owner"`
	IsPublicRoster   bool                    `json:"is_public_roster"`
	IsPublicTeams    bool                    `json:"is_public_teams"`
	IsPublicShowcase bool                    `json:"is_public_showcase"`
	Builds           []buildResponse         `json:"builds"`
	Teams            []teamSummaryResponse   `json:"teams"`
}

// handle scans the showcase for the UID from the path. The endpoint is
// public: guests may look up showcases without an account (SOW §4).
// If the UID is claimed and verified by an active user, the response is enriched
// with verified_owner and has_public_roster, and owner profile metadata is refreshed.
func (h *ShowcaseHandler) handle(w http.ResponseWriter, r *http.Request) {
	if h.scanner == nil {
		respondError(w, http.StatusNotFound, "scanner service unavailable")
		return
	}

	uid := chi.URLParam(r, "uid")
	lang := extractLang(r)

	showcase, err := h.scanner.ScanByUID(r.Context(), uid, lang)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}

	resp := showcaseHTTPResponse{
		ShowcaseResponse: showcase,
	}

	if h.accounts != nil {
		account, owner, err := h.accounts.GetVerifiedByUID(r.Context(), uid)
		if err == nil && account != nil && owner != nil {
			resp.HasPublicRoster = account.IsPublicShowcase()
			if account.IsPublicShowcase() || (owner.DiscordUsername != nil && *owner.DiscordUsername != "") {
				ownerResp := newPublicOwnerInfoResponse(owner)
				resp.VerifiedOwner = &ownerResp
			}

			// Asynchronously synchronize nickname and avatar_url if upstream data has updates
			var nickPtr *string
			if showcase.Nickname != "" {
				nickPtr = &showcase.Nickname
			}
			var avatarPtr *string
			if showcase.AvatarURL != "" {
				avatarPtr = &showcase.AvatarURL
			}

			nickChanged := (nickPtr != nil && (account.Nickname == nil || *account.Nickname != *nickPtr))
			avatarChanged := (avatarPtr != nil && (account.AvatarURL == nil || *account.AvatarURL != *avatarPtr))
			if nickChanged || avatarChanged {
				if nickPtr == nil {
					nickPtr = account.Nickname
				}
				if avatarPtr == nil {
					avatarPtr = account.AvatarURL
				}
				bgCtx := context.WithoutCancel(r.Context())
				go func() {
					ctx, cancel := context.WithTimeout(bgCtx, 5*time.Second)
					defer cancel()
					_ = h.accounts.UpdateProfileMetadata(ctx, account.ID, nickPtr, avatarPtr)
				}()
			}
		}
	}

	respondJSON(w, http.StatusOK, resp)
}

// handleRoster retrieves publicly shared presets and squads for a verified UID.
// Reads only from SQLite and buildenrich cache in ~2-5 ms without upstream network calls.
func (h *ShowcaseHandler) handleRoster(w http.ResponseWriter, r *http.Request) {
	if h.accounts == nil || h.builds == nil || h.teams == nil {
		respondError(w, http.StatusNotFound, "roster service unavailable")
		return
	}

	uid := chi.URLParam(r, "uid")
	if err := domain.ValidateUID(uid); err != nil {
		respondDomainError(w, r, err)
		return
	}

	account, owner, err := h.accounts.GetVerifiedByUID(r.Context(), uid)
	if err != nil {
		respondDomainError(w, r, err)
		return
	}
	if account == nil || owner == nil {
		respondError(w, http.StatusNotFound, "verified owner not found")
		return
	}

	ownerResp := newPublicOwnerInfoResponse(owner)

	if !account.IsPublicRoster && !account.IsPublicTeams {
		respondJSON(w, http.StatusOK, publicShowcaseRosterResponse{
			Owner:            ownerResp,
			IsPublicRoster:   false,
			IsPublicTeams:    false,
			IsPublicShowcase: false,
			Builds:           []buildResponse{},
			Teams:            []teamSummaryResponse{},
		})
		return
	}

	lang := extractLang(r)

	var buildsList []*domain.AgentBuild
	if account.IsPublicRoster {
		var err error
		buildsList, err = h.builds.ListPublicByAccount(r.Context(), account.ID, lang)
		if err != nil {
			respondDomainError(w, r, err)
			return
		}
	}

	var teamsList []*teamsvc.TeamSummary
	if account.IsPublicTeams {
		var err error
		teamsList, err = h.teams.ListPublicByAccount(r.Context(), account.ID, lang)
		if err != nil {
			respondDomainError(w, r, err)
			return
		}
	}

	respondJSON(w, http.StatusOK, publicShowcaseRosterResponse{
		Owner:            ownerResp,
		IsPublicRoster:   account.IsPublicRoster,
		IsPublicTeams:    account.IsPublicTeams,
		IsPublicShowcase: account.IsPublicShowcase(),
		Builds:           newBuildListResponse(buildsList),
		Teams:            newTeamSummaryListResponse(teamsList),
	})
}
