import { expect, test } from '@playwright/test'

const mockUser = {
  id: 'user-uuid-1',
  discord_id: '123456789',
  username: 'Kirin',
  avatar_url: null,
  created_at: '2026-01-01T00:00:00Z',
}

const mockAccount = {
  id: 'acc-uuid-1',
  uid: '1504687050',
  region: 'Europe' as const,
  created_at: '2026-01-01T00:00:00Z',
}

const mockTeamSummary = {
  team: {
    id: 'team-uuid-1',
    game_account_id: 'acc-uuid-1',
    name: 'Victoria Housekeeping',
    description: 'Ice team burst rotation',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T12:00:00Z',
  },
  report: {
    is_valid: true,
    errors: [],
  },
  members: [
    {
      slot_number: 1,
      build: {
        id: 'build-uuid-1',
        game_account_id: 'acc-uuid-1',
        agent_id: 1011,
        agent_name: 'Ellen Joe',
        name: 'Main Ice DPS',
        description: null,
        weapon_uid: 'weap-1',
        disc_uids: ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'],
        build_data: {
          id: 1011,
          name: 'Ellen Joe',
          rarity: 'S' as const,
          attribute: 'Ice' as const,
          specialty: 'Attack' as const,
          level: 60,
          mindscape_cinema: 1,
          w_engine: {
            id: 1234,
            name: 'Deep Sea Visitor',
            rarity: 'S' as const,
            level: 60,
          },
          discs: [],
        },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    },
    {
      slot_number: 2,
      build: {
        id: 'build-uuid-2',
        game_account_id: 'acc-uuid-1',
        agent_id: 1021,
        agent_name: 'Lycaon',
        name: 'Stunner',
        description: null,
        weapon_uid: 'weap-2',
        disc_uids: ['d7', 'd8', 'd9', 'd10', 'd11', 'd12'],
        build_data: {
          id: 1021,
          name: 'Lycaon',
          rarity: 'S' as const,
          attribute: 'Ice' as const,
          specialty: 'Stun' as const,
          level: 60,
          mindscape_cinema: 0,
          w_engine: null,
          discs: [],
        },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    },
  ],
}

test.describe('Teams Page Characterization & Safety Net Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/builds?game_account_id=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockTeamSummary.members[0].build, mockTeamSummary.members[1].build]),
      }),
    )
  })

  test('renders prompt to link account when user has no linked accounts', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockUser, accounts: [] }),
      }),
    )
    await page.route('**/api/v1/accounts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    )

    await page.goto('/teams')

    await expect(page.getByRole('heading', { name: /ОТРЯДЫ/i })).toBeVisible()
    await expect(
      page.getByText('Привяжите игровой UID'),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Привязать UID' })).toBeVisible()
  })

  test('renders empty state when account has no saved teams', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockUser, accounts: [mockAccount] }),
      }),
    )
    await page.route('**/api/v1/accounts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockAccount]),
      }),
    )
    await page.route('**/api/v1/teams?game_account_id=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    )

    await page.goto('/teams')

    await expect(page.getByRole('heading', { name: /ОТРЯДЫ/i })).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Отрядов пока нет' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Новый отряд' }).first()).toBeVisible()
    await expect(page.getByText('Свободный слот')).not.toBeVisible()
  })

  test('renders populated team preset cards with agent slots and conflict status', async ({
    page,
  }) => {
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockUser, accounts: [mockAccount] }),
      }),
    )
    await page.route('**/api/v1/accounts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockAccount]),
      }),
    )
    await page.route('**/api/v1/teams?game_account_id=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockTeamSummary]),
      }),
    )

    await page.goto('/teams')

    // Team Card renders cleanly without noisy 'Без конфликтов' badge
    const teamCard = page.getByRole('article', { name: 'Отряд Victoria Housekeeping' })
    await expect(teamCard).toBeVisible()
    await expect(teamCard.getByText('Без конфликтов')).not.toBeVisible()
    await expect(teamCard.getByRole('heading', { level: 2, name: 'Victoria Housekeeping' })).toBeVisible()

    // Agent slots are present inside the card
    await expect(teamCard.getByTitle(/Ellen Joe/i)).toBeVisible()
    await expect(teamCard.getByTitle(/Lycaon/i)).toBeVisible()

    // Ensure no redundant empty squad slot prompt
    await expect(page.getByText('Свободный слот')).not.toBeVisible()

    // Edit link is available, but team title is plain heading (no link to detail page)
    await expect(teamCard.getByRole('link', { name: 'Редактировать отряд Victoria Housekeeping' })).toBeVisible()
    await expect(teamCard.getByRole('link', { name: 'Victoria Housekeeping', exact: true })).not.toBeVisible()
    await expect(teamCard.getByRole('link', { name: /Подробнее о команде/i })).not.toBeVisible()
  })

  test('reuses auth accounts and loads build choices only after a team slot picker opens', async ({
    page,
  }) => {
    let accountRequestCount = 0
    let buildRequestCount = 0
    await page.unroute('**/api/v1/builds?game_account_id=*')
    await page.route('**/api/v1/builds?game_account_id=*', (route) => {
      buildRequestCount += 1
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockTeamSummary.members[0].build, mockTeamSummary.members[1].build]),
      })
    })
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockUser, accounts: [mockAccount] }),
      }),
    )
    await page.route('**/api/v1/accounts', (route) => {
      accountRequestCount += 1
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockAccount]),
      })
    })
    await page.route('**/api/v1/teams?game_account_id=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockTeamSummary]),
      }),
    )

    await page.goto('/teams')

    const teamCard = page.getByRole('article', { name: 'Отряд Victoria Housekeeping' })
    await expect(teamCard).toBeVisible()
    expect(accountRequestCount).toBe(0)
    expect(buildRequestCount).toBe(0)

    await teamCard.getByRole('button', { name: /Слот 3: свободен/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect.poll(() => buildRequestCount).toBe(1)
  })

  test('can open delete confirmation dialog for a team', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockUser, accounts: [mockAccount] }),
      }),
    )
    await page.route('**/api/v1/accounts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockAccount]),
      }),
    )
    await page.route('**/api/v1/teams?game_account_id=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockTeamSummary]),
      }),
    )

    await page.goto('/teams')

    // Find delete button
    const deleteButton = page.getByRole('button', { name: 'Удалить отряд' })
    await expect(deleteButton).toBeVisible()
    await deleteButton.click()

    // Confirmation dialog appears
    await expect(
      page.getByRole('heading', { name: 'Удалить отряд «Victoria Housekeeping»?' }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Отмена' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Удалить' })).toBeVisible()

    // Click cancel closes dialog
    await page.getByRole('button', { name: 'Отмена' }).click()
    await expect(
      page.getByRole('heading', { name: 'Удалить отряд «Victoria Housekeeping»?' }),
    ).not.toBeVisible()
  })

  test('filters teams via search bar and resets filter on no matches', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockUser, accounts: [mockAccount] }),
      }),
    )
    await page.route('**/api/v1/accounts', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockAccount]),
      }),
    )
    await page.route('**/api/v1/teams?game_account_id=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockTeamSummary]),
      }),
    )

    await page.goto('/teams')

    const teamCard = page.getByRole('article', { name: 'Отряд Victoria Housekeeping' })
    await expect(teamCard).toBeVisible()

    const searchInput = page.getByPlaceholder('Название отряда или агенты…')
    await expect(searchInput).toBeVisible()

    // Search for non-matching agent
    await searchInput.fill('Anby')
    await expect(teamCard).not.toBeVisible()
    await expect(page.getByText('ничего не нашлось')).toBeVisible()

    // Click Reset button
    const resetButton = page.getByRole('button', { name: 'Сбросить фильтры' })
    await expect(resetButton).toBeVisible()
    await resetButton.click()

    // Team Card reappears
    await expect(teamCard).toBeVisible()
  })
})

