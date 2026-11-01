package scannersvc

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kirinyoku/enkanetwork-go/client/zzz"
	fairy "github.com/kirinyoku/fairy"

	"github.com/kirinyoku/proxyloadouts/backend/internal/adapter/inmemory"
	"github.com/kirinyoku/proxyloadouts/backend/internal/domain"
)

// fakeFetcher is a controllable Fetcher for tests.
type fakeFetcher struct {
	calls      atomic.Int64
	profile    *fairy.Profile
	rawProfile *zzz.Profile
	ttl        time.Duration
	err        error

	// When non-nil, FetchRawProfile blocks until the channel is closed.
	gate chan struct{}
}

func (f *fakeFetcher) FetchRawProfile(_ context.Context, uid string) (*zzz.Profile, time.Duration, error) {
	if f.gate != nil {
		<-f.gate
	}
	f.calls.Add(1)
	if f.err != nil {
		return nil, 0, f.err
	}
	if f.rawProfile != nil {
		return f.rawProfile, f.ttl, nil
	}
	return &zzz.Profile{UID: uid}, f.ttl, nil
}

func (f *fakeFetcher) EnrichProfile(raw *zzz.Profile, lang fairy.Language) (*fairy.Profile, error) {
	if raw == nil {
		return nil, errors.New("raw profile is nil")
	}
	if f.profile == nil {
		p := &fairy.Profile{UID: raw.UID}
		if raw.PlayerInfo.SocialDetail != nil && raw.PlayerInfo.SocialDetail.ProfileDetail != nil {
			p.Nickname = raw.PlayerInfo.SocialDetail.ProfileDetail.Nickname
		}
		return p, nil
	}
	p := *f.profile
	if len(p.Agents) > 0 {
		p.Agents = make([]fairy.Agent, len(f.profile.Agents))
		copy(p.Agents, f.profile.Agents)
		for i := range p.Agents {
			if lang == fairy.LangEN {
				p.Agents[i].Name = "Agent EN"
			} else {
				p.Agents[i].Name = "Агент RU"
			}
		}
	}
	return &p, nil
}

func (f *fakeFetcher) EnrichAgent(raw *zzz.AvatarData, lang fairy.Language) (*fairy.Agent, error) {
	if raw == nil {
		return nil, errors.New("raw avatar is nil")
	}
	name := "Агент RU"
	if lang == fairy.LangEN {
		name = "Agent EN"
	}
	return &fairy.Agent{
		ID:   raw.ID,
		Name: name,
	}, nil
}

func (f *fakeFetcher) callCount() int64 { return f.calls.Load() }

func testProfile(uid string, agents int) *fairy.Profile {
	p := &fairy.Profile{
		UID:            uid,
		Nickname:       "Chocola",
		Region:         fairy.RegionEU,
		InterknotLevel: 60,
	}
	for i := range agents {
		p.Agents = append(p.Agents, fairy.Agent{ID: 1000 + i, Name: "Agent"})
	}
	return p
}

func newTestService(fetcher Fetcher, ttl time.Duration) (*Service, *inmemory.ProfileCache[*zzz.Profile]) {
	cache := inmemory.NewProfileCache[*zzz.Profile](1000, time.Minute)
	svc := New(fetcher, cache, Options{FallbackTTL: ttl})
	return svc, cache
}

func TestScanByUID_FreshThenCached(t *testing.T) {
	fetcher := &fakeFetcher{
		profile: testProfile("1301806568", 2),
		ttl:     300 * time.Second,
	}
	svc, cache := newTestService(fetcher, time.Minute)
	defer cache.Close()
	ctx := context.Background()

	first, err := svc.ScanByUID(ctx, "1301806568")
	if err != nil {
		t.Fatalf("first scan failed: %v", err)
	}
	if first.Source != SourceFresh {
		t.Errorf("expected source fresh, got %q", first.Source)
	}
	if first.AgentCount != 2 {
		t.Errorf("expected 2 agents, got %d", first.AgentCount)
	}
	if first.Nickname != "Chocola" {
		t.Errorf("expected nickname Chocola, got %q", first.Nickname)
	}
	if first.Region != string(fairy.RegionEU) {
		t.Errorf("expected region Europe, got %q", first.Region)
	}
	if first.TTLSeconds != 300 {
		t.Errorf("expected ttl_seconds 300 from upstream, got %d", first.TTLSeconds)
	}

	second, err := svc.ScanByUID(ctx, "1301806568")
	if err != nil {
		t.Fatalf("second scan failed: %v", err)
	}
	if second.Source != SourceCached {
		t.Errorf("expected source cached, got %q", second.Source)
	}
	if second.TTLSeconds >= 300 {
		t.Errorf("expected remaining ttl below 300, got %d", second.TTLSeconds)
	}
	if fetcher.callCount() != 1 {
		t.Errorf("expected 1 upstream fetch, got %d", fetcher.callCount())
	}
}

