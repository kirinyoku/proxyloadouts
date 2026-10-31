package http

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/accountsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildsvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/teamsvc"
)

type shareDB interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

type shareTarget string

const (
	shareTargetBuild  shareTarget = "build"
	shareTargetRoster shareTarget = "roster"
	shareTargetTeam   shareTarget = "team"
	shareTargetSquads shareTarget = "squads"
)

type shareHandler struct {
	db       shareDB
	accounts *accountsvc.Service
	builds   *buildsvc.Service
	teams    *teamsvc.Service
}

func (h *shareHandler) create(w http.ResponseWriter, r *http.Request, target shareTarget) {
	if h.db == nil {
		respondError(w, http.StatusServiceUnavailable, "sharing unavailable")
		return
	}
	var param, query string
	switch target {
	case shareTargetBuild:
		param, query = "buildID", `INSERT INTO share_links (token_hash, build_id, kind) SELECT ?, id, 'default' FROM agent_builds WHERE id = ? AND user_id = ?`
	case shareTargetRoster:
		param, query = "accountID", `INSERT INTO share_links (token_hash, account_id, kind) SELECT ?, id, 'default' FROM game_accounts WHERE id = ? AND user_id = ?`
	case shareTargetTeam:
		param, query = "teamID", `INSERT INTO share_links (token_hash, team_id, kind) SELECT ?, id, 'default' FROM teams WHERE id = ? AND user_id = ?`
	case shareTargetSquads:
		param, query = "accountID", `INSERT INTO share_links (token_hash, account_id, kind) SELECT ?, id, 'squads' FROM game_accounts WHERE id = ? AND user_id = ?`
	default:
		respondError(w, http.StatusBadRequest, "invalid target")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, param))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var secret [32]byte
	if _, err := rand.Read(secret[:]); err != nil {
		respondError(w, http.StatusInternalServerError, "sharing unavailable")
		return
	}
	token := base64.RawURLEncoding.EncodeToString(secret[:])
	hash := sha256.Sum256([]byte(token))
	result, err := h.db.ExecContext(r.Context(), query, hash[:], id.String(), MustUserFromContext(r.Context()).ID.String())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "sharing unavailable")
		return
	}
	affected, err := result.RowsAffected()
	if err != nil || affected != 1 {
		respondError(w, http.StatusNotFound, "not found")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	respondJSON(w, http.StatusCreated, map[string]string{"token": token})
}

func (h *shareHandler) revoke(w http.ResponseWriter, r *http.Request, target shareTarget) {
	if h.db == nil {
		respondError(w, http.StatusServiceUnavailable, "sharing unavailable")
		return
	}
	var param, query string
	switch target {
	case shareTargetBuild:
		param, query = "buildID", `DELETE FROM share_links WHERE build_id IN (SELECT id FROM agent_builds WHERE id = ? AND user_id = ?)`
	case shareTargetRoster:
		param, query = "accountID", `DELETE FROM share_links WHERE kind = 'default' AND account_id IN (SELECT id FROM game_accounts WHERE id = ? AND user_id = ?)`
	case shareTargetTeam:
		param, query = "teamID", `DELETE FROM share_links WHERE team_id IN (SELECT id FROM teams WHERE id = ? AND user_id = ?)`
	case shareTargetSquads:
		param, query = "accountID", `DELETE FROM share_links WHERE kind = 'squads' AND account_id IN (SELECT id FROM game_accounts WHERE id = ? AND user_id = ?)`
	default:
		respondError(w, http.StatusBadRequest, "invalid target")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, param))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	if _, err := h.db.ExecContext(r.Context(), query, id.String(), MustUserFromContext(r.Context()).ID.String()); err != nil {
		respondError(w, http.StatusInternalServerError, "sharing unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *shareHandler) status(w http.ResponseWriter, r *http.Request, target shareTarget) {
	if h.db == nil {
		respondError(w, http.StatusServiceUnavailable, "sharing unavailable")
		return
	}
	var param, query string
	switch target {
	case shareTargetBuild:
		param, query = "buildID", `SELECT EXISTS(SELECT 1 FROM share_links WHERE build_id = b.id) FROM agent_builds b WHERE b.id = ? AND b.user_id = ?`
	case shareTargetRoster:
		param, query = "accountID", `SELECT EXISTS(SELECT 1 FROM share_links WHERE account_id = a.id AND kind = 'default') FROM game_accounts a WHERE a.id = ? AND a.user_id = ?`
	case shareTargetTeam:
		param, query = "teamID", `SELECT EXISTS(SELECT 1 FROM share_links WHERE team_id = t.id) FROM teams t WHERE t.id = ? AND t.user_id = ?`
	case shareTargetSquads:
		param, query = "accountID", `SELECT EXISTS(SELECT 1 FROM share_links WHERE account_id = a.id AND kind = 'squads') FROM game_accounts a WHERE a.id = ? AND a.user_id = ?`
	default:
		respondError(w, http.StatusBadRequest, "invalid target")
		return
	}
	id, err := uuid.Parse(chi.URLParam(r, param))
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid id")
		return
	}
	var active bool
	err = h.db.QueryRowContext(r.Context(), query, id.String(), MustUserFromContext(r.Context()).ID.String()).Scan(&active)
	if err == sql.ErrNoRows {
		respondError(w, http.StatusNotFound, "not found")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "sharing unavailable")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	respondJSON(w, http.StatusOK, map[string]bool{"active": active})
}

