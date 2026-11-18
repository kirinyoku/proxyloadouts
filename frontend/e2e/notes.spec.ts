import { expect, test } from '@playwright/test'

const NOTES_SHOTS_DIR = process.env.NOTES_SHOTS_DIR ?? 'test-results/note-modal'
const SHOULD_SCREENSHOT = process.env.NOTES_SHOTS === '1'

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

const mockBuild = {
  id: 'build-uuid-1',
  game_account_id: 'acc-uuid-1',
  agent_id: 1011,
  agent_name: 'Ellen Joe',
  name: 'Main Ice DPS',
  description: 'Main DPS ice tactics',
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
      slot_number: 3,
      build: {
        ...mockBuild,
        id: 'build-uuid-3',
        agent_id: 1131,
        agent_name: 'Soukaku',
        build_data: { ...mockBuild.build_data, id: 1131, name: 'Soukaku' },
      },
    },
    {
      slot_number: 1,
      build: mockBuild,
    },
    {
      slot_number: 2,
      build: {
        ...mockBuild,
        id: 'build-uuid-2',
        agent_id: 1141,
        agent_name: 'Lycaon',
        build_data: { ...mockBuild.build_data, id: 1141, name: 'Lycaon' },
      },
    },
  ],
}

test.describe('Note Dialog Specs', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.route(
      /\/api\/v1\/(accounts\/[^/]+\/(?:roster|teams)-share|(?:builds|teams)\/[^/]+\/share)$/,
      (route) => route.fulfill({ json: { active: false } }),
    )
  })

  test('1. /teams desktop: edit, toggle visibility, and retry after a save error', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })

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
    await page.route('**/api/v1/builds?game_account_id=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockBuild]),
      }),
    )

    await page.goto('/teams')

    await page.getByRole('button', { name: /^Слот 1:.*Main Ice DPS/ }).click()
    const inspector = page.getByRole('dialog', { name: 'Ellen Joe' })
    await inspector.getByRole('button', { name: 'Заметка' }).click()
    const buildNote = page.getByRole('dialog', { name: /заметка к сборке/i })
    await buildNote.getByRole('button', { name: 'Скопировать' }).click()
    await expect(buildNote.getByRole('button', { name: 'Скопировано' })).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(mockBuild.description)
    await buildNote.getByRole('button', { name: 'Закрыть' }).click()
    await inspector.getByRole('button', { name: 'Закрыть' }).click()

    const noteButton = page.getByRole('button', { name: 'Заметка' })
    await expect(noteButton).toBeVisible()
    await noteButton.click()

    const dialog = page.getByRole('dialog', { name: /заметка к отряду/i })
    await expect(dialog).toBeVisible()

    const textarea = dialog.getByRole('textbox')
    const visibility = dialog.getByRole('button', { name: /^(Только вы|Посетители страницы)$/ })
    const clearButton = dialog.getByRole('button', { name: 'Очистить' })
    const saveButton = dialog.getByRole('button', { name: 'Сохранить' })

    await expect(textarea).toHaveValue('Ice team burst rotation')
    await expect(visibility).toHaveAccessibleName('Только вы')
    await expect(visibility).toHaveAccessibleDescription('Показать заметку посетителям страницы')
    await expect(dialog.getByRole('radio')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: /^Вставить/ })).toHaveCount(0)
    await expect(clearButton).toHaveCount(0)
    await expect(textarea).toHaveAccessibleDescription('23 / 500')

    await textarea.fill('a'.repeat(501))
    await expect(dialog.getByRole('alert')).toHaveText('Сократите заметку до 500 символов.')
    await expect.poll(() => textarea.evaluate((field) => field.scrollHeight > field.clientHeight)).toBe(true)
    await expect(dialog.getByText('501 / 500', { exact: true })).toBeVisible()

    const newText = 'Начать с оглушения.\nУльту Эллен оставить на окно оглушения.'
    await textarea.fill(newText)
    await expect(dialog.getByRole('alert')).toHaveCount(0)

    await visibility.press('Space')
    await expect(visibility).toBeFocused()
    await expect(visibility).toHaveAccessibleName('Посетители страницы')
    await expect(visibility).toHaveAccessibleDescription('Сделать заметку личной')
    await visibility.press('Space')
    await expect(visibility).toHaveAccessibleName('Только вы')
    await visibility.click()
    await expect(visibility).toHaveAccessibleName('Посетители страницы')

    if (SHOULD_SCREENSHOT) {
      await textarea.focus()
      await dialog.screenshot({
        path: `${NOTES_SHOTS_DIR}/notes-teams-desktop.png`,
        animations: 'disabled',
      })
    }

    let finishFailedSave: (() => void) | undefined
    const pendingFailure = new Promise<void>((resolve) => {
      finishFailedSave = resolve
    })
    const patchRequests: unknown[] = []
    await page.route('**/api/v1/teams/*', async (route) => {
      if (route.request().method() !== 'PATCH') {
        await route.continue()
        return
      }
      patchRequests.push(route.request().postDataJSON())
      if (patchRequests.length === 1) {
        await pendingFailure
        await route.fulfill({ status: 500, json: { error: 'Save failed' } })
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockTeamSummary,
            team: {
              ...mockTeamSummary.team,
              description: newText,
              is_note_public: true,
            },
          }),
        })
      }
    })

    await textarea.press('ControlOrMeta+Enter')
    try {
      await expect.poll(() => patchRequests).toEqual([
        { description: newText, is_note_public: true },
      ])
      await expect(visibility).toBeDisabled()
      await expect(saveButton).toBeDisabled()
      await expect(textarea).not.toBeEditable()
    } finally {
      finishFailedSave?.()
    }

    await expect(dialog.getByRole('alert')).toContainText(/не удалось сохранить/i)
    await expect(visibility).toBeEnabled()
    await expect(visibility).toHaveAccessibleName('Посетители страницы')
    await expect(textarea).toBeEditable()
    await expect(textarea).toHaveValue(newText)

    await textarea.press('ControlOrMeta+Enter')
    await expect.poll(() => patchRequests).toEqual([
      { description: newText, is_note_public: true },
      { description: newText, is_note_public: true },
    ])
    await expect(dialog).toBeHidden()
  })

  test('2. /teams mobile: bottom sheet geometry matches viewport width and bottom', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 740 })

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
    await page.route('**/api/v1/builds?game_account_id=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockBuild]),
      }),
    )

    await page.goto('/teams')

    const noteButton = page.getByRole('button', { name: 'Заметка' })
    await expect(noteButton).toBeVisible()
    await noteButton.click()

    const dialog = page.getByRole('dialog', { name: /заметка к отряду/i })
    await expect(dialog).toBeVisible()
    await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))

    const textarea = dialog.getByRole('textbox')
    const close = dialog.getByRole('button', { name: 'Закрыть' })
    const save = dialog.getByRole('button', { name: 'Сохранить' })
    const visibility = dialog.getByRole('button', { name: 'Только вы' })
    await expect(dialog).toBeFocused()
    await expect(textarea).not.toBeFocused()

    if (SHOULD_SCREENSHOT) {
      await page.screenshot({
        path: `${NOTES_SHOTS_DIR}/notes-teams-mobile.png`,
        animations: 'disabled',
      })
    }

    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      expect(Math.abs(box.y + box.height - 740)).toBeLessThanOrEqual(2)
      expect(Math.round(box.width)).toBe(375)
    }

    await page.setViewportSize({ width: 320, height: 460 })
    await textarea.click()
    await expect(textarea).toBeFocused()

    await page.evaluate(() => {
      const viewport = window.visualViewport
      if (!viewport) throw new Error('Visual viewport unavailable')
      Object.defineProperty(viewport, 'height', { value: 220 })
      viewport.dispatchEvent(new Event('resize'))
    })

    await expect(close).toBeInViewport({ ratio: 1 })
    await expect.poll(async () => {
      const bounds = await save.boundingBox()
      return bounds && bounds.y + bounds.height
    }).toBeLessThanOrEqual(220)

    await expect(save).toBeInViewport({ ratio: 1 })
    await expect(visibility).toBeInViewport({ ratio: 1 })
  })

  test('3. /roster page: visibility persists after Save, dirty discard confirmation, and clearing saves null', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    let build = { ...mockBuild, is_note_public: false }

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
    await page.route('**/api/v1/builds?game_account_id=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([build]),
      }),
    )

    await page.goto('/roster')

    const desktopToolbar = page.locator('.sm\\:flex.items-center').first()
    const noteButton = desktopToolbar.getByRole('button', { name: 'Заметка' })
    const noteIndicator = noteButton.locator('[data-slot="status-indicator"]')
    await expect(noteButton).toBeVisible()
    await expect(noteIndicator).toBeVisible()

    if (SHOULD_SCREENSHOT) {
      await noteButton.screenshot({ path: `${NOTES_SHOTS_DIR}/notes-roster-toolbar.png` })
      await page.screenshot({ path: `${NOTES_SHOTS_DIR}/roster-page.png`, animations: 'disabled' })
      await desktopToolbar.getByRole('button', { name: 'Удалить эту сборку' }).click()
      await page.getByRole('alertdialog').screenshot({ path: `${NOTES_SHOTS_DIR}/roster-dialog.png`, animations: 'disabled' })
      await page.getByRole('alertdialog').getByRole('button', { name: 'Отмена' }).click()
    }

    await noteButton.click()

    const dialog = page.getByRole('dialog', { name: /заметка к сборке/i })
    await expect(dialog).toBeVisible()

    const textarea = dialog.getByRole('textbox')
    await expect(textarea).toHaveValue('Main DPS ice tactics')

    if (SHOULD_SCREENSHOT) {
      await dialog.screenshot({
        path: `${NOTES_SHOTS_DIR}/notes-build-desktop.png`,
        animations: 'disabled',
      })
      await page.screenshot({ path: `${NOTES_SHOTS_DIR}/notes-in-roster.png`, animations: 'disabled' })
      await page.evaluate(() => {
        document.documentElement.setAttribute('data-palette', 'champagne')
        document.documentElement.setAttribute('data-corners', 'sharp')
      })
      await dialog.screenshot({
        path: `${NOTES_SHOTS_DIR}/notes-champagne-sharp.png`,
        animations: 'disabled',
      })
      await page.evaluate(() => {
        document.documentElement.removeAttribute('data-palette')
        document.documentElement.removeAttribute('data-corners')
      })
    }

    const buildUpdates: unknown[] = []
    await page.route('**/api/v1/builds/*', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH' || method === 'PUT') {
        const updateBuildBody = route.request().postDataJSON()
        buildUpdates.push(updateBuildBody)
        build = { ...build, ...updateBuildBody }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(build),
        })
      } else {
        await route.continue()
      }
    })

    const saveButton = dialog.getByRole('button', { name: 'Сохранить' })
    const visibility = dialog.getByRole('button', { name: /^(Только вы|Посетители страницы)$/ })
    await expect(visibility).toHaveAccessibleName('Только вы')

    await visibility.click()
    await expect(visibility).toHaveAccessibleName('Посетители страницы')
    await saveButton.click()

    await expect.poll(() => buildUpdates).toEqual([{ is_note_public: true }])
    await expect(dialog).toBeHidden()

    await noteButton.click()
    await expect(visibility).toHaveAccessibleName('Посетители страницы')

    await textarea.fill('Dirty edited draft')
    await page.keyboard.press('Escape')
    await expect(dialog.getByText(/несохранённые изменения будут потеряны/i)).toBeVisible()
    const keepEditing = dialog.getByRole('button', { name: 'Продолжить' })
    const discard = dialog.getByRole('button', { name: 'Сбросить' })
    await expect(keepEditing).toBeVisible()
    await expect(keepEditing).toBeFocused()
    await expect(discard).toBeVisible()

    await keepEditing.click()
    await expect(dialog).toBeVisible()
    await expect(textarea).toHaveValue('Dirty edited draft')
    await expect(textarea).toBeFocused()

    await page.keyboard.press('Escape')
    await discard.click()
    await expect(dialog).toBeHidden()
    expect(buildUpdates).toEqual([{ is_note_public: true }])

    await noteButton.click()
    await expect(textarea).toHaveValue('Main DPS ice tactics')
    await visibility.click()
    await expect(visibility).toHaveAccessibleName('Только вы')
    await saveButton.click()
    await expect.poll(() => buildUpdates).toEqual([{ is_note_public: true }, { is_note_public: false }])
    await expect(dialog).toBeHidden()

    await noteButton.click()
    await expect(visibility).toHaveAccessibleName('Только вы')

    await textarea.fill('')
    await expect(textarea).toHaveAccessibleDescription('0 / 500')

    await saveButton.click()
    await expect.poll(() => buildUpdates).toEqual([
      { is_note_public: true },
      { is_note_public: false },
      { description: null },
    ])
    await expect(dialog).toBeHidden()
    await expect(noteIndicator).toHaveCount(0)

    await page.setViewportSize({ width: 375, height: 740 })
    const mobileToolbar = page.locator('.sm\\:hidden.space-y-2').first()
    await expect(mobileToolbar).toBeVisible()

    if (SHOULD_SCREENSHOT) {
      await mobileToolbar.screenshot({ path: `${NOTES_SHOTS_DIR}/notes-roster-mobile.png` })
    }
  })

  test('4. public build: visitors can read structured blocks and return to the trigger on Escape', async ({
    page,
  }) => {
    const description =
      '[BURST] Freeze target before burst\n\nMiyabi → Soukaku → Ellen\n\nKey reminders:\n- Build anomaly gauge\n- Swap on EX special'

    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 401 }))
    await page.route(`**/api/v1/public/builds/${mockBuild.id}*`, (route) =>
      route.fulfill({
        json: {
          build: { ...mockBuild, description, is_note_public: true },
          owner: {
            uid: mockAccount.uid,
            region: mockAccount.region,
            nickname: mockUser.username,
          },
        },
      }),
    )

    await page.goto(`/b/${mockBuild.id}`)
    const trigger = page.getByRole('button', { name: 'Заметка' })
    await trigger.click()

    const dialog = page.getByRole('dialog', { name: /заметка к сборке/i })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('[BURST]')).toBeVisible()
    await expect(dialog.getByText('Freeze target before burst')).toBeVisible()
    await expect(dialog.getByText('Miyabi')).toBeVisible()
    await expect(dialog.getByText('Soukaku')).toBeVisible()
    await expect(dialog.getByRole('textbox')).toHaveCount(0)

    await expect(dialog.getByRole('button', { name: 'Скопировать' })).toHaveCount(0)

    if (SHOULD_SCREENSHOT) {
      await dialog.screenshot({
        path: `${NOTES_SHOTS_DIR}/notes-public-desktop.png`,
        animations: 'disabled',
      })
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('5. public squad: its note and member build notes omit the copy action', async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => route.fulfill({ status: 401 }))
    await page.route(`**/api/v1/public/teams/${mockTeamSummary.team.id}*`, (route) =>
      route.fulfill({
        json: {
          ...mockTeamSummary,
          owner: { uid: mockAccount.uid, region: mockAccount.region, nickname: mockUser.username },
        },
      }),
    )

    await page.goto(`/t/${mockTeamSummary.team.id}`)
    await page.getByRole('button', { name: 'Заметка' }).click()
    const squadNote = page.getByRole('dialog', { name: /заметка к отряду/i })
    await expect(squadNote.getByText(mockTeamSummary.team.description)).toBeVisible()
    await expect(squadNote.getByRole('button', { name: 'Скопировать' })).toHaveCount(0)
    await squadNote.getByRole('button', { name: 'Закрыть' }).click()

    await page.getByRole('button', { name: /^Слот 1:.*Main Ice DPS/ }).click()
    await page.getByRole('dialog', { name: 'Ellen Joe' }).getByRole('button', { name: 'Заметка' }).click()
    const buildNote = page.getByRole('dialog', { name: /заметка к сборке/i })
    await expect(buildNote.getByText(mockBuild.description)).toBeVisible()
    await expect(buildNote.getByRole('button', { name: 'Скопировать' })).toHaveCount(0)
  })
})
