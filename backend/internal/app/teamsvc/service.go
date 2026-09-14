// Package teamsvc implements the team use cases: conflict-gated creation,
// roster details with full build data, listing with validity status, and
// deletion — all with ownership enforcement.
package teamsvc

import (
	"context"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildenrich"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
	"github.com/kirinyoku/proxyloadouts/backend/internal/engine/conflicts"
)

// AgentLocalizer localizes a stored raw avatar payload into the enriched build
// projection returned to clients. production wiring passes a caching
// implementation; tests may pass a stub.
type AgentLocalizer = buildenrich.Localizer

// Service implements team use cases.
type Service struct {
	teams    domain.TeamRepository
	builds   domain.BuildRepository
	accounts domain.AccountRepository
	enricher AgentLocalizer
}

// Option configures optional Service dependencies.
type Option func(*Service)

// WithEnricher configures the localizer for dynamic multi-language localization.
func WithEnricher(enricher AgentLocalizer) Option {
	return func(s *Service) {
		s.enricher = enricher
	}
}

// New creates the team service.
func New(teams domain.TeamRepository, builds domain.BuildRepository, accounts domain.AccountRepository, opts ...Option) *Service {
	svc := &Service{teams: teams, builds: builds, accounts: accounts}
	for _, opt := range opts {
		opt(svc)
	}
	return svc
}

// CreateInput describes a team to save.
type CreateInput struct {
	UserID        uuid.UUID
	GameAccountID uuid.UUID
	Name          string
	Description   *string
	BuildIDs      []uuid.UUID // order defines slot numbers (1..len)
}

// UpdateInput describes changes to an existing team.
type UpdateInput struct {
	TeamID        uuid.UUID
	UserID        uuid.UUID
	GameAccountID uuid.UUID
	Name          string
	Description   *string
	BuildIDs      []uuid.UUID // order defines slot numbers (1..len)
}

// ValidationError reports a team rejected by the Conflict Engine. The report
// is carried for the API response.
type ValidationError struct {
	Report domain.ConflictReport
}

// Error implements error.
func (e *ValidationError) Error() string {
	return fmt.Sprintf("team rejected by conflict engine (%d issues)", len(e.Report.Errors))
}

// TeamDetail is a team with its roster and fully loaded builds.
type TeamDetail struct {
	Team    *domain.Team
	Members []MemberDetail
}

// MemberDetail pairs one team slot with its referenced build.
type MemberDetail struct {
	Member domain.TeamMember
	Build  *domain.AgentBuild
}

// TeamSummary is a listed team with its current validity status and member builds.
type TeamSummary struct {
	Team    *domain.Team
	Report  domain.ConflictReport
	Members []MemberDetail
}