func TestScanByUID_SingleflightCoalesces(t *testing.T) {
	fetcher := &fakeFetcher{
		profile: testProfile("1301806568", 1),
		ttl:     time.Minute,
		gate:    make(chan struct{}),
	}
	svc, cache := newTestService(fetcher, time.Minute)
	defer cache.Close()

	const workers = 10
	results := make(chan *ShowcaseResponse, workers)
	errs := make(chan error, workers)

	var wg sync.WaitGroup
	for range workers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			resp, err := svc.ScanByUID(context.Background(), "1301806568")
			if err != nil {
				errs <- err
				return
			}
			results <- resp
		}()
	}

	// Give all goroutines time to reach the singleflight gate, then release.
	time.Sleep(50 * time.Millisecond)
	close(fetcher.gate)
	wg.Wait()

	close(errs)
	for err := range errs {
		t.Fatalf("concurrent scan failed: %v", err)
	}
	for range workers {
		<-results
	}

	if got := fetcher.callCount(); got != 1 {
		t.Errorf("expected single upstream fetch across %d scans, got %d", workers, got)
	}
}

func TestScanByUID_InvalidUID(t *testing.T) {
	fetcher := &fakeFetcher{}
	svc, cache := newTestService(fetcher, time.Minute)
	defer cache.Close()

	for _, uid := range []string{"", "abc", "12345678", "12345678901"} {
		if _, err := svc.ScanByUID(context.Background(), uid); !errors.Is(err, domain.ErrInvalidInput) {
			t.Errorf("uid %q: expected ErrInvalidInput, got %v", uid, err)
		}
	}
	if fetcher.callCount() != 0 {
		t.Errorf("expected no upstream fetches for invalid uids, got %d", fetcher.callCount())
	}
}

func TestScanByUID_TransientErrorsNotCached(t *testing.T) {
	fetcher := &fakeFetcher{err: domain.ErrSourceUnavailable}
	svc, cache := newTestService(fetcher, time.Minute)
	defer cache.Close()

	if _, err := svc.ScanByUID(context.Background(), "1301806568"); !errors.Is(err, domain.ErrSourceUnavailable) {
		t.Fatalf("expected ErrSourceUnavailable, got %v", err)
	}

	// The upstream recovers: the next scan must hit the network again.
	fetcher.err = nil
	fetcher.profile = testProfile("1301806568", 3)
	fetcher.ttl = time.Minute

	resp, err := svc.ScanByUID(context.Background(), "1301806568")
	if err != nil {
		t.Fatalf("recovery scan failed: %v", err)
	}
	if resp.AgentCount != 3 {
		t.Errorf("expected 3 agents after recovery, got %d", resp.AgentCount)
	}
	if fetcher.callCount() != 2 {
		t.Errorf("expected 2 upstream fetches, got %d", fetcher.callCount())
	}
}

func TestScanByUID_NegativeCache(t *testing.T) {
	fetcher := &fakeFetcher{err: domain.ErrNotFound}
	cache := inmemory.NewProfileCache[*zzz.Profile](1000, time.Minute)
	defer cache.Close()

	negCache := inmemory.NewNegativeCache(1000, time.Minute)
	defer negCache.Close()

	svc := New(fetcher, cache, Options{
		FallbackTTL:   time.Minute,
		NegativeTTL:   50 * time.Millisecond,
		NegativeCache: negCache,
	})

	ctx := context.Background()

	// First scan hits upstream and returns ErrNotFound
	if _, err := svc.ScanByUID(ctx, "1301806568"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected ErrNotFound on first scan, got %v", err)
	}
	if fetcher.callCount() != 1 {
		t.Fatalf("expected 1 fetcher call, got %d", fetcher.callCount())
	}

	// Second scan within negative TTL returns ErrNotFound WITHOUT calling fetcher
	if _, err := svc.ScanByUID(ctx, "1301806568"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected ErrNotFound on second scan, got %v", err)
	}
	if fetcher.callCount() != 1 {
		t.Fatalf("expected still 1 fetcher call (cached), got %d", fetcher.callCount())
	}

	// Wait for negative cache TTL to expire
	time.Sleep(60 * time.Millisecond)

	// Upstream recovers
	fetcher.err = nil
	fetcher.profile = testProfile("1301806568", 2)

	// Third scan hits upstream again
	resp, err := svc.ScanByUID(ctx, "1301806568")
	if err != nil {
		t.Fatalf("expected success after negative TTL expiry, got %v", err)
	}
	if resp.AgentCount != 2 {
		t.Errorf("expected 2 agents, got %d", resp.AgentCount)
	}
	if fetcher.callCount() != 2 {
		t.Fatalf("expected 2 fetcher calls after expiry, got %d", fetcher.callCount())
	}
}

