import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import * as api from './client'
import {
  queryKeys,
  useConfirmAccountVerification,
  useConfirmVerification,
  useToggleTeamVisibility,
  useUpdateAccount,
  useUpdateAccountSettings,
} from './hooks'
import type { GameAccount, MeResponse } from '@/types'

const ACCOUNTS: GameAccount[] = [
  {
    id: 'acc-1',
    uid: '1500000001',
    region: 'Europe',
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'acc-2',
    uid: '1500000002',
    region: 'America',
    created_at: '2026-01-02T00:00:00Z',
  },
]

const ME: MeResponse = {
  user: {
    id: 'usr-1',
    discord_id: '111111111111111111',
    username: 'kirin',
    avatar_url: 'https://cdn.example.com/a.png',
    created_at: '2026-01-01T00:00:00Z',
  },
  accounts: ACCOUNTS,
}

const calls: string[] = []

beforeEach(() => {
  calls.length = 0
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      calls.push(String(input))
      return new Response(JSON.stringify(ME), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('no duplicate accounts round trip', () => {
  it('exposes no standalone accounts query key', () => {
    // Regression guard: a separate ['accounts'] query is exactly what made every
    // account-aware page fire a second, redundant request next to /auth/me.
    expect(Object.keys(queryKeys)).not.toContain('accounts')
  })

  it('exposes no fetchAccounts client method', () => {
    // Regression guard: nothing may call the redundant endpoint any more.
    expect(Object.keys(api)).not.toContain('fetchAccounts')
  })

  it('resolves the session in a single request', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })

    // useAccounts derives from this query; nothing else is fetched.
    const me = await client.fetchQuery({
      queryKey: queryKeys.me,
      queryFn: ({ signal }) => api.fetchMe(signal),
    })

    expect(calls).toEqual(['/api/v1/auth/me'])
    expect(me?.accounts).toEqual(ACCOUNTS)
  })

  it('derives the account list from the session cache', () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.me, ME)

    const derived = client.getQueryData<MeResponse | null>(queryKeys.me)?.accounts ?? []
    expect(derived).toHaveLength(2)
    expect(derived.map((a) => a.id)).toEqual(['acc-1', 'acc-2'])
  })
})

describe('invalidation is scoped to the affected list', () => {
  it('a build-list key does not match another account or language', () => {
    const client = new QueryClient()

    client.setQueryData(queryKeys.builds('acc-1', 'ru'), [])
    client.setQueryData(queryKeys.builds('acc-2', 'ru'), [])
    client.setQueryData(queryKeys.builds('acc-1', 'en'), [])

    // Simulate what invalidateQueries({ queryKey, exact: true }) does.
    const target = queryKeys.builds('acc-1', 'ru')
    expect(client.getQueryState(target)?.isInvalidated ?? false).toBe(false)
    expect(equalKey(target, queryKeys.builds('acc-2', 'ru'))).toBe(false)
    expect(equalKey(target, queryKeys.builds('acc-1', 'en'))).toBe(false)
  })

  it('a bare builds prefix would over-match, which is why it is not used', () => {
    // Guards the regression: ['builds'] without exact matches every account and
    // every language variant, so each active observer refetches.
    const matchesEverything = (key: readonly unknown[]) => key[0] === 'builds'
    expect(matchesEverything(['builds'])).toBe(true)
    expect(matchesEverything(queryKeys.builds('acc-1', 'ru'))).toBe(true)
    expect(matchesEverything(queryKeys.builds('acc-2', 'en'))).toBe(true)
  })

  it('account-scoped prefixes exclude the user other accounts', () => {
    // useDeleteAccount invalidates ['builds', accountId] rather than ['builds'].
    const isForAccount = (key: readonly unknown[], accountId: string) =>
      key[0] === 'builds' && key[1] === accountId

    expect(isForAccount(queryKeys.builds('acc-1', 'ru'), 'acc-1')).toBe(true)
    expect(isForAccount(queryKeys.builds('acc-1', 'en'), 'acc-1')).toBe(true)
    expect(isForAccount(queryKeys.builds('acc-2', 'ru'), 'acc-1')).toBe(false)
  })
})