// Create loads and verifies every referenced build, runs the Conflict Engine,
// and persists the team with slots numbered by input order. Conflicting
// compositions fail with *ValidationError and leave no partial data.
func (s *Service) Create(ctx context.Context, input CreateInput) (*domain.Team, error) {
	name := strings.TrimSpace(input.Name)
	if utf8.RuneCountInString(name) > domain.MaxTeamNameLength {
		return nil, fmt.Errorf("%w: team name must not exceed %d characters", domain.ErrInvalidInput, domain.MaxTeamNameLength)
	}
	if input.Description != nil && utf8.RuneCountInString(*input.Description) > domain.MaxTeamDescriptionLength {
		return nil, fmt.Errorf("%w: team description must not exceed %d characters", domain.ErrInvalidInput, domain.MaxTeamDescriptionLength)
	}
	if err := s.ensureAccountOwnership(ctx, input.UserID, input.GameAccountID); err != nil {
		return nil, err
	}

	count, err := s.teams.CountByAccount(ctx, input.GameAccountID)
	if err != nil {
		return nil, err
	}
	if count >= domain.MaxTeamsPerAccount {
		return nil, fmt.Errorf("%w: limit of %d teams reached for this account", domain.ErrConflict, domain.MaxTeamsPerAccount)
	}

	buildsList, err := s.loadOwnedBuildsForAccount(ctx, input.UserID, input.GameAccountID, input.BuildIDs)
	if err != nil {
		return nil, err
	}

	if name == "" {
		names := make([]string, 0, len(buildsList))
		for _, b := range buildsList {
			if trimmed := strings.TrimSpace(b.AgentName); trimmed != "" {
				names = append(names, trimmed)
			}
		}
		name = strings.Join(names, "/")
	}
	if name == "" {
		return nil, fmt.Errorf("%w: team name must not be empty", domain.ErrInvalidInput)
	}
	runes := []rune(name)
	if len(runes) > domain.MaxTeamNameLength {
		name = string(runes[:domain.MaxTeamNameLength])
	}

	if report := conflicts.Validate(buildsList); !report.IsValid {
		return nil, &ValidationError{Report: report}
	}

	team := &domain.Team{
		UserID:        input.UserID,
		GameAccountID: input.GameAccountID,
		Name:          name,
		Description:   input.Description,
	}
	members := make([]domain.TeamMember, 0, len(buildsList))
	for i, build := range buildsList {
		members = append(members, domain.TeamMember{
			SlotNumber: i + 1,
			BuildID:    build.ID,
		})
	}

	if err := s.teams.Create(ctx, team, members); err != nil {
		return nil, err
	}
	return team, nil
}

// Update loads and verifies every referenced build, runs the Conflict Engine,
// and updates the team and slots in place.
func (s *Service) Update(ctx context.Context, input UpdateInput) (*domain.Team, error) {
	name := strings.TrimSpace(input.Name)
	if utf8.RuneCountInString(name) > domain.MaxTeamNameLength {
		return nil, fmt.Errorf("%w: team name must not exceed %d characters", domain.ErrInvalidInput, domain.MaxTeamNameLength)
	}
	if input.Description != nil && utf8.RuneCountInString(*input.Description) > domain.MaxTeamDescriptionLength {
		return nil, fmt.Errorf("%w: team description must not exceed %d characters", domain.ErrInvalidInput, domain.MaxTeamDescriptionLength)
	}

	team, err := s.ownedTeam(ctx, input.UserID, input.TeamID)
	if err != nil {
		return nil, err
	}

	targetAccountID := input.GameAccountID
	if targetAccountID == uuid.Nil {
		targetAccountID = team.GameAccountID
	}
	if err := s.ensureAccountOwnership(ctx, input.UserID, targetAccountID); err != nil {
		return nil, err
	}

	buildsList, err := s.loadOwnedBuildsForAccount(ctx, input.UserID, targetAccountID, input.BuildIDs)
	if err != nil {
		return nil, err
	}

	if name == "" {
		names := make([]string, 0, len(buildsList))
		for _, b := range buildsList {
			if trimmed := strings.TrimSpace(b.AgentName); trimmed != "" {
				names = append(names, trimmed)
			}
		}
		name = strings.Join(names, "/")
	}
	if name == "" {
		return nil, fmt.Errorf("%w: team name must not be empty", domain.ErrInvalidInput)
	}
	runes := []rune(name)
	if len(runes) > domain.MaxTeamNameLength {
		name = string(runes[:domain.MaxTeamNameLength])
	}

	if report := conflicts.Validate(buildsList); !report.IsValid {
		return nil, &ValidationError{Report: report}
	}

	team.Name = name
	team.Description = input.Description
	team.GameAccountID = targetAccountID

	members := make([]domain.TeamMember, 0, len(buildsList))
	for i, build := range buildsList {
		members = append(members, domain.TeamMember{
			SlotNumber: i + 1,
			BuildID:    build.ID,
		})
	}

	if err := s.teams.Update(ctx, team, members); err != nil {
		return nil, err
	}
	return team, nil
}

