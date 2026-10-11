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

const mockEllenBuild = {
  id: 'build-ellen',
  game_account_id: 'acc-uuid-1',
  agent_id: 1191,
  agent_name: 'Ellen Joe',
  name: 'Shark Frostbite',
  description: 'Main Ice DPS',
  weapon_uid: 'weap-ellen',
  weapon_id: 1234,
  disc_uids: ['disc-1', 'disc-2', 'disc-3', 'disc-4', 'disc-5', 'disc-6'],
  build_data: {
    id: 1191,
    name: 'Ellen Joe',
    rarity: 'S' as const,
    attribute: 'Ice' as const,
    attribute_name: 'Лёд',
    specialty: 'Attack' as const,
    specialty_name: 'Атака',
    level: 60,
    mindscape_cinema: 1,
    w_engine: {
      id: 1234,
      name: 'Deep Sea Visitor',
      modification: 1,
      rarity: 'S' as const,
      icon_url: 'https://enka.network/ui/zzz/weapon.png',
    },
    drive_discs: {
      slots: [],
      set_bonuses: [
        {
          set: { id: 101, name: 'Полярный металл' },
          count: 4,
          effects: [],
        },
        {
          set: { id: 102, name: 'Дятел-электро' },
          count: 2,
          effects: [],
        },
      ],
    },
  },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockLycaonBuild = {
  id: 'build-lycaon',
  game_account_id: 'acc-uuid-1',
  agent_id: 1141,
  agent_name: 'Lycaon',
  name: 'Butler Stun',
  description: 'Stunner',
  weapon_uid: 'weap-lycaon',
  weapon_id: 1235,
  disc_uids: ['disc-7', 'disc-8', 'disc-9', 'disc-10', 'disc-11', 'disc-12'],
  build_data: {
    id: 1141,
    name: 'Lycaon',
    rarity: 'S' as const,
    attribute: 'Ice' as const,
    attribute_name: 'Лёд',
    specialty: 'Stun' as const,
    specialty_name: 'Оглушение',
    level: 60,
    mindscape_cinema: 0,
    w_engine: {
      id: 1235,
      name: 'The Restrained',
      modification: 1,
      rarity: 'S' as const,
      icon_url: 'https://enka.network/ui/zzz/weapon2.png',
    },
    drive_discs: {
      slots: [],
      set_bonuses: [
        {
          set: { id: 103, name: 'Шокстар-диско' },
          count: 4,
          effects: [],
        },
      ],
    },
  },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockCorinConflictBuild = {
  id: 'build-corin-conflict',
  game_account_id: 'acc-uuid-1',
  agent_id: 1061,
  agent_name: 'Corin',
  name: 'Housekeeper Saw',
  description: 'Physical Attacker',
  weapon_uid: 'weap-ellen',
  weapon_id: 1234,
  disc_uids: ['disc-13', 'disc-14', 'disc-15', 'disc-16', 'disc-17', 'disc-18'],
  build_data: {
    id: 1061,
    name: 'Corin',
    rarity: 'A' as const,
    attribute: 'Physical' as const,
    attribute_name: 'Физический',
    specialty: 'Attack' as const,
    specialty_name: 'Атака',
    level: 50,
    mindscape_cinema: 6,
    w_engine: {
      id: 1234,
      name: 'Deep Sea Visitor',
      modification: 1,
      rarity: 'S' as const,
      icon_url: 'https://enka.network/ui/zzz/weapon.png',
    },
    drive_discs: {
      slots: [],
      set_bonuses: [],
    },
  },
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function setupBaseRoutes(page: any, builds: any[] = [mockEllenBuild, mockLycaonBuild]) {
  return Promise.all([
    page.route('**/api/v1/auth/me', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: mockUser, accounts: [mockAccount] }),
      }),
    ),
    page.route('**/api/v1/accounts', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockAccount]),
      }),
    ),
    page.route('**/api/v1/builds?game_account_id=*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(builds),
      }),
    ),
    // Validation is a GET carrying ?build_ids=..., so the pattern must allow a
    // query string — a bare path glob would not match it.
    page.route('**/api/v1/teams/validate?*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ is_valid: true, errors: [] }),
      }),
    ),
    // The builder reads the per-account team limit from a dedicated count
    // endpoint rather than downloading the whole team list.
    page.route('**/api/v1/teams/count?*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 0 }),
      }),
    ),
    page.route('**/api/v1/teams?game_account_id=*', (route: any) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    ),
  ])
}