func TestGetRawAvatar_NegativeCache(t *testing.T) {
	fetcher := &fakeFetcher{err: domain.ErrNotFound}
	cache := inmemory.NewProfileCache[*zzz.Profile](1000, time.Minute)
	defer cache.Close()

	svc := New(fetcher, cache, Options{
		FallbackTTL: time.Minute,
		NegativeTTL: 50 * time.Millisecond,
	})

	ctx := context.Background()

	// First call hits fetcher
	_, err := svc.GetRawAvatar(ctx, "1301806568", 1011)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
	if fetcher.callCount() != 1 {
		t.Fatalf("expected 1 fetcher call, got %d", fetcher.callCount())
	}

	// Second call hits negative cache
	_, err = svc.GetRawAvatar(ctx, "1301806568", 1011)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected ErrNotFound from negative cache, got %v", err)
	}
	if fetcher.callCount() != 1 {
		t.Fatalf("expected still 1 fetcher call, got %d", fetcher.callCount())
	}
}

func TestScanByUID_EmptyShowcaseIsValid(t *testing.T) {
	fetcher := &fakeFetcher{
		profile: testProfile("1301806568", 0),
		ttl:     time.Minute,
	}
	svc, cache := newTestService(fetcher, time.Minute)
	defer cache.Close()

	resp, err := svc.ScanByUID(context.Background(), "1301806568")
	if err != nil {
		t.Fatalf("empty showcase scan failed: %v", err)
	}
	if resp.AgentCount != 0 || len(resp.Agents) != 0 {
		t.Errorf("expected empty showcase, got %d agents", resp.AgentCount)
	}
	if resp.Source != SourceFresh {
		t.Errorf("expected source fresh, got %q", resp.Source)
	}
}

func TestScanByUID_FallbackTTLWhenUpstreamOmitted(t *testing.T) {
	fetcher := &fakeFetcher{
		profile: testProfile("1301806568", 1),
		ttl:     0,
	}
	svc, cache := newTestService(fetcher, 30*time.Second)
	defer cache.Close()

	resp, err := svc.ScanByUID(context.Background(), "1301806568")
	if err != nil {
		t.Fatalf("scan failed: %v", err)
	}
	if resp.TTLSeconds != 30 {
		t.Errorf("expected fallback TTL 30s, got %d", resp.TTLSeconds)
	}
}

func TestScanByUID_MultiLanguage_CachedRawProfile(t *testing.T) {
	fetcher := &fakeFetcher{
		profile: testProfile("1301806568", 2),
		ttl:     300 * time.Second,
	}
	svc, cache := newTestService(fetcher, time.Minute)
	defer cache.Close()

	// 1. Initial scan in Russian: network call made, enriched in Russian.
	respRU, err := svc.ScanByUID(context.Background(), "1301806568", "ru")
	if err != nil {
		t.Fatalf("ScanByUID(ru) failed: %v", err)
	}
	if respRU.Source != SourceFresh {
		t.Errorf("expected source fresh for first scan, got %q", respRU.Source)
	}
	if fetcher.callCount() != 1 {
		t.Errorf("expected 1 upstream call, got %d", fetcher.callCount())
	}
	if len(respRU.Agents) == 0 || respRU.Agents[0].Name != "Агент RU" {
		t.Errorf("expected Russian agent name, got %q", respRU.Agents[0].Name)
	}

	// 2. Immediate second scan in English: served from raw cache (0 new calls!), enriched in English.
	respEN, err := svc.ScanByUID(context.Background(), "1301806568", "en")
	if err != nil {
		t.Fatalf("ScanByUID(en) failed: %v", err)
	}
	if respEN.Source != SourceCached {
		t.Errorf("expected source cached for second scan, got %q", respEN.Source)
	}
	if fetcher.callCount() != 1 {
		t.Errorf("expected still 1 upstream call (cache hit on raw), got %d", fetcher.callCount())
	}
	if len(respEN.Agents) == 0 || respEN.Agents[0].Name != "Agent EN" {
		t.Errorf("expected English agent name, got %q", respEN.Agents[0].Name)
	}
}

