// Package buildsvc implements the saved-build use cases: extracting the
// equipment identity (weapon/disc UIDs) from a showcase agent payload and
// managing saved builds with ownership enforcement.
package buildsvc

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/kirinyoku/enkanetwork-go/client/zzz"

	"github.com/kirinyoku/proxyloadouts/backend/internal/app/buildenrich"
	"github.com/kirinyoku/proxyloadouts/backend/internal/app/scannersvc"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// ShowcaseValidator validates that an agent build matches the live/cached showcase
// for a specific UID before it can be persisted to that game account.
type ShowcaseValidator interface {
	ScanByUID(ctx context.Context, uid string, lang ...string) (*scannersvc.ShowcaseResponse, error)
	GetRawAvatar(ctx context.Context, uid string, agentID int) (*zzz.AvatarData, error)
}

// AgentLocalizer localizes a stored raw avatar payload into the enriched build
// projection returned to clients. production wiring passes a caching
// implementation; tests may pass a stub.
type AgentLocalizer = buildenrich.Localizer

// Service implements build use cases.
type Service struct {
	builds   domain.BuildRepository
	accounts domain.AccountRepository
	scanner  ShowcaseValidator
	enricher AgentLocalizer
	now      func() time.Time
}

// Option configures optional Service dependencies.
type Option func(*Service)

// WithScanner configures a ShowcaseValidator for verifying that saved builds
// correspond to real agents showcased on the account's UID.
func WithScanner(scanner ShowcaseValidator) Option {
	return func(s *Service) {
		s.scanner = scanner
	}
}

// WithEnricher configures the localizer for dynamic multi-language localization.
func WithEnricher(enricher AgentLocalizer) Option {
	return func(s *Service) {
		s.enricher = enricher
	}
}

// New creates the build service.
func New(builds domain.BuildRepository, accounts domain.AccountRepository, opts ...Option) *Service {
	svc := &Service{
		builds:   builds,
		accounts: accounts,
		now:      time.Now,
	}
	for _, opt := range opts {
		opt(svc)
	}
	return svc
}

// CreateInput describes a build to save from the showcase.
type CreateInput struct {
	UserID          uuid.UUID
	GameAccountID   uuid.UUID
	Name            string
	Description     *string
	RawAgentPayload json.RawMessage // full enriched fairy Agent JSON
	RawData         json.RawMessage // optional raw zzz.AvatarData JSON
}

