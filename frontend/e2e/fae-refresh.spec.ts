import { expect, test } from '@playwright/test'
import type { Agent, FaeRating, ShowcaseResponse } from '../src/types'

const uid = '1504687050'
const account = { id: 'fae-account', uid, region: 'Europe', created_at: '2026-01-01T00:00:00Z' }
const agent: Agent = {
  id: 1011, name: 'Anby Demara', level: 60, promotion: 5, mindscape_cinema: 0,
  core_skill_enhancement: 6, attribute: 'Electric', attribute_name: 'Electric',
  specialty: 'Stun', specialty_name: 'Stun', rarity: 'A', skin: null,
  splash_art_url: '', w_engine: null, drive_discs: { slots: [], set_bonuses: [] }, skills: [],
  stats: { hp: 1000, atk: 500, def: 300, impact: 100, crit_rate: 0.05, crit_dmg: 0.5,
    attribute_dmg_bonus: 0, anomaly_mastery: 50, anomaly_proficiency: 50,
    pen_ratio: 0, pen_flat: 0, energy_regen: 1, sheer_force: 0 },
}
const showcase: ShowcaseResponse = {
  uid, nickname: 'FAE refresh test', region: 'Europe', interknot_level: 60,
  avatar_url: '', source: 'fresh', ttl_seconds: 0, fetched_at: '2026-01-01T00:00:00Z',
  agent_count: 1, agents: [agent],
}
const rating = (rank: number): FaeRating => ({ status: 'snapshot', outdated: false, rank, rank_of: 10000, top_percentile: rank / 10000, observed_at: showcase.fetched_at })

test('showcase reload stays local and only the integrated badge FAE control refreshes ratings', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-03T10:00:00Z') })
  let finish: () => void = () => {}
  const gate = new Promise<void>((resolve) => { finish = resolve })
  let forced = 0
  let complete = false
  const buildReads: boolean[] = []
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let body: unknown = {}
    if (url.pathname.endsWith('/auth/me')) {
      body = { user: { id: 'fae-user', username: 'Tester', discord_id: '1' }, accounts: [account] }
    } else if (url.pathname.endsWith('/fae')) {
      if (url.searchParams.get('fresh') === 'true') {
        forced++
        await gate
        complete = true
      }
      body = { uid, agents: { '1011': rating(complete ? 1839 : 2796) }, fetched_at: showcase.fetched_at,
        refresh_available_at: complete ? '2026-11-03T10:20:00Z' : null, refresh_outcome: complete ? 'updated' : 'saved' }
    } else if (url.pathname.endsWith('/roster')) {
      body = { owner: { uid, nickname: 'Tester', region: 'Europe' }, builds: [], teams: [], is_public_roster: false }
    } else if (url.pathname.endsWith('/builds')) {
      buildReads.push(complete)
      body = []
    } else if (url.pathname.endsWith(`/showcase/${uid}`)) {
      body = showcase
    }
    await route.fulfill({ json: body })
  })
  await page.goto(`/showcase?uid=${uid}`)
  const badge = page.getByTestId('fae-badge-snapshot')
  await expect(badge).toContainText(/#2\s796/)
  await page.getByRole('button', { name: 'Обновить данные витрины' }).click()
  await page.waitForLoadState('networkidle')
  expect(forced).toBe(0)
  const initialReads = buildReads.length
  const refresh = page.getByRole('button', { name: 'Обновить рейтинг FAE' })
  const control = page.getByTestId('fae-refresh-control')
  const header = page.locator('div').filter({ has: page.getByRole('button', { name: 'Обновить данные витрины', exact: true }) }).filter({ has: page.getByRole('button', { name: 'Скопировать UID', exact: true }) }).last()
  await expect(header.getByTestId('fae-refresh-control')).toHaveCount(0)
  await expect(control.locator('> button')).toHaveCount(2)
  await expect(control.getByTestId('fae-badge-snapshot')).toBeVisible()
  await badge.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(forced).toBe(0)
  await page.keyboard.press('Escape')
  await expect(control).toHaveCount(1)
  await expect(page.getByText('Рейтинг получен', { exact: false })).toHaveCount(0)
  await page.getByRole('heading', { name: 'Anby Demara' }).click()
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 960 })
    const bounds = await control.boundingBox()
    expect(bounds?.width).toBeLessThanOrEqual(270)
    expect(bounds?.height).toBe(32)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await page.screenshot({ animations: 'disabled', path: `/tmp/fae-badge-refresh-${width === 1440 ? 'desktop' : `mobile-${width}`}.png` })
    if (width === 1440) await page.screenshot({ animations: 'disabled', path: '/tmp/fae-badge-refresh-header.png', clip: { x: 155, y: 65, width: 1130, height: 220 } })
  }
  await refresh.click()
  await expect(refresh).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByTestId('fae-badge-snapshot').click()
  await expect(page.getByRole('dialog').getByText('Рейтинг получен', { exact: false })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(badge).toContainText(/#2\s796/)
  expect(buildReads.slice(initialReads)).toEqual([])
  finish()
  await expect(badge).toContainText(/#1\s839/)
  await expect(refresh).toBeDisabled()
  await page.getByTestId('fae-badge-snapshot').click()
  await expect(page.getByRole('dialog').getByText('Следующее обновление FAE доступно', { exact: false })).toBeVisible()
  await page.screenshot({ animations: 'disabled', path: '/tmp/fae-badge-refresh-details.png' })
  const popover = await page.getByRole('dialog').boundingBox()
  expect(popover?.x).toBeGreaterThanOrEqual(0)
  expect((popover?.x ?? 0) + (popover?.width ?? 0)).toBeLessThanOrEqual(320)
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('fae-badge-snapshot')).toBeFocused()
  await expect.poll(() => buildReads.slice(initialReads)).toEqual([true])
  await page.clock.fastForward('20:01')
  await expect(refresh).toBeEnabled()
  expect(forced).toBe(1)
})