func TestGetRawAvatar(t *testing.T) {
	fetcher := &fakeFetcher{
		profile: testProfile("1301806568", 1),
		ttl:     300 * time.Second,
	}
	// Inject raw showcase data in FetchRawProfile
	rawFetcher := &rawProfileFetcher{
		fakeFetcher: fetcher,
		avatarData: []zzz.AvatarData{
			{ID: 1011, Level: 60},
		},
	}
	svc, cache := newTestService(rawFetcher, time.Minute)
	defer cache.Close()

	avatar, err := svc.GetRawAvatar(context.Background(), "1301806568", 1011)
	if err != nil {
		t.Fatalf("GetRawAvatar failed: %v", err)
	}
	if avatar.ID != 1011 || avatar.Level != 60 {
		t.Errorf("unexpected avatar data: %+v", avatar)
	}

	// Unknown agent
	_, err = svc.GetRawAvatar(context.Background(), "1301806568", 9999)
	if !errors.Is(err, domain.ErrNotFound) {
		t.Errorf("expected ErrNotFound for missing agent, got: %v", err)
	}

	// EnrichAgent
	agent, err := svc.EnrichAgent(avatar, fairy.LangEN)
	if err != nil {
		t.Fatalf("EnrichAgent failed: %v", err)
	}
	if agent.Name != "Agent EN" {
		t.Errorf("expected Agent EN, got %s", agent.Name)
	}
}

type rawProfileFetcher struct {
	*fakeFetcher
	avatarData []zzz.AvatarData
}

func (r *rawProfileFetcher) FetchRawProfile(ctx context.Context, uid string) (*zzz.Profile, time.Duration, error) {
	prof, ttl, err := r.fakeFetcher.FetchRawProfile(ctx, uid)
	if err != nil {
		return nil, 0, err
	}
	prof.PlayerInfo.ShowcaseDetail = &zzz.ShowcaseDetail{
		AvatarList: r.avatarData,
	}
	return prof, ttl, nil
}

func TestNormalizeLanguage(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want fairy.Language
	}{
		{"empty string", "", fairy.LangRU},
		{"whitespace", "   ", fairy.LangRU},
		{"unsupported language", "klingon", fairy.LangRU},
		{"simple ru", "ru", fairy.LangRU},
		{"simple en", "en", fairy.LangEN},
		{"simple ja", "ja", fairy.LangJA},
		{"simple de", "de", fairy.LangDE},
		{"simple fr", "fr", fairy.LangFR},
		{"simple zh-cn", "zh-cn", fairy.LangZHCN},
		{"regional ru-RU", "ru-RU", fairy.LangRU},
		{"regional en-US", "en-US", fairy.LangEN},
		{"regional zh-CN", "zh-CN", fairy.LangZHCN},
		{"accept-language ru priority", "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7", fairy.LangRU},
		{"accept-language en priority", "en-US,en;q=0.9,ru;q=0.8", fairy.LangEN},
		{"accept-language fr priority", "fr-FR,fr;q=0.9,en;q=0.8", fairy.LangFR},
		{"weighted choice ru over en", "en;q=0.7, ru;q=0.9", fairy.LangRU},
		{"fallback through unsupported", "xx-XX,yy-YY;q=0.9,en;q=0.5", fairy.LangEN},
		{"zero weight skipped", "en;q=0,ru;q=0.8", fairy.LangRU},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NormalizeLanguage(tt.raw)
			if got != tt.want {
				t.Errorf("NormalizeLanguage(%q) = %q, want %q", tt.raw, got, tt.want)
			}
		})
	}
}