// Validate checks a candidate composition without saving anything; this backs
// the live POST /teams/validate endpoint. Foreign or missing builds map to
// ErrForbidden / ErrNotFound respectively.
func (s *Service) Validate(ctx context.Context, userID uuid.UUID, buildIDs []uuid.UUID) (domain.ConflictReport, error) {
	buildsList, err := s.loadOwnedBuilds(ctx, userID, buildIDs)
	if err != nil {
		return domain.ConflictReport{}, err
	}
	return conflicts.Validate(buildsList), nil
}

// Get returns the team with its roster and all build payloads, dynamically
// localized when lang is specified.
func (s *Service) Get(ctx context.Context, userID, teamID uuid.UUID, lang ...string) (*TeamDetail, error) {
	team, err := s.ownedTeam(ctx, userID, teamID)
	if err != nil {
		return nil, err
	}

	members, err := s.teams.GetMembers(ctx, teamID)
	if err != nil {
		return nil, err
	}

	requestedLang := ""
	if len(lang) > 0 {
		requestedLang = lang[0]
	}

	detail := &TeamDetail{Team: team, Members: make([]MemberDetail, 0, len(members))}
	for _, member := range members {
		build, err := s.builds.GetByID(ctx, member.BuildID)
		if err != nil {
			return nil, fmt.Errorf("failed to load build %s of team %s: %w", member.BuildID, teamID, err)
		}
		s.enrichBuildWithLang(ctx, build, requestedLang)
		detail.Members = append(detail.Members, MemberDetail{Member: member, Build: build})
	}
	return detail, nil
}

// List returns all teams of an owned game account with their validity reports,
// dynamically localized when lang is specified.
func (s *Service) List(ctx context.Context, userID, accountID uuid.UUID, lang ...string) ([]*TeamSummary, error) {
	if err := s.ensureAccountOwnership(ctx, userID, accountID); err != nil {
		return nil, err
	}

	teams, err := s.teams.ListByAccount(ctx, accountID)
	if err != nil {
		return nil, err
	}
	if len(teams) == 0 {
		return []*TeamSummary{}, nil
	}

	requestedLang := ""
	if len(lang) > 0 {
		requestedLang = lang[0]
	}

	teamIDs := make([]uuid.UUID, len(teams))
	for i, team := range teams {
		teamIDs[i] = team.ID
	}

	membersByTeam, err := s.teams.GetMembersByTeams(ctx, teamIDs)
	if err != nil {
		return nil, err
	}

	allBuilds, err := s.builds.ListByAccount(ctx, accountID)
	if err != nil {
		return nil, err
	}

	buildMap := make(map[uuid.UUID]*domain.AgentBuild, len(allBuilds))
	for _, b := range allBuilds {
		s.enrichBuildWithLang(ctx, b, requestedLang)
		buildMap[b.ID] = b
	}

	summaries := make([]*TeamSummary, 0, len(teams))
	for _, team := range teams {
		members := membersByTeam[team.ID]
		buildsList := make([]*domain.AgentBuild, 0, len(members))
		detailMembers := make([]MemberDetail, 0, len(members))
		for _, member := range members {
			build, ok := buildMap[member.BuildID]
			if !ok {
				var err error
				build, err = s.builds.GetByID(ctx, member.BuildID)
				if err != nil {
					return nil, fmt.Errorf("failed to load build %s of team %s: %w", member.BuildID, team.ID, err)
				}
				s.enrichBuildWithLang(ctx, build, requestedLang)
				buildMap[member.BuildID] = build
			}
			buildsList = append(buildsList, build)
			detailMembers = append(detailMembers, MemberDetail{Member: member, Build: build})
		}
		report := conflicts.Validate(buildsList)

		summaries = append(summaries, &TeamSummary{
			Team:    team,
			Report:  report,
			Members: detailMembers,
		})
	}
	return summaries, nil
}