for (const outcome of ['failed', 'capacity']) {
  test(`${outcome} refresh keeps old numbers and observation date during cooldown`, async ({ page }) => {
    const message = outcome === 'failed' ? 'Не удалось обновить FAE. Предыдущий рейтинг сохранён.' : 'Обновление FAE временно недоступно. Попробуйте позже.'
    await page.clock.install({ time: new Date('2026-11-03T10:00:00Z') })
    let forced = 0
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url())
      let body: unknown = {}
      if (url.pathname.endsWith('/auth/me')) body = { user: { id: 'fae-user', username: 'Tester', discord_id: '1' }, accounts: [] }
      else if (url.pathname.endsWith('/fae')) {
        if (url.searchParams.get('fresh') === 'true') forced++
        body = { uid, agents: { '1011': rating(2796) }, fetched_at: showcase.fetched_at,
          refresh_available_at: forced ? '2026-11-03T10:20:00Z' : null, refresh_outcome: forced ? outcome : 'saved' }
      } else if (url.pathname.endsWith('/roster')) body = { builds: [], teams: [], is_public_roster: false }
      else if (url.pathname.endsWith(`/showcase/${uid}`)) body = showcase
      await route.fulfill({ json: body })
    })
    await page.goto(`/showcase?uid=${uid}`)
    const refresh = page.getByRole('button', { name: 'Обновить рейтинг FAE' })
    await expect(page.getByTestId('fae-badge-snapshot')).toContainText(/#2\s796/)
    await refresh.click()
    await expect(page.getByRole('status').filter({ hasText: message })).toHaveText(new RegExp(message))
    await page.getByTestId('fae-badge-snapshot').click()
    await expect(page.getByRole('dialog').getByText(message)).toBeVisible()
    await expect(page.getByTestId('fae-badge-snapshot')).toContainText(/#2\s796/)
    await expect(page.getByText('Рейтинг получен', { exact: false })).toContainText('01.01.2026')
    await page.keyboard.press('Escape')
    await expect(refresh).toBeDisabled()
    await page.clock.fastForward('20:01')
    await expect(refresh).toBeEnabled()
    expect(forced).toBe(1)
  })

}

test('cold UID offers the explicit refresh action without an automatic refresh', async ({ page }) => {
  let forced = 0
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let body: unknown = {}
    if (url.pathname.endsWith('/auth/me')) body = { user: { id: 'fae-user', username: 'Tester', discord_id: '1' }, accounts: [] }
    else if (url.pathname.endsWith('/fae')) {
      if (url.searchParams.get('fresh') === 'true') forced++
      body = { uid, agents: forced ? { '1011': rating(2796) } : {}, fetched_at: forced ? showcase.fetched_at : null,
        refresh_available_at: null, refresh_outcome: forced ? 'updated' : 'missing' }
    } else if (url.pathname.endsWith('/roster')) body = { builds: [], teams: [], is_public_roster: false }
    else if (url.pathname.endsWith(`/showcase/${uid}`)) body = showcase
    await route.fulfill({ json: body })
  })
  await page.goto(`/showcase?uid=${uid}`)
  const refresh = page.getByRole('button', { name: 'Обновить рейтинг FAE' })
  await expect(refresh).toBeEnabled()
  await page.getByTestId('fae-badge-unassessed').click()
  await expect(page.getByText('Нет сохранённой оценки FAE.', { exact: false })).toBeVisible()
  expect(forced).toBe(0)
  await page.keyboard.press('Escape')
  await refresh.click()
  await expect(page.getByTestId('fae-badge-snapshot')).toContainText(/#2\s796/)
  expect(forced).toBe(1)
})