// Create validates the input, extracts the equipment UIDs from the raw agent
// payload, verifies against showcase and agent build limit, and persists the build.
// An empty name falls back to an auto-generated one ("Build · 18 Jul 2026, 14:32").
func (s *Service) Create(ctx context.Context, input CreateInput) (*domain.AgentBuild, error) {
	if input.UserID == uuid.Nil {
		return nil, fmt.Errorf("%w: user is required", domain.ErrInvalidInput)
	}
	if input.GameAccountID == uuid.Nil {
		return nil, fmt.Errorf("%w: game account is required", domain.ErrInvalidInput)
	}

	account, err := s.accounts.GetByID(ctx, input.GameAccountID)
	if err != nil {
		return nil, err
	}
	if account.UserID != input.UserID {
		return nil, fmt.Errorf("%w: game account %s", domain.ErrForbidden, input.GameAccountID)
	}

	extracted, err := extractEquipment(input.RawAgentPayload)
	if err != nil {
		return nil, err
	}

	// Verify that the build being saved actually belongs to this game account's showcase.
	if s.scanner != nil {
		showcase, err := s.scanner.ScanByUID(ctx, account.UID)
		if err != nil {
			return nil, fmt.Errorf("failed to verify showcase for UID %s: %w", account.UID, err)
		}
		var found bool
		for _, agent := range showcase.Agents {
			if agent.ID == extracted.agentID {
				found = true
				if extracted.weaponUID != nil {
					if agent.WEngine == nil || agent.WEngine.UID != *extracted.weaponUID {
						return nil, fmt.Errorf("%w: weapon in build does not match current showcase of UID %s", domain.ErrInvalidInput, account.UID)
					}
				}
				if len(extracted.discUIDs) > 0 {
					showcaseDiscUIDs := make(map[string]bool, len(agent.DriveDiscs.Slots))
					for _, d := range agent.DriveDiscs.Slots {
						if d.UID != "" {
							showcaseDiscUIDs[d.UID] = true
						}
					}
					for _, uid := range extracted.discUIDs {
						if !showcaseDiscUIDs[uid] {
							return nil, fmt.Errorf("%w: drive disc %s in build does not match current showcase of UID %s", domain.ErrInvalidInput, uid, account.UID)
						}
					}
				}
				break
			}
		}
		if !found {
			return nil, fmt.Errorf("%w: agent %s (%d) does not exist in the showcase of UID %s", domain.ErrInvalidInput, extracted.agentName, extracted.agentID, account.UID)
		}
	}

	// Enforce max builds per agent per account.
	count, err := s.builds.CountByAccountAndAgent(ctx, input.GameAccountID, extracted.agentID)
	if err != nil {
		return nil, err
	}
	if count >= domain.MaxBuildsPerAgent {
		return nil, fmt.Errorf("%w: limit of %d builds reached for agent %s", domain.ErrConflict, domain.MaxBuildsPerAgent, extracted.agentName)
	}

	name := strings.TrimSpace(input.Name)
	if name == "" {
		name = "Build · " + s.now().Format("02 Jan 2006, 15:04")
	}
	if utf8.RuneCountInString(name) > domain.MaxBuildNameLength {
		return nil, fmt.Errorf("%w: build name must not exceed %d characters", domain.ErrInvalidInput, domain.MaxBuildNameLength)
	}

	var desc *string
	if input.Description != nil {
		trimmed := strings.TrimSpace(*input.Description)
		if trimmed != "" {
			if utf8.RuneCountInString(trimmed) > domain.MaxBuildDescriptionLength {
				return nil, fmt.Errorf("%w: build description must not exceed %d characters", domain.ErrInvalidInput, domain.MaxBuildDescriptionLength)
			}
			desc = &trimmed
		}
	}

	var rawData json.RawMessage
	if s.scanner != nil {
		rawAvatar, err := s.scanner.GetRawAvatar(ctx, account.UID, extracted.agentID)
		if err != nil {
			return nil, fmt.Errorf("failed to get raw avatar for UID %s: %w", account.UID, err)
		}
		if rawAvatar == nil {
			return nil, fmt.Errorf("%w: agent %s (%d) raw avatar data not found in showcase of UID %s", domain.ErrNotFound, extracted.agentName, extracted.agentID, account.UID)
		}
		rawBytes, err := json.Marshal(rawAvatar)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal raw avatar: %w", err)
		}
		rawData = rawBytes
	} else if len(input.RawData) > 0 {
		var rawAvatar zzz.AvatarData
		if err := json.Unmarshal(input.RawData, &rawAvatar); err != nil {
			return nil, fmt.Errorf("%w: invalid raw avatar data: %w", domain.ErrInvalidInput, err)
		}
		rawData = input.RawData
	}
	if len(rawData) == 0 {
		return nil, fmt.Errorf("%w: raw avatar data is required to save a build", domain.ErrInvalidInput)
	}

	build := &domain.AgentBuild{
		UserID:        input.UserID,
		GameAccountID: input.GameAccountID,
		AgentID:       extracted.agentID,
		AgentName:     extracted.agentName,
		Name:          name,
		Description:   desc,
		WeaponUID:     extracted.weaponUID,
		WeaponID:      extracted.weaponID,
		DiscUIDs:      extracted.discUIDs,
		DiscSlots:     extracted.discSlots,
		BuildData:     input.RawAgentPayload,
		RawData:       rawData,
	}
	if err := s.builds.Create(ctx, build); err != nil {
		return nil, err
	}
	return build, nil
}

// Get returns the build when it belongs to the user; foreign builds map to
// domain.ErrForbidden. When lang is supplied and raw_data is available, the
// build payload and agent name are dynamically localized.
func (s *Service) Get(ctx context.Context, userID, buildID uuid.UUID, lang ...string) (*domain.AgentBuild, error) {
	build, err := s.builds.GetByID(ctx, buildID)
	if err != nil {
		return nil, err
	}
	if build.UserID != userID {
		return nil, fmt.Errorf("%w: build %s", domain.ErrForbidden, buildID)
	}
	requestedLang := ""
	if len(lang) > 0 {
		requestedLang = lang[0]
	}
	s.enrichBuildWithLang(ctx, build, requestedLang)
	return build, nil
}

