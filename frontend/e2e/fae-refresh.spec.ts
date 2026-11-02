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
const rating = (rank: number): FaeRating => ({ status: 'live', outdated: false, rank, rank_of: 10000 })

test('refresh publishes the completed FAE assessment before reconciling saved builds', async ({ page }) => {
  let completeFresh: () => void = () => {}
  const freshGate = new Promise<void>((resolve) => { completeFresh = resolve })
  let freshCompleted = false
  const buildReads: boolean[] = []
  const rosterReads: boolean[] = []
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let body: unknown = {}
    if (url.pathname.endsWith('/auth/me')) {
      body = { user: { id: 'fae-user', username: 'Tester', discord_id: '1' }, accounts: [account] }
    } else if (url.pathname.endsWith('/fae')) {
      if (url.searchParams.get('fresh') === 'true') {
        await freshGate
        freshCompleted = true
      }
      body = { uid, agents: { '1011': rating(freshCompleted ? 1839 : 2796) }, fetched_at: showcase.fetched_at }
    } else if (url.pathname.endsWith('/roster')) {
      rosterReads.push(freshCompleted)
      body = { owner: { uid, nickname: 'Tester', region: 'Europe' }, builds: [], teams: [], is_public_roster: false }
    } else if (url.pathname.endsWith('/builds')) {
      buildReads.push(freshCompleted)
      body = []
    } else if (url.pathname.endsWith(`/showcase/${uid}`)) {
      body = showcase
    }
    await route.fulfill({ json: body })
  })
  await page.goto(`/showcase?uid=${uid}`)
  await expect(page.getByTestId('fae-badge-live')).toContainText(/#2\s796/, { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
  const initialBuildReads = buildReads.length
  const initialRosterReads = rosterReads.length
  const refresh = page.getByRole('button', { name: 'Обновить данные витрины' })
  await refresh.click()
  await expect(refresh).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByTestId('fae-badge-loading')).toBeVisible()
  expect(buildReads.slice(initialBuildReads)).toEqual([])
  expect(rosterReads.slice(initialRosterReads)).toEqual([])
  completeFresh()
  await expect(page.getByTestId('fae-badge-live')).toContainText(/#1\s839/)
  await expect(refresh).toHaveAttribute('aria-busy', 'false')
  await expect.poll(() => buildReads.slice(initialBuildReads)).toEqual([true])
  await expect.poll(() => rosterReads.slice(initialRosterReads)).toEqual([true])
})

test('failed assessment retains the previous rank and a later scan retries successfully', async ({ page }) => {
  let forcedReads = 0
  let passiveReads = 0
  let buildReads = 0
  let rosterReads = 0
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url())
    let body: unknown = {}
    if (url.pathname.endsWith('/auth/me')) {
      body = { user: { id: 'fae-user', username: 'Tester', discord_id: '1' }, accounts: [account] }
    } else if (url.pathname.endsWith('/fae')) {
      if (url.searchParams.get('fresh') === 'true') {
        forcedReads++
        if (forcedReads === 1) {
          await route.fulfill({ status: 502, json: { error: 'FAE unavailable' } })
          return
        }
      } else {
        passiveReads++
      }
      body = { uid, agents: { '1011': rating(forcedReads > 1 ? 1839 : 2796) }, fetched_at: showcase.fetched_at }
    } else if (url.pathname.endsWith('/roster')) {
      rosterReads++
      body = { owner: { uid, nickname: 'Tester', region: 'Europe' }, builds: [], teams: [], is_public_roster: false }
    } else if (url.pathname.endsWith('/builds')) {
      buildReads++
      body = []
    } else if (url.pathname.endsWith(`/showcase/${uid}`)) {
      body = showcase
    }
    await route.fulfill({ json: body })
  })
  await page.goto(`/showcase?uid=${uid}`)
  await expect(page.getByTestId('fae-badge-live')).toContainText(/#2\s796/, { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
  expect(forcedReads).toBe(0)
  expect(passiveReads).toBeGreaterThan(0)
  const initialBuildReads = buildReads
  const initialRosterReads = rosterReads
  const refresh = page.getByRole('button', { name: 'Обновить данные витрины' })
  await refresh.click()
  await expect(page.getByText('Не удалось обновить рейтинг FAE для UID 1504687050. Попробуйте обновить витрину ещё раз.')).toBeVisible()
  await expect(page.getByTestId('fae-badge-live')).toContainText(/#2\s796/)
  await expect(refresh).toHaveAttribute('aria-busy', 'false')
  expect(buildReads).toBe(initialBuildReads)
  expect(rosterReads).toBe(initialRosterReads)
  expect(forcedReads).toBe(1)
  await page.getByRole('textbox', { name: 'Игровой UID' }).press('Enter')
  await expect(page.getByTestId('fae-badge-live')).toContainText(/#1\s839/)
  expect(forcedReads).toBe(2)
  await expect.poll(() => buildReads).toBe(initialBuildReads + 1)
})