func (h *shareHandler) read(w http.ResponseWriter, r *http.Request, target shareTarget) {
	if h.db == nil || h.accounts == nil {
		respondError(w, http.StatusNotFound, "not found")
		return
	}
	token := chi.URLParam(r, "token")
	decoded, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil || len(decoded) != 32 {
		respondError(w, http.StatusNotFound, "not found")
		return
	}
	hash := sha256.Sum256([]byte(token))
	var query string
	switch target {
	case shareTargetBuild:
		if h.builds == nil {
			respondError(w, http.StatusNotFound, "not found")
			return
		}
		query = `SELECT b.id, b.user_id FROM share_links s JOIN agent_builds b ON b.id = s.build_id JOIN users u ON u.id = b.user_id WHERE s.token_hash = ? AND u.banned_at IS NULL`
	case shareTargetRoster:
		if h.builds == nil {
			respondError(w, http.StatusNotFound, "not found")
			return
		}
		query = `SELECT a.id, a.user_id FROM share_links s JOIN game_accounts a ON a.id = s.account_id JOIN users u ON u.id = a.user_id WHERE s.token_hash = ? AND s.kind = 'default' AND u.banned_at IS NULL`
	case shareTargetTeam:
		if h.teams == nil {
			respondError(w, http.StatusNotFound, "not found")
			return
		}
		query = `SELECT t.id, t.user_id FROM share_links s JOIN teams t ON t.id = s.team_id JOIN users u ON u.id = t.user_id WHERE s.token_hash = ? AND u.banned_at IS NULL`
	case shareTargetSquads:
		if h.teams == nil {
			respondError(w, http.StatusNotFound, "not found")
			return
		}
		query = `SELECT a.id, a.user_id FROM share_links s JOIN game_accounts a ON a.id = s.account_id JOIN users u ON u.id = a.user_id WHERE s.token_hash = ? AND s.kind = 'squads' AND u.banned_at IS NULL`
	default:
		respondError(w, http.StatusNotFound, "not found")
		return
	}

	var idString, userString string
	if err := h.db.QueryRowContext(r.Context(), query, hash[:]).Scan(&idString, &userString); err != nil {
		respondError(w, http.StatusNotFound, "not found")
		return
	}
	id, err := uuid.Parse(idString)
	if err != nil {
		respondError(w, http.StatusNotFound, "not found")
		return
	}
	userID, err := uuid.Parse(userString)
	if err != nil {
		respondError(w, http.StatusNotFound, "not found")
		return
	}
	w.Header().Set("Cache-Control", "no-store")

	switch target {
	case shareTargetBuild:
		item, err := h.builds.Get(r.Context(), userID, id, extractLang(r))
		if err != nil {
			respondDomainError(w, r, err)
			return
		}
		owner, err := h.accounts.GetPublicOwnerInfo(r.Context(), item.GameAccountID)
		if err != nil {
			respondDomainError(w, r, err)
			return
		}
		respondJSON(w, http.StatusOK, publicBuildResponse{Build: newBuildResponse(item), Owner: newPublicOwnerInfoResponse(owner)})
		return
	case shareTargetRoster:
		owner, err := h.accounts.GetPublicOwnerInfo(r.Context(), id)
		if err != nil {
			respondDomainError(w, r, err)
			return
		}
		builds, err := h.builds.ListPublicByAccount(r.Context(), id, extractLang(r))
		if err != nil {
			respondDomainError(w, r, err)
			return
		}
		respondJSON(w, http.StatusOK, publicShowcaseRosterResponse{
			Owner:            newPublicOwnerInfoResponse(owner),
			IsPublicRoster:   true,
			IsPublicShowcase: true,
			Builds:           newBuildListResponse(builds),
			Teams:            []teamSummaryResponse{},
		})
		return
	case shareTargetTeam:
		item, err := h.teams.GetSummary(r.Context(), userID, id, extractLang(r))
		if err != nil {
			respondDomainError(w, r, err)
			return
		}
		owner, err := h.accounts.GetPublicOwnerInfo(r.Context(), item.Team.GameAccountID)
		if err != nil {
			respondDomainError(w, r, err)
			return
		}
		members := make([]teamMemberResponse, 0, len(item.Members))
		for _, m := range item.Members {
			members = append(members, teamMemberResponse{
				SlotNumber: m.Member.SlotNumber,
				Build:      newBuildResponse(m.Build),
			})
		}
		respondJSON(w, http.StatusOK, publicTeamResponse{
			Team:    newTeamResponse(item.Team),
			Report:  item.Report,
			Members: members,
			Owner:   newPublicOwnerInfoResponse(owner),
		})
		return
	case shareTargetSquads:
		owner, err := h.accounts.GetPublicOwnerInfo(r.Context(), id)
		if err != nil {
			respondDomainError(w, r, err)
			return
		}
		teamsList, err := h.teams.ListPublicByAccount(r.Context(), id, extractLang(r))
		if err != nil {
			respondDomainError(w, r, err)
			return
		}
		respondJSON(w, http.StatusOK, publicShowcaseRosterResponse{
			Owner:            newPublicOwnerInfoResponse(owner),
			IsPublicRoster:   true,
			IsPublicTeams:    true,
			IsPublicShowcase: true,
			Builds:           []buildResponse{},
			Teams:            newTeamSummaryListResponse(teamsList),
		})
		return
	}
}