// CountForAccount returns the number of teams on an owned game account.
//
// Callers that only need to know whether the per-account team limit has been
// reached should use this instead of List: the list response embeds every
// member's complete build payload, which for a full account means dozens of
// localized agent objects serialized and transferred just to read a number.
func (s *Service) CountForAccount(ctx context.Context, userID, accountID uuid.UUID) (int, error) {
	if err := s.ensureAccountOwnership(ctx, userID, accountID); err != nil {
		return 0, err
	}
	return s.teams.CountByAccount(ctx, accountID)
}

// enrichBuildWithLang rewrites the build's payload and agent name in place for
// the requested language. A localization failure is non-fatal: the build keeps
// whatever the repository returned.
func (s *Service) enrichBuildWithLang(ctx context.Context, b *domain.AgentBuild, lang string) {
	if b == nil || s.enricher == nil {
		return
	}
	localized, ok := s.enricher.Localize(ctx, b.RawData, scannersvc.NormalizeLanguage(lang))
	if !ok {
		return
	}
	b.BuildData = localized.Data
	b.AgentName = localized.AgentName
}

// Delete removes an owned team. Its members cascade; referenced builds stay.
func (s *Service) Delete(ctx context.Context, userID, teamID uuid.UUID) error {
	if _, err := s.ownedTeam(ctx, userID, teamID); err != nil {
		return err
	}
	return s.teams.Delete(ctx, teamID)
}

func (s *Service) ownedTeam(ctx context.Context, userID, teamID uuid.UUID) (*domain.Team, error) {
	team, err := s.teams.GetByID(ctx, teamID)
	if err != nil {
		return nil, err
	}
	if team.UserID != userID {
		return nil, fmt.Errorf("%w: team %s", domain.ErrForbidden, teamID)
	}
	return team, nil
}

func (s *Service) ensureAccountOwnership(ctx context.Context, userID, accountID uuid.UUID) error {
	if accountID == uuid.Nil {
		return fmt.Errorf("%w: game account is required", domain.ErrInvalidInput)
	}
	account, err := s.accounts.GetByID(ctx, accountID)
	if err != nil {
		return err
	}
	if account.UserID != userID {
		return fmt.Errorf("%w: game account %s", domain.ErrForbidden, accountID)
	}
	return nil
}

// loadOwnedBuildsForAccount additionally pins every build to the target account.
func (s *Service) loadOwnedBuildsForAccount(ctx context.Context, userID, accountID uuid.UUID, buildIDs []uuid.UUID) ([]*domain.AgentBuild, error) {
	if err := validateBuildCount(buildIDs); err != nil {
		return nil, err
	}

	buildsList, err := s.loadOwnedBuilds(ctx, userID, buildIDs)
	if err != nil {
		return nil, err
	}
	for _, build := range buildsList {
		if build.GameAccountID != accountID {
			return nil, fmt.Errorf("%w: build %s belongs to another game account",
				domain.ErrForbidden, build.ID)
		}
	}
	return buildsList, nil
}

func (s *Service) loadOwnedBuilds(ctx context.Context, userID uuid.UUID, buildIDs []uuid.UUID) ([]*domain.AgentBuild, error) {
	if err := validateBuildCount(buildIDs); err != nil {
		return nil, err
	}

	buildsList := make([]*domain.AgentBuild, 0, len(buildIDs))
	for _, id := range buildIDs {
		build, err := s.builds.GetByID(ctx, id)
		if err != nil {
			return nil, err
		}
		if build.UserID != userID {
			return nil, fmt.Errorf("%w: build %s", domain.ErrForbidden, id)
		}
		buildsList = append(buildsList, build)
	}
	return buildsList, nil
}

func validateBuildCount(buildIDs []uuid.UUID) error {
	if len(buildIDs) < domain.MinTeamSize || len(buildIDs) > domain.MaxTeamSize {
		return fmt.Errorf("%w: team requires %d-%d builds, got %d",
			domain.ErrInvalidInput, domain.MinTeamSize, domain.MaxTeamSize, len(buildIDs))
	}
	return nil
}