test.describe('Team Builder (/teams/new) Minimalist E2E Suite', () => {
  test('renders tactical empty slots cleanly', async ({ page }) => {
    await setupBaseRoutes(page)
    await page.goto('/teams/new')

    await expect(page.getByRole('heading', { name: /Новый отряд/i, level: 1 })).toBeVisible()
    await expect(page.getByText('Слот 1').first()).toBeVisible()
    await expect(page.getByText('Слот 2').first()).toBeVisible()
    await expect(page.getByText('Слот 3').first()).toBeVisible()

    // 3 empty slot buttons
    await expect(page.getByRole('button', { name: /Слот 1: свободен/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Слот 2: свободен/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Слот 3: свободен/i })).toBeVisible()

    // Save button disabled initially
    const saveButton = page.getByRole('button', { name: 'Сохранить отряд' })
    await expect(saveButton).toBeDisabled()
  })

  test('opens build picker with attribute filter tabs and assigns agent to slot 1P', async ({
    page,
  }) => {
    await setupBaseRoutes(page)
    await page.goto('/teams/new')

    // Click slot 1P
    await page.getByRole('button', { name: /Слот 1: свободен/i }).click()

    // Dialog is visible
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('heading', { name: /Выбор агента в отряд/i })).toBeVisible()

    // Attribute filters exist
    await expect(dialog.getByRole('button', { name: /Лёд/i })).toBeVisible()

    // Pick Ellen Joe
    await dialog.getByRole('option', { name: /Shark Frostbite/i }).click()

    // Slot 1 now displays build name and accessible remove button in top right
    await expect(page.getByText('Shark Frostbite')).toBeVisible()
    await expect(page.getByRole('button', { name: /Убрать Ellen Joe из слота 1/i })).toBeVisible()
  })

  test('clearing a slot removes the build and restores empty slot', async ({ page }) => {
    await setupBaseRoutes(page)
    await page.goto('/teams/new')

    // Pick Ellen in Slot 1
    await page.getByRole('button', { name: /Слот 1: свободен/i }).click()
    await page.getByRole('option', { name: /Shark Frostbite/i }).click()

    await expect(page.getByText('Shark Frostbite')).toBeVisible()

    // Click top-right remove button
    await page.getByRole('button', { name: /Убрать Ellen Joe из слота 1/i }).click()

    // Slot returns to empty
    await expect(page.getByRole('button', { name: /Слот 1: свободен/i })).toBeVisible()
  })

  test('clicking an assigned slot opens picker and allows replacing the build', async ({ page }) => {
    await setupBaseRoutes(page)
    await page.goto('/teams/new')

    // Pick Ellen in Slot 1
    await page.getByRole('button', { name: /Слот 1: свободен/i }).click()
    await page.getByRole('option', { name: /Shark Frostbite/i }).click()
    await expect(page.getByText('Shark Frostbite')).toBeVisible()

    // Ensure swap buttons are not present in minimalist UI
    await expect(page.getByRole('button', { name: '1P ⇄ 2P' })).not.toBeVisible()

    // Click on the assigned slot card to replace
    await page.getByRole('button', { name: /Слот 1:.*Shark Frostbite/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Replace with Lycaon
    await dialog.getByRole('option', { name: /Butler Stun/i }).click()

    // Slot 1 now has Butler Stun
    await expect(page.getByText('Butler Stun')).toBeVisible()
    await expect(page.getByRole('button', { name: /Убрать Lycaon из слота 1/i })).toBeVisible()
  })

  test('disables conflicting builds in picker and shows collision badges', async ({
    page,
  }) => {
    await setupBaseRoutes(page, [mockEllenBuild, mockCorinConflictBuild])

    await page.goto('/teams/new')

    // Pick Ellen in Slot 1
    await page.getByRole('button', { name: /Слот 1: свободен/i }).click()
    await page.getByRole('option', { name: /Shark Frostbite/i }).click()

    // Open picker for Slot 2
    await page.getByRole('button', { name: /Слот 2: свободен/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Corin option must be disabled due to weapon collision with Ellen
    const corinOption = dialog.getByRole('option', { name: /Housekeeper Saw/i })
    await expect(corinOption).toBeDisabled()
    // The badge is rendered twice (mobile + desktop layout variants); the
    // first match is the mobile-only copy hidden at this viewport.
    const corinBadge = corinOption.getByText('КОНФЛИКТ').last()
    await expect(corinBadge).toBeVisible()

    // Hovering the conflict badge immediately reveals the styled tooltip without the native 2s delay
    await corinBadge.hover()
    await expect(page.getByText(/Амплификатор «Deep Sea Visitor» занят агентом Ellen Joe/i)).toBeVisible()

    // Ellen option in picker is also disabled (already in team)
    const ellenOption = dialog.getByRole('option', { name: /Shark Frostbite/i })
    await expect(ellenOption).toBeDisabled()
    await expect(ellenOption.getByText('В отряде').last()).toBeVisible()

    // Hide conflicting toggle button is available
    const hideBtn = dialog.getByRole('button', { name: /Скрыть конфликты/i })
    await expect(hideBtn).toBeVisible()
    await hideBtn.click()

    // When hidden, conflicting builds are filtered out
    await expect(corinOption).not.toBeVisible()

    // Conflict toggle should NOT display the "Сбросить" button
    const resetBtn = dialog.getByRole('button', { name: /Сбросить/i })
    await expect(resetBtn).not.toBeVisible()

    // Click "Показать все" restores conflicting builds
    const showAllBtn = dialog.getByRole('button', { name: /Показать все/i })
    await expect(showAllBtn).toBeVisible()
    await showAllBtn.click()
    await expect(dialog.getByRole('option', { name: /Housekeeper Saw/i })).toBeVisible()
  })

  test('displays conflict warning and prevents saving when loading existing conflicting team', async ({
    page,
  }) => {
    await setupBaseRoutes(page, [mockEllenBuild, mockCorinConflictBuild])

    await page.route('**/api/v1/teams/team-uuid-conflict*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          team: {
            id: 'team-uuid-conflict',
            game_account_id: 'acc-uuid-1',
            name: 'Conflict Test Team',
            description: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
          report: {
            is_valid: false,
            errors: [
              {
                code: 'WEAPON_REUSE',
                message: 'Один и тот же W-Engine используется в двух разных билдах отряда.',
                conflicting_builds: ['build-ellen', 'build-corin-conflict'],
              },
            ],
          },
          members: [
            { slot_number: 1, build: mockEllenBuild },
            { slot_number: 2, build: mockCorinConflictBuild },
          ],
        }),
      }),
    )

    await page.route('**/api/v1/teams/validate?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          is_valid: false,
          errors: [
            {
              code: 'WEAPON_REUSE',
              message: 'Один и тот же W-Engine используется в двух разных билдах отряда.',
              conflicting_builds: ['build-ellen', 'build-corin-conflict'],
            },
          ],
        }),
      }),
    )

    await page.goto('/teams/team-uuid-conflict/edit')

    // Conflict warnings must appear in ConflictMatrix
    await expect(page.getByText('Амплификатор занят в двух сборках').first()).toBeVisible()
    await expect(page.getByText('Shark Frostbite ⇄ Housekeeper Saw')).toBeVisible()

    // Save button must remain disabled due to conflict
    const saveButton = page.getByRole('button', { name: 'Сохранить изменения' })
    await expect(saveButton).toBeDisabled()
    await expect(page.getByText('Уберите коллизии дисков и амплификаторов')).toBeVisible()
  })

  test('prompts confirmation dialog when resetting dirty team draft', async ({ page }) => {
    await setupBaseRoutes(page)
    await page.goto('/teams/new')

    // Enter name
    await page.getByLabel('Название отряда').fill('Dirty Draft')

    // Click "Очистить черновик"
    await page.getByRole('button', { name: 'Очистить черновик' }).click()

    // Alert dialog must be displayed
    await expect(
      page.getByRole('heading', { name: 'Сбросить черновик отряда?' }),
    ).toBeVisible()

    // Cancel reset
    await page.getByRole('button', { name: 'Продолжить правки' }).click()
    await expect(page.getByLabel('Название отряда')).toHaveValue('Dirty Draft')

    // Confirm reset
    await page.getByRole('button', { name: 'Очистить черновик' }).click()
    await page.getByRole('button', { name: 'Сбросить' }).click()
    await expect(page.getByLabel('Название отряда')).toHaveValue('')
  })

  test('auto-generates team name from agents when user leaves name empty and saves successfully', async ({
    page,
  }) => {
    let capturedBody: { name?: string; build_ids?: string[] } | null = null
    await setupBaseRoutes(page, [mockEllenBuild, mockLycaonBuild])

    await page.route('**/api/v1/teams', async (route) => {
      if (route.request().method() === 'POST') {
        capturedBody = JSON.parse(route.request().postData() || '{}')
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'team-new-uuid',
            game_account_id: 'acc-uuid-1',
            name: capturedBody?.name,
            description: null,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          }),
        })
        return
      }
      await route.continue()
    })

    await page.goto('/teams/new')

    // Pick Ellen in Slot 1
    await page.getByRole('button', { name: /Слот 1: свободен/i }).click()
    await page.getByRole('option', { name: /Shark Frostbite/i }).click()

    // Pick Lycaon in Slot 2
    await page.getByRole('button', { name: /Слот 2: свободен/i }).click()
    await page.getByRole('option', { name: /Butler Stun/i }).click()

    // Verify auto-generated name in placeholder and squad header
    await expect(page.getByPlaceholder('Ellen Joe/Lycaon')).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'Ellen Joe/Lycaon' })).toBeVisible()

    // Save button must be enabled without typing a custom name
    const saveButton = page.getByRole('button', { name: 'Сохранить отряд' })
    await expect(saveButton).toBeEnabled()

    // Click Save
    await saveButton.click()

    // Verify POST payload contains auto-generated name
    expect(capturedBody).not.toBeNull()
    expect(capturedBody?.name).toBe('Ellen Joe/Lycaon')
    await expect(page).toHaveURL('/teams')
  })
})