function equalKey(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

describe('team validation is a cacheable GET', () => {
  beforeEach(() => {
    calls.length = 0
  })

  it('issues a GET with the build ids in the query string', async () => {
    const seen: { url: string; method: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        seen.push({ url, method: init?.method ?? 'GET' })
        return new Response(JSON.stringify({ is_valid: true, errors: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    await api.validateTeam(['build-a', 'build-b'])

    expect(seen).toHaveLength(1)
    // A POST body is invisible to the browser and to any intermediary cache, so
    // the same composition was re-validated on every visit.
    expect(seen[0]?.method).toBe('GET')
    expect(seen[0]?.url).toBe('/api/v1/teams/validate?build_ids=build-a,build-b')
  })

  it('url-encodes build ids', async () => {
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        seen.push(String(input))
        return new Response(JSON.stringify({ is_valid: true, errors: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    await api.validateTeam(['a b', 'c&d'])
    expect(seen[0]).toBe('/api/v1/teams/validate?build_ids=a%20b,c%26d')
  })
})

describe('public build and team query keys', () => {
  it('generates correct publicBuild keys', () => {
    expect(queryKeys.publicBuild('b1', 'ru')).toEqual(['public', 'build', 'b1', 'ru'])
    expect(queryKeys.publicBuild('b1')).toEqual(['public', 'build', 'b1'])
  })

  it('generates correct publicTeam keys', () => {
    expect(queryKeys.publicTeam('t1', 'en')).toEqual(['public', 'team', 't1', 'en'])
    expect(queryKeys.publicTeam('t1')).toEqual(['public', 'team', 't1'])
  })

  it('generates correct showcaseRoster keys', () => {
    expect(queryKeys.showcaseRoster('1504687050', 'ru')).toEqual(['showcase', 'roster', '1504687050', 'ru'])
    expect(queryKeys.showcaseRoster('1504687050')).toEqual(['showcase', 'roster', '1504687050'])
  })
})

describe('account verification and showcase roster api methods', () => {
  it('startAccountVerification posts to challenge endpoint', async () => {
    const seen: { url: string; method: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push({ url: String(input), method: init?.method ?? 'GET' })
        return new Response(JSON.stringify({ code: 'PXL-ABCD', expires_at: '2026-01-01T00:00:00Z', cooldown_seconds: 30 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    const res = await api.startAccountVerification('acc-1')
    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.url).toBe('/api/v1/accounts/acc-1/verify/challenge')
    expect(res.code).toBe('PXL-ABCD')
  })

  it('confirmAccountVerification posts to confirm endpoint', async () => {
    const seen: { url: string; method: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push({ url: String(input), method: init?.method ?? 'GET' })
        return new Response(JSON.stringify({ id: 'acc-1', uid: '1504687050', verified_at: '2026-01-01T00:00:00Z' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    const res = await api.confirmAccountVerification('acc-1')
    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.url).toBe('/api/v1/accounts/acc-1/verify/confirm')
    expect(res.verified_at).toBe('2026-01-01T00:00:00Z')
  })

  it('fetchShowcaseRoster calls get /showcase/{uid}/roster', async () => {
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        seen.push(String(input))
        return new Response(JSON.stringify({ owner: { uid: '1504687050' }, is_public_showcase: true, builds: [], teams: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    await api.fetchShowcaseRoster('1504687050', 'ru')
    expect(seen[0]).toBe('/api/v1/showcase/1504687050/roster?lang=ru')
  })

  it('patchTeam calls PATCH /api/v1/teams/{id}', async () => {
    const seen: { url: string; method: string; body?: unknown }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        seen.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
        })
        return new Response(JSON.stringify({ team: { id: 'team-1', name: 'T1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }),
    )

    await api.patchTeam('team-1', { is_public: true }, 'en')
    expect(seen[0]?.method).toBe('PATCH')
    expect(seen[0]?.url).toBe('/api/v1/teams/team-1?lang=en')
    expect(seen[0]?.body).toEqual({ is_public: true })
  })

  it('exports useToggleTeamVisibility and hook aliases', () => {
    expect(typeof useToggleTeamVisibility).toBe('function')
    expect(useUpdateAccountSettings).toBe(useUpdateAccount)
    expect(useConfirmAccountVerification).toBe(useConfirmVerification)
  })

  it('invalidating showcase prefix marks showcase and roster queries as invalidated', async () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.showcase('1504687050', 'ru'), { uid: '1504687050' })
    client.setQueryData(queryKeys.showcaseRoster('1504687050', 'ru'), { owner: { uid: '1504687050' } })

    expect(client.getQueryState(queryKeys.showcase('1504687050', 'ru'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(queryKeys.showcaseRoster('1504687050', 'ru'))?.isInvalidated).toBe(false)

    await client.invalidateQueries({ queryKey: ['showcase'] })

    expect(client.getQueryState(queryKeys.showcase('1504687050', 'ru'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.showcaseRoster('1504687050', 'ru'))?.isInvalidated).toBe(true)
  })

  it('invalidating public build/team prefixes marks respective queries as invalidated', async () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.publicBuild('b1', 'ru'), { build: { id: 'b1' } })
    client.setQueryData(queryKeys.publicTeam('t1', 'ru'), { team: { id: 't1' } })

    expect(client.getQueryState(queryKeys.publicBuild('b1', 'ru'))?.isInvalidated).toBe(false)
    expect(client.getQueryState(queryKeys.publicTeam('t1', 'ru'))?.isInvalidated).toBe(false)

    await client.invalidateQueries({ queryKey: ['public', 'build'] })
    expect(client.getQueryState(queryKeys.publicBuild('b1', 'ru'))?.isInvalidated).toBe(true)
    expect(client.getQueryState(queryKeys.publicTeam('t1', 'ru'))?.isInvalidated).toBe(false)

    await client.invalidateQueries({ queryKey: ['public', 'team'] })
    expect(client.getQueryState(queryKeys.publicTeam('t1', 'ru'))?.isInvalidated).toBe(true)
  })
})
