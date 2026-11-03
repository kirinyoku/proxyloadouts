package domain

import (
	"testing"
	"time"
)

func TestFaeProfileMatchIsScopedToAgentAndCloned(t *testing.T) {
	fp := "same-approximate-fingerprint"
	rank := 12
	p := &FaeProfile{UID: "one", Current: &FaeObservation{Agents: map[int]*FaeRating{1011: {Rank: &rank, EquipmentFingerprint: &fp}}}}
	if got := p.MatchRating(1021, fp); got != nil {
		t.Errorf("cross-agent match = %+v, wantnil", got)
	}
	match := p.MatchRating(1011, fp)
	if match == nil {
		t.Fatal("expected local agent match")
	}
	*match.Rank = 99
	if *p.Ratings()[1011].Rank != 12 {
		t.Fatal("attached rating mutated the stored observation")
	}
	if match.ObservedAt != nil {
		t.Fatal("legacy match invented an observation date")
	}
}

func TestFaeProfileMatchPreservesHistoryProvenance(t *testing.T) {
	fp := "old-equipment"
	otherFP := "new-equipment"
	oldRank, currentRank := 20, 5
	now := time.Now().UTC()
	old := &FaeRating{Status: FaeStatusSnapshot, Rank: &oldRank, EquipmentFingerprint: &fp, ObservedAt: &now}
	p := &FaeProfile{UID: "one", Current: &FaeObservation{Agents: map[int]*FaeRating{1011: {Rank: &currentRank, EquipmentFingerprint: &otherFP}}}, History: []FaeObservation{{Agents: map[int]*FaeRating{1011: old}}}}
	match := p.MatchRating(1011, fp)
	if match == nil || match.Status != FaeStatusSnapshotOutdated || !match.Outdated || match.ObservedAt == nil || !match.ObservedAt.Equal(now) {
		t.Fatalf("MatchRating(history) = %+v, want dated outdated snapshot", match)
	}
	if old.Outdated || old.Status != FaeStatusSnapshot {
		t.Errorf("MatchRating mutated history = %+v", old)
	}
	p.Current.Agents[1011].EquipmentFingerprint = &fp
	match = p.MatchRating(1011, fp)
	if match == nil || match.Status != FaeStatusSnapshot || match.Outdated || *match.Rank != 5 {
		t.Errorf("MatchRating(current and history) = %+v, want current snapshot rank 5", match)
	}
	p.Current = nil
	match = p.MatchRating(1011, fp)
	if match == nil || !match.Outdated || match.Status != FaeStatusSnapshotOutdated {
		t.Errorf("MatchRating(history without current) = %+v, want outdated snapshot", match)
	}
}
