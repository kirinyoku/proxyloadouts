package sqlite

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// seedUser inserts a user and returns it.
func seedUser(t *testing.T, ctx context.Context, repo *SQLiteUserRepo, discordID string) *domain.User {
	t.Helper()

	user := &domain.User{
		DiscordID: discordID,
		Username:  "kirin",
	}
	if err := repo.Create(ctx, user); err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}
	return user
}

// seedAccount inserts a game account and returns it.
func seedAccount(t *testing.T, ctx context.Context, repo *SQLiteAccountRepo, userID uuid.UUID, uid string) *domain.GameAccount {
	t.Helper()

	account := &domain.GameAccount{
		UserID: userID,
		UID:    uid,
		Region: domain.RegionEurope,
	}
	if err := repo.Create(ctx, account); err != nil {
		t.Fatalf("failed to seed game account: %v", err)
	}
	return account
}

// makeDomainBuild returns a fully populated build for tests.
func makeDomainBuild(userID, accountID uuid.UUID, name string, agentID int) *domain.AgentBuild {
	weaponUID := "1511_9903502"
	weaponID := 14109
	buildData, _ := json.Marshal(map[string]any{"agent_id": agentID, "level": 60})
	rawData, _ := json.Marshal(map[string]any{"Id": agentID, "Level": 60})
	return &domain.AgentBuild{
		UserID:        userID,
		GameAccountID: accountID,
		AgentID:       agentID,
		AgentName:     "Miyabi",
		Name:          name,
		WeaponUID:     &weaponUID,
		WeaponID:      &weaponID,
		DiscUIDs:      []string{"33041_1", "32700_2", "32700_3", "34100_4", "34100_5", "34100_6"},
		RawData:       rawData,
		BuildData:     buildData,
	}
}

// assertTimeEqual compares timestamps at the stored second-level precision
// (millisecond fractions are intentionally ignored here).
func assertTimeEqual(t *testing.T, want, got time.Time) {
	t.Helper()

	wantSec := want.UTC().Truncate(time.Second)
	gotSec := got.UTC().Truncate(time.Second)
	if !wantSec.Equal(gotSec) {
		t.Errorf("expected time %v, got %v", wantSec, gotSec)
	}
}
