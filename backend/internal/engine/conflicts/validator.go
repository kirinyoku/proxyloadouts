// Package conflicts implements the Conflict Engine: validation of team
// composition against equipment uniqueness rules before a team can be saved
// or activated.
//
// All checks are pure functions over the candidate builds; the returned
// report is deterministic (stable ordering) so identical input always yields
// an identical API response.
package conflicts

import (
	"sort"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// Validate runs every uniqueness rule over the candidate team composition
// and returns a full conflict report. An empty or single-build composition
// is trivially valid; minimum team size is enforced by the service layer.
func Validate(builds []*domain.AgentBuild) domain.ConflictReport {
	report := domain.NewValidReport()

	report.Errors = append(report.Errors, checkAccounts(builds)...)
	report.Errors = append(report.Errors, checkDuplicateAgents(builds)...)
	report.Errors = append(report.Errors, checkWeaponReuse(builds)...)
	report.Errors = append(report.Errors, checkDiscReuse(builds)...)

	if len(report.Errors) > 0 {
		report.IsValid = false
	}
	return report
}

// checkAccounts enforces the single-account rule: all builds must belong to
// the same game account (SOW BR-07).
func checkAccounts(builds []*domain.AgentBuild) []domain.ConflictError {
	if len(builds) < 2 {
		return nil
	}

	reference := builds[0].GameAccountID
	conflicting := []string{builds[0].Name}
	for _, b := range builds[1:] {
		if b.GameAccountID != reference {
			conflicting = append(conflicting, b.Name)
		}
	}
	if len(conflicting) == 1 {
		return nil
	}

	return []domain.ConflictError{{
		Code:              domain.ConflictAccountMismatch,
		Message:           domain.ConflictAccountMismatchMessage,
		ConflictingBuilds: conflicting,
	}}
}

// checkDuplicateAgents enforces agent uniqueness: one agent cannot be picked
// twice in the same team (SOW BR-04).
func checkDuplicateAgents(builds []*domain.AgentBuild) []domain.ConflictError {
	type group struct {
		agentName string
		builds    []string
	}

	byAgent := make(map[int]*group)
	order := make([]int, 0, len(builds))
	for _, b := range builds {
		g, ok := byAgent[b.AgentID]
		if !ok {
			g = &group{agentName: b.AgentName}
			byAgent[b.AgentID] = g
			order = append(order, b.AgentID)
		}
		g.builds = append(g.builds, b.Name)
	}

	sort.Ints(order)

	var errs []domain.ConflictError
	for _, agentID := range order {
		g := byAgent[agentID]
		if len(g.builds) < 2 {
			continue
		}
		errs = append(errs, domain.ConflictError{
			Code:              domain.ConflictDuplicateAgent,
			Message:           domain.ConflictDuplicateAgentMessage(g.agentName),
			AgentID:           agentID,
			ConflictingBuilds: g.builds,
		})
	}
	return errs
}

// checkWeaponReuse enforces W-Engine uniqueness: one physical weapon cannot
// be equipped by two team members (SOW BR-05).
func checkWeaponReuse(builds []*domain.AgentBuild) []domain.ConflictError {
	byUID := make(map[string][]string)
	order := make([]string, 0, len(builds))

	for _, b := range builds {
		if !b.HasWeapon() {
			continue
		}
		uid := *b.WeaponUID
		if _, seen := byUID[uid]; !seen {
			order = append(order, uid)
		}
		byUID[uid] = append(byUID[uid], b.Name)
	}

	sort.Strings(order)

	var errs []domain.ConflictError
	for _, uid := range order {
		names := byUID[uid]
		if len(names) < 2 {
			continue
		}
		errs = append(errs, domain.ConflictError{
			Code:              domain.ConflictWeaponReuse,
			Message:           domain.ConflictWeaponReuseMessage,
			ItemType:          domain.ItemWEngine,
			ItemUID:           uid,
			ConflictingBuilds: names,
		})
	}
	return errs
}

// checkDiscReuse enforces Drive Disc uniqueness: one physical disc cannot be
// equipped by two team members (SOW BR-05).
func checkDiscReuse(builds []*domain.AgentBuild) []domain.ConflictError {
	byUID := make(map[string][]string)
	slotsByUID := make(map[string]int)
	order := make([]string, 0, len(builds)*6)

	for _, b := range builds {
		for _, uid := range b.DiscUIDs {
			if _, seen := byUID[uid]; !seen {
				order = append(order, uid)
			}
			byUID[uid] = append(byUID[uid], b.Name)
			if slotsByUID[uid] == 0 {
				slotsByUID[uid] = b.DiscSlot(uid)
			}
		}
	}

	sort.Strings(order)

	var errs []domain.ConflictError
	for _, uid := range order {
		names := byUID[uid]
		if len(names) < 2 {
			continue
		}
		slot := slotsByUID[uid]
		errs = append(errs, domain.ConflictError{
			Code:              domain.ConflictItemReuse,
			Message:           domain.ConflictDiscReuseSlotMessage(slot),
			ItemType:          domain.ItemDriveDisc,
			ItemUID:           uid,
			Slot:              slot,
			ConflictingBuilds: names,
		})
	}
	return errs
}
