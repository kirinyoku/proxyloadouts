package buildsvc

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/sqlite"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

type interleavedFaeReader func(context.Context, string) (*domain.FaeProfile, error)

func (f interleavedFaeReader) ReadProfile(ctx context.Context, uid string) (*domain.FaeProfile, error) {
	return f(ctx, uid)
}

func TestReconcileFirstAttachmentWinsOverlappingReads(t *testing.T) {
	ctx := context.Background()
	env := newFixture(t)
	raw, fp := sampleFullRawAvatar(1511)
	blob, err := json.Marshal(raw)
	if err != nil {
		t.Fatal(err)
	}
	build, err := env.svc.Create(ctx, CreateInput{UserID: env.ownerID, GameAccountID: env.accountID, Name: "Initially unrated", RawAgentPayload: fairyAgentJSON(t, 1511, "Agent", true), RawData: blob})
	if err != nil {
		t.Fatal(err)
	}
	store := sqlite.NewFaeStore(openTestDB(t))
	now := time.Now().UTC()
	if _, err := store.ReserveRefresh(ctx, "1504687050", now, time.Minute, 1000); err != nil {
		t.Fatal(err)
	}
	rank := 5
	if err := store.SaveObservation(ctx, "1504687050", domain.FaeObservation{ObservedAt: now, Agents: map[int]*domain.FaeRating{1511: {Rank: &rank, EquipmentFingerprint: &fp}}}); err != nil {
		t.Fatal(err)
	}
	calls := 0
	env.svc.WithFaeReader(interleavedFaeReader(func(ctx context.Context, uid string) (*domain.FaeProfile, error) {
		calls++
		if calls == 1 {
			inner, err := env.svc.GetByID(ctx, build.ID)
			if err != nil {
				return nil, err
			}
			if inner.FaeRating == nil || *inner.FaeRating.Rank != 5 {
				t.Errorf("inner GetByID = %+v, want first rank 5", inner.FaeRating)
			}
			rank := 8
			if err := store.SaveObservation(ctx, uid, domain.FaeObservation{ObservedAt: now.Add(time.Second), Agents: map[int]*domain.FaeRating{1511: {Rank: &rank, EquipmentFingerprint: &fp}}}); err != nil {
				return nil, err
			}
		}
		return store.ReadProfile(ctx, uid)
	}))
	outer, err := env.svc.GetByID(ctx, build.ID)
	if err != nil {
		t.Fatal(err)
	}
	persisted, err := env.builds.GetByID(ctx, build.ID)
	if err != nil {
		t.Fatal(err)
	}
	for name, got := range map[string]*domain.AgentBuild{"outer response": outer, "persisted build": persisted} {
		if got.FaeRating == nil || got.FaeRating.Rank == nil || *got.FaeRating.Rank != 5 || got.UpdatedAt.UnixMilli() != build.UpdatedAt.UnixMilli() {
			t.Errorf("%s = rating %+v updated_at %v, want first rank 5 and original updated_at %v", name, got.FaeRating, got.UpdatedAt, build.UpdatedAt)
		}
	}
}

func TestHistoricalFaeMatchKeepsProvenanceOnSaveAndRead(t *testing.T) {
	for _, attachOnSave := range []bool{true, false} {
		t.Run(map[bool]string{true: "save", false: "read"}[attachOnSave], func(t *testing.T) {
			ctx := context.Background()
			env := newFixture(t)
			store := sqlite.NewFaeStore(openTestDB(t))
			raw, fp := sampleFullRawAvatar(1511)
			blob, err := json.Marshal(raw)
			if err != nil {
				t.Fatal(err)
			}
			now := time.Now().UTC()
			if _, err := store.ReserveRefresh(ctx, "1504687050", now, time.Minute, 1000); err != nil {
				t.Fatal(err)
			}
			rank := 20
			slug := "nangong-yu"
			if err := store.SaveObservation(ctx, "1504687050", domain.FaeObservation{ObservedAt: now, Agents: map[int]*domain.FaeRating{1511: {Rank: &rank, Slug: &slug, EquipmentFingerprint: &fp, ObservedAt: &now}}}); err != nil {
				t.Fatal(err)
			}
			otherFP := fp + "-changed"
			if err := store.SaveObservation(ctx, "1504687050", domain.FaeObservation{ObservedAt: now.Add(time.Second), Agents: map[int]*domain.FaeRating{1511: {Rank: &rank, EquipmentFingerprint: &otherFP}}}); err != nil {
				t.Fatal(err)
			}
			if attachOnSave {
				env.svc.WithFaeReader(store)
			}
			build, err := env.svc.Create(ctx, CreateInput{UserID: env.ownerID, GameAccountID: env.accountID, Name: "Historical equipment", RawAgentPayload: fairyAgentJSON(t, 1511, "Agent", true), RawData: blob})
			if err != nil {
				t.Fatal(err)
			}
			env.svc.WithFaeReader(store)
			got, err := env.svc.GetByID(ctx, build.ID)
			if err != nil {
				t.Fatal(err)
			}
			persisted, err := env.builds.GetByID(ctx, build.ID)
			if err != nil {
				t.Fatal(err)
			}
			public, err := env.svc.GetPublic(ctx, build.ID)
			if err != nil {
				t.Fatal(err)
			}
			for name, b := range map[string]*domain.AgentBuild{"read": got, "persisted": persisted, "public": public.Build} {
				r := b.FaeRating
				if r == nil || r.Status != domain.FaeStatusSnapshotOutdated || !r.Outdated || r.Rank == nil || *r.Rank != 20 || r.ObservedAt == nil || !r.ObservedAt.Equal(now) {
					t.Errorf("%s historical rating = %+v, want outdated snapshot rank 20 observed %v", name, r, now)
				}
			}
			if attachOnSave && (build.FaeRating == nil || !build.FaeRating.Outdated) {
				t.Errorf("Create(history) = %+v, want outdated attachment", build.FaeRating)
			}
		})
	}
}