func TestFetchFreshRawProfile_BypassesAndOverwritesCache(t *testing.T) {
	const testUID = "1301806568"
	cacheKey := scanCacheKey(testUID)

	// Old profile initially placed into cache
	oldProfile := &zzz.Profile{
		UID: testUID,
		PlayerInfo: zzz.PlayerInfo{
			SocialDetail: &zzz.SocialDetail{
				Desc: "OLD_SIGNATURE",
				ProfileDetail: &zzz.ProfileDetail{
					Nickname: "OldNick",
				},
			},
		},
	}

	fetcher := &fakeFetcher{
		ttl: 5 * time.Minute,
	}
	svc, cache := newTestService(fetcher, time.Minute)
	defer cache.Close()

	// Seed cache directly with old profile
	cache.Set(cacheKey, oldProfile, 5*time.Minute)

	// Verify old profile is in cache via GetOrFetch (bypasses upstream network call)
	cachedRaw, fromCache, _, err := cache.GetOrFetch(context.Background(), cacheKey, time.Minute, nil)
	if err != nil || !fromCache || cachedRaw.PlayerInfo.SocialDetail.Desc != "OLD_SIGNATURE" {
		t.Fatalf("failed to seed cache with old profile: fromCache=%v, err=%v", fromCache, err)
	}

	// Update fetcher to return new profile with new signature
	newProfile := &zzz.Profile{
		UID: testUID,
		PlayerInfo: zzz.PlayerInfo{
			SocialDetail: &zzz.SocialDetail{
				Desc: "PXL-7890",
				ProfileDetail: &zzz.ProfileDetail{
					Nickname: "VerifiedPlayer",
				},
			},
		},
	}
	fetcher.rawProfile = newProfile
	fetcher.profile = &fairy.Profile{
		UID:      testUID,
		Nickname: "VerifiedPlayer",
		Avatar:   &fairy.Avatar{URL: "https://avatar.png"},
	}

	// Fetch fresh profile bypassing cache
	fresh, err := svc.FetchFreshRawProfile(context.Background(), testUID)
	if err != nil {
		t.Fatalf("FetchFreshRawProfile failed: %v", err)
	}

	// Verify fresh profile fields
	if fresh.UID != testUID {
		t.Errorf("expected UID %s, got %s", testUID, fresh.UID)
	}
	if fresh.Signature != "PXL-7890" {
		t.Errorf("expected signature PXL-7890, got %s", fresh.Signature)
	}
	if fresh.Nickname != "VerifiedPlayer" {
		t.Errorf("expected nickname VerifiedPlayer, got %s", fresh.Nickname)
	}
	if fresh.AvatarURL != "https://avatar.png" {
		t.Errorf("expected avatar URL https://avatar.png, got %s", fresh.AvatarURL)
	}
	if fresh.Raw != newProfile {
		t.Errorf("expected raw profile to match upstream response")
	}
	if fetcher.callCount() != 1 {
		t.Errorf("expected 1 fetcher call, got %d", fetcher.callCount())
	}

	// Verify that cache was overwritten with the new profile
	overwrittenRaw, fromCache, _, err := cache.GetOrFetch(context.Background(), cacheKey, time.Minute, nil)
	if err != nil || !fromCache {
		t.Fatalf("expected cache hit after fresh fetch: %v", err)
	}
	if overwrittenRaw.PlayerInfo.SocialDetail.Desc != "PXL-7890" {
		t.Errorf("expected cache to have new signature PXL-7890, got %s", overwrittenRaw.PlayerInfo.SocialDetail.Desc)
	}
}

func TestFetchFreshRawProfile_EvictsNegativeCache(t *testing.T) {
	const testUID = "1301806568"
	cacheKey := scanCacheKey(testUID)

	negCache := inmemory.NewNegativeCache(100, time.Minute)
	defer negCache.Close()
	negCache.Set(cacheKey, time.Minute)
	if !negCache.Has(cacheKey) {
		t.Fatal("negative cache should contain key initially")
	}

	fetcher := &fakeFetcher{
		rawProfile: &zzz.Profile{
			UID: testUID,
			PlayerInfo: zzz.PlayerInfo{
				SocialDetail: &zzz.SocialDetail{
					Desc: "PXL-1234",
				},
			},
		},
	}
	cache := inmemory.NewProfileCache[*zzz.Profile](100, time.Minute)
	defer cache.Close()

	svc := New(fetcher, cache, Options{
		NegativeCache: negCache,
		NegativeTTL:   time.Minute,
	})

	fresh, err := svc.FetchFreshRawProfile(context.Background(), testUID)
	if err != nil {
		t.Fatalf("FetchFreshRawProfile failed: %v", err)
	}
	if fresh.Signature != "PXL-1234" {
		t.Errorf("expected signature PXL-1234, got %s", fresh.Signature)
	}
	if negCache.Has(cacheKey) {
		t.Errorf("expected negative cache key to be evicted")
	}
}

func TestFetchFreshRawProfile_InvalidUID(t *testing.T) {
	svc, cache := newTestService(&fakeFetcher{}, time.Minute)
	defer cache.Close()

	_, err := svc.FetchFreshRawProfile(context.Background(), "invalid-uid")
	if !errors.Is(err, domain.ErrInvalidInput) {
		t.Fatalf("expected ErrInvalidInput, got: %v", err)
	}
}

func TestFetchFreshRawProfile_FetcherError(t *testing.T) {
	fetchErr := errors.New("upstream enka down")
	fetcher := &fakeFetcher{err: fetchErr}
	svc, cache := newTestService(fetcher, time.Minute)
	defer cache.Close()

	_, err := svc.FetchFreshRawProfile(context.Background(), "1301806568")
	if !errors.Is(err, fetchErr) {
		t.Fatalf("expected fetcher error, got: %v", err)
	}
}
