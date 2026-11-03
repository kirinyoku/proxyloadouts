package domain

import (
	"context"
	"reflect"
	"time"
)

// FaeObservation records ratings actually read from ZFAE at ObservedAt.
type FaeObservation struct {
	ObservedAt time.Time          `json:"observed_at"`
	Agents     map[int]*FaeRating `json:"agents"`
}

// FaeRefreshOutcome distinguishes a local read from an attempted refresh.
type FaeRefreshOutcome string

const (
	FaeRefreshSaved    FaeRefreshOutcome = "saved"
	FaeRefreshMissing  FaeRefreshOutcome = "missing"
	FaeRefreshUpdated  FaeRefreshOutcome = "updated"
	FaeRefreshCooldown FaeRefreshOutcome = "cooldown"
	FaeRefreshBackoff  FaeRefreshOutcome = "backoff"
	FaeRefreshFailed   FaeRefreshOutcome = "failed"
	FaeRefreshCapacity FaeRefreshOutcome = "capacity"
)

// FaeRefreshAdmission carries the result and next eligible time of a reservation.
type FaeRefreshAdmission struct {
	Outcome     FaeRefreshOutcome
	AvailableAt time.Time
}

// FaeProfile keeps compact observations independently of attached build ratings.
type FaeProfile struct {
	UID                string            `json:"uid"`
	Current            *FaeObservation   `json:"current"`
	History            []FaeObservation  `json:"history,omitempty"`
	RefreshAvailableAt *time.Time        `json:"refresh_available_at"`
	Outcome            FaeRefreshOutcome `json:"refresh_outcome"`
}

// Ratings returns the current observed ratings, including an observed empty set.
func (p *FaeProfile) Ratings() map[int]*FaeRating {
	if p == nil || p.Current == nil {
		return map[int]*FaeRating{}
	}
	return p.Current.Agents
}

// MatchRating retains legacy approximate matching within one UID and agent only.
func (p *FaeProfile) MatchRating(agentID int, fingerprint string) *FaeRating {
	if p == nil || fingerprint == "" {
		return nil
	}
	observations := p.History
	if p.Current != nil {
		observations = append([]FaeObservation{*p.Current}, observations...)
	}
	for i, observation := range observations {
		r := observation.Agents[agentID]
		if r != nil && r.Rank != nil && r.EquipmentFingerprint != nil && *r.EquipmentFingerprint == fingerprint {
			match := r.Clone()
			match.Outdated = p.Current == nil || i > 0
			match.Status = FaeStatusSnapshot
			if match.Outdated {
				match.Status = FaeStatusSnapshotOutdated
			}
			return match
		}
	}
	return nil
}

// SameFaeRatings compares observation content without treating observation time as gear identity.
func SameFaeRatings(a, b *FaeObservation) bool {
	if a == nil || b == nil {
		return a == b
	}
	strip := func(o *FaeObservation) map[int]*FaeRating {
		ratings := make(map[int]*FaeRating, len(o.Agents))
		for id, r := range o.Agents {
			ratings[id] = r.Clone()
			if ratings[id] != nil {
				ratings[id].ObservedAt = nil
			}
		}
		return ratings
	}
	return reflect.DeepEqual(strip(a), strip(b))
}

// FaeReader cannot initiate upstream requests.
type FaeReader interface {
	ReadProfile(context.Context, string) (*FaeProfile, error)
}

// FaeLoader returns stored observations and may fetch upstream on a cache miss.
type FaeLoader interface {
	LoadProfile(context.Context, string) (*FaeProfile, error)
}

// FaeRefresher is the explicit network mutation capability.
type FaeRefresher interface {
	RefreshProfile(context.Context, string) (*FaeProfile, error)
}

// FaeStore persists admission and host deadlines alongside compact observations.
type FaeStore interface {
	FaeReader
	ReserveRefresh(context.Context, string, time.Time, time.Duration, int) (FaeRefreshAdmission, error)
	SaveObservation(context.Context, string, FaeObservation) error
	HostBackoff(context.Context) (time.Time, error)
	ExtendHostBackoff(context.Context, time.Time) error
}