// ListByAccount returns all saved builds of an owned game account, dynamically
// localized when lang is specified.
func (s *Service) ListByAccount(ctx context.Context, userID, accountID uuid.UUID, lang ...string) ([]*domain.AgentBuild, error) {
	if err := s.ensureAccountOwnership(ctx, userID, accountID); err != nil {
		return nil, err
	}
	builds, err := s.builds.ListByAccount(ctx, accountID)
	if err != nil {
		return nil, err
	}
	requestedLang := ""
	if len(lang) > 0 {
		requestedLang = lang[0]
	}
	for _, b := range builds {
		s.enrichBuildWithLang(ctx, b, requestedLang)
	}
	return builds, nil
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

// UpdateDetails updates the name and description of an owned build.
func (s *Service) UpdateDetails(ctx context.Context, userID, buildID uuid.UUID, name string, description *string) error {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return fmt.Errorf("%w: build name must not be empty", domain.ErrInvalidInput)
	}
	if utf8.RuneCountInString(trimmedName) > domain.MaxBuildNameLength {
		return fmt.Errorf("%w: build name must not exceed %d characters", domain.ErrInvalidInput, domain.MaxBuildNameLength)
	}
	if _, err := s.Get(ctx, userID, buildID); err != nil {
		return err
	}

	var desc *string
	if description != nil {
		trimmedDesc := strings.TrimSpace(*description)
		if trimmedDesc != "" {
			if utf8.RuneCountInString(trimmedDesc) > domain.MaxBuildDescriptionLength {
				return fmt.Errorf("%w: build description must not exceed %d characters", domain.ErrInvalidInput, domain.MaxBuildDescriptionLength)
			}
			desc = &trimmedDesc
		}
	}
	return s.builds.UpdateDetails(ctx, buildID, trimmedName, desc)
}

// UpdateDescription updates the notes/description of an owned build,
// preserving the build's existing name.
func (s *Service) UpdateDescription(ctx context.Context, userID, buildID uuid.UUID, description *string) error {
	build, err := s.Get(ctx, userID, buildID)
	if err != nil {
		return err
	}
	return s.UpdateDetails(ctx, userID, buildID, build.Name, description)
}

// Rename updates the preset name of an owned build. The saved equipment
// payload stays immutable (SOW BR-02).
func (s *Service) Rename(ctx context.Context, userID, buildID uuid.UUID, name string) error {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return fmt.Errorf("%w: build name must not be empty", domain.ErrInvalidInput)
	}
	if utf8.RuneCountInString(trimmedName) > domain.MaxBuildNameLength {
		return fmt.Errorf("%w: build name must not exceed %d characters", domain.ErrInvalidInput, domain.MaxBuildNameLength)
	}
	if _, err := s.Get(ctx, userID, buildID); err != nil {
		return err
	}
	return s.builds.UpdateName(ctx, buildID, trimmedName)
}

// Delete removes an owned build. Deleting a build referenced by a team member
// fails with domain.ErrConflict (protection enforced at the database level).
func (s *Service) Delete(ctx context.Context, userID, buildID uuid.UUID) error {
	if _, err := s.Get(ctx, userID, buildID); err != nil {
		return err
	}
	return s.builds.Delete(ctx, buildID)
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

// extractedEquipment holds the identity fields parsed out of the raw payload.
type extractedEquipment struct {
	agentID   int
	agentName string
	weaponUID *string
	weaponID  *int
	discUIDs  []string
	discSlots map[string]int
}

// agentPayload mirrors only the fields needed for equipment extraction from
// the enriched fairy Agent JSON.
type agentPayload struct {
	ID         int             `json:"id"`
	Name       string          `json:"name"`
	WEngine    *wEnginePayload `json:"w_engine"`
	DriveDiscs struct {
		Slots []discPayload `json:"slots"`
	} `json:"drive_discs"`
}

type wEnginePayload struct {
	ID  int    `json:"id"`
	UID string `json:"uid"`
}

type discPayload struct {
	UID  string `json:"uid"`
	Slot int    `json:"slot"`
}

// extractEquipment parses the raw agent payload and pulls out the physical
// item identifiers used by the Conflict Engine.
func extractEquipment(raw json.RawMessage) (*extractedEquipment, error) {
	if len(raw) == 0 {
		return nil, fmt.Errorf("%w: agent payload is required", domain.ErrInvalidInput)
	}

	var payload agentPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, fmt.Errorf("%w: invalid agent payload: %w", domain.ErrInvalidInput, err)
	}
	if payload.ID == 0 {
		return nil, fmt.Errorf("%w: agent payload missing id", domain.ErrInvalidInput)
	}
	if utf8.RuneCountInString(payload.Name) > domain.MaxBuildNameLength {
		return nil, fmt.Errorf("%w: agent name must not exceed %d characters", domain.ErrInvalidInput, domain.MaxBuildNameLength)
	}

	extracted := &extractedEquipment{
		agentID:   payload.ID,
		agentName: payload.Name,
		discUIDs:  []string{},
		discSlots: make(map[string]int),
	}

	if payload.WEngine != nil && payload.WEngine.UID != "" {
		uid := payload.WEngine.UID
		id := payload.WEngine.ID
		extracted.weaponUID = &uid
		extracted.weaponID = &id
	}

	for _, disc := range payload.DriveDiscs.Slots {
		if disc.UID == "" {
			continue
		}
		extracted.discUIDs = append(extracted.discUIDs, disc.UID)
		if disc.Slot > 0 {
			extracted.discSlots[disc.UID] = disc.Slot
		}
	}

	return extracted, nil
}
