import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { queryKeys, useRefreshShowcaseFae } from './hooks'
import type { ShowcaseFaeResponse } from '@/types'

vi.mock('@/components/ui/sonner', () => ({ toast: { error: vi.fn() } }))
afterEach(() => vi.unstubAllGlobals())

function mountRefresh(client: QueryClient): Promise<ReturnType<typeof useRefreshShowcaseFae>> {
  return new Promise((resolve) => {
    function Harness() { resolve(useRefreshShowcaseFae()); return null }
    renderToString(<QueryClientProvider client={client}><Harness /></QueryClientProvider>)
  })
}

describe('explicit FAE refresh', () => {
  it('publishes failed outcomes with retained numbers and no build invalidation', async () => {
    const client = new QueryClient()
    client.setQueryData(queryKeys.builds('account'), [])
    const failed: ShowcaseFaeResponse = { uid: '1504687050', agents: { '1011': { status: 'snapshot', outdated: false, rank: 42 } },
      fetched_at: '2026-01-01T00:00:00Z', refresh_available_at: '2026-11-03T10:20:00Z', refresh_outcome: 'failed' }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(failed), { status: 200 })))
    await (await mountRefresh(client)).mutateAsync({ uid: failed.uid, gameAccountId: 'account' })
    expect(client.getQueryData(queryKeys.showcaseFae(failed.uid))).toEqual(failed)
    expect(client.getQueryState(queryKeys.builds('account'))?.isInvalidated).toBe(false)
    client.clear()
  })

  it('does not retry a network mutation even if the query client enables retries', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 1 } } })
    const fetch = vi.fn(async () => new Response('{}', { status: 502 }))
    vi.stubGlobal('fetch', fetch)
    await expect((await mountRefresh(client)).mutateAsync({ uid: '1504687050' })).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
    client.clear()
  })
})