func TestAttachedFaeRatingPresentationTracksLocalCurrent(t *testing.T) {
	for _, current := range []string{"different gear", "missing agent", "same gear", "unknown fingerprint", "empty fingerprint", "unknown agents", "missing observation"} {
		t.Run(current, func(t *testing.T) {
			ctx := context.Background()
			env := newFixture(t)
			store := sqlite.NewFaeStore(openTestDB(t))
			raw, fp := sampleFullRawAvatar(1511)
			blob, err := json.Marshal(raw)
			if err != nil {
				t.Fatal(err)
			}
			now := time.Now().UTC()
			if _, err := store.ReserveRefresh(ctx, "1504687050", now, time.Minute, 1000); err != nil {
				t.Fatal(err)
			}
			rank := 20
			slug := "nangong-yu"
			if err := store.SaveObservation(ctx, "1504687050", domain.FaeObservation{ObservedAt: now, Agents: map[int]*domain.FaeRating{1511: {Rank: &rank, Slug: &slug, EquipmentFingerprint: &fp, ObservedAt: &now}}}); err != nil {
				t.Fatal(err)
			}
			env.svc.WithFaeReader(store)
			build, err := env.svc.Create(ctx, CreateInput{UserID: env.ownerID, GameAccountID: env.accountID, Name: "Attached equipment", RawAgentPayload: fairyAgentJSON(t, 1511, "Agent", true), RawData: blob})
			if err != nil {
				t.Fatal(err)
			}
			if build.FaeRating == nil || build.FaeRating.Status != domain.FaeStatusSnapshot || build.FaeRating.Outdated {
				t.Fatalf("Create(matching current) = %+v, want current saved snapshot", build.FaeRating)
			}
			original, err := json.Marshal(build.FaeRating)
			if err != nil {
				t.Fatal(err)
			}
			currentRank := 5
			currentFP := fp
			if current == "different gear" {
				currentFP += "-changed"
			}
			agents := map[int]*domain.FaeRating{1511: {Rank: &currentRank, EquipmentFingerprint: &currentFP}}
			switch current {
			case "missing agent":
				agents = map[int]*domain.FaeRating{}
			case "unknown fingerprint":
				agents[1511].EquipmentFingerprint = nil
			case "empty fingerprint":
				currentFP = ""
			case "unknown agents":
				agents = nil
			}
			if current == "missing observation" {
				env.svc.WithFaeReader(sqlite.NewFaeStore(openTestDB(t)))
			} else if err := store.SaveObservation(ctx, "1504687050", domain.FaeObservation{ObservedAt: now.Add(time.Second), Agents: agents}); err != nil {
				t.Fatal(err)
			}
			private, err := env.svc.GetByID(ctx, build.ID)
			if err != nil {
				t.Fatal(err)
			}
			public, err := env.svc.GetPublic(ctx, build.ID)
			if err != nil {
				t.Fatal(err)
			}
			list, err := env.svc.ListByAccount(ctx, env.ownerID, env.accountID)
			if err != nil || len(list) != 1 {
				t.Fatalf("ListByAccount = %d builds, %v, want 1", len(list), err)
			}
			publicList, err := env.svc.ListPublicByAccount(ctx, env.accountID)
			if err != nil || len(publicList) != 1 {
				t.Fatalf("ListPublicByAccount = %d builds, %v, want 1", len(publicList), err)
			}
			wantOutdated := current == "different gear" || current == "missing agent"
			wantStatus := domain.FaeStatusSnapshot
			if wantOutdated {
				wantStatus = domain.FaeStatusSnapshotOutdated
			}
			for name, got := range map[string]*domain.AgentBuild{"private": private, "public": public.Build, "list": list[0], "public list": publicList[0]} {
				r := got.FaeRating
				if r == nil || r.Outdated != wantOutdated || r.Status != wantStatus || r.Rank == nil || *r.Rank != 20 || r.ObservedAt == nil || !r.ObservedAt.Equal(now) {
					t.Errorf("%s after %s = %+v, want status %s, outdated %t, original rank 20 and date %v", name, current, r, wantStatus, wantOutdated, now)
				}
			}
			persisted, err := env.builds.GetByID(ctx, build.ID)
			if err != nil {
				t.Fatal(err)
			}
			attachment, err := json.Marshal(persisted.FaeRating)
			if err != nil {
				t.Fatal(err)
			}
			if string(attachment) != string(original) || persisted.UpdatedAt.UnixMilli() != build.UpdatedAt.UnixMilli() {
				t.Errorf("reads changed persisted build to rating %s, updated_at %v; want rating %s, updated_at %v", attachment, persisted.UpdatedAt, original, build.UpdatedAt)
			}
		})
	}
}