for (const outdated of [false, true]) {
  test(`${outdated ? 'historical' : 'current'} snapshot controls the current gear link`, async ({ page }) => {
    const savedRating: FaeRating = {
      ...rating(2796),
      status: outdated ? 'snapshot_outdated' : 'snapshot',
      outdated,
      slug: 'anby',
    }
    await page.route('**/api/v1/**', async (route) => {
      const url = new URL(route.request().url())
      let body: unknown = {}
      if (url.pathname.endsWith('/auth/me')) body = { user: { id: 'fae-user', username: 'Tester', discord_id: '1' }, accounts: [] }
      else if (url.pathname.endsWith('/fae')) body = { uid, agents: { '1011': savedRating }, fetched_at: showcase.fetched_at, refresh_available_at: null, refresh_outcome: 'saved' }
      else if (url.pathname.endsWith('/roster')) body = { builds: [], teams: [], is_public_roster: false }
      else if (url.pathname.endsWith(`/showcase/${uid}`)) body = showcase
      await route.fulfill({ json: body })
    })
    await page.goto(`/showcase?uid=${uid}`)
    const badge = page.getByTestId(outdated ? 'fae-badge-outdated' : 'fae-badge-snapshot')
    await expect(badge).toContainText(/#2\s796/)
    await badge.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.locator(`a[href="https://zfae.net/profile/${uid}/anby"]`)).toHaveCount(outdated ? 0 : 1)
  })
}


test('empty showcase retains the integrated unassessed refresh action', async ({ page }) => {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let body: unknown = {}
    if (url.pathname.endsWith('/auth/me')) body = { user: { id: 'fae-user', username: 'Tester', discord_id: '1' }, accounts: [] }
    else if (url.pathname.endsWith('/fae')) body = { uid, agents: {}, fetched_at: null, refresh_available_at: null, refresh_outcome: 'missing' }
    else if (url.pathname.endsWith('/roster')) body = { builds: [], teams: [], is_public_roster: false }
    else if (url.pathname.endsWith(`/showcase/${uid}`)) body = { ...showcase, agents: [], agent_count: 0 }
    await route.fulfill({ json: body })
  })
  await page.goto(`/showcase?uid=${uid}`)
  await expect(page.getByRole('button', { name: 'Обновить рейтинг FAE' })).toBeEnabled()
  await expect(page.getByTestId('fae-refresh-control')).toHaveCount(1)
  await expect(page.getByTestId('fae-badge-snapshot')).toHaveCount(0)
})


test('single saved squad fallback keeps refresh when Enka is unavailable', async ({ page }) => {
  let forced = 0
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let body: unknown = {}
    if (url.pathname.endsWith('/auth/me')) body = { user: { id: 'fae-user', username: 'Tester', discord_id: '1' }, accounts: [] }
    else if (url.pathname.endsWith('/fae')) {
      if (url.searchParams.get('fresh') === 'true') forced++
      body = { uid, agents: {}, fetched_at: null, refresh_available_at: null, refresh_outcome: 'missing' }
    } else if (url.pathname.endsWith('/roster')) {
      body = {
        owner: { uid, nickname: 'Tester', region: 'Europe' }, builds: [], is_public_teams: true,
        teams: [{ team: { id: 'team-1', name: 'Saved squad', game_account_id: 'account', created_at: showcase.fetched_at, updated_at: showcase.fetched_at }, members: [] }],
      }
    } else if (url.pathname.endsWith(`/showcase/${uid}`)) {
      await route.fulfill({ status: 503, json: { error: 'Enka unavailable' } })
      return
    }
    await route.fulfill({ json: body })
  })
  await page.goto(`/showcase?uid=${uid}`)
  const refresh = page.getByRole('button', { name: 'Обновить рейтинг FAE' })
  await expect(refresh).toBeEnabled({ timeout: 15000 })
  await expect(page.getByTestId('fae-refresh-control')).toHaveCount(1)
  await expect(page.getByRole('alert').getByTestId('fae-refresh-control')).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Витрина в игре' })).toHaveCount(0)
  expect(forced).toBe(0)
  await refresh.click()
  await expect.poll(() => forced).toBe(1)
})
