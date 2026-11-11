import { expect, test } from '@playwright/test'

const SCRATCH_DIR = '/Users/kirin/.gemini/antigravity/brain/8e6a494f-a257-448b-8a45-6381c153bee9/scratch'
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
      slot_number: 1,
      build: mockBuild,
    },
  ],
}

test.describe('Note Dialog Specs', () => {
  test('1. /teams desktop: note button opens dialog, Ctrl+Enter saves new text via PATCH and closes', async ({
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

    const noteButton = page.getByRole('button', { name: 'Заметка' })
    await expect(noteButton).toBeVisible()

    await noteButton.click()

    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()

    const textarea = dialog.locator('textarea')
    await expect(textarea).toHaveValue('Ice team burst rotation')

    const newText = 'Updated ice team rotation and freeze window'
    await textarea.fill(newText)

    if (SHOULD_SCREENSHOT) {
      await page.screenshot({ path: `${SCRATCH_DIR}/notes-teams-desktop.png` })
    }

    let patchRequestBody: any = null
    await page.route('**/api/v1/teams/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        patchRequestBody = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockTeamSummary,
            team: {
              ...mockTeamSummary.team,
              description: newText,
            },
          }),
        })
      } else {
        await route.continue()
      }
    })

    await textarea.press('ControlOrMeta+Enter')

    await expect.poll(() => patchRequestBody).toEqual({ description: newText })
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

    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()
    await dialog.evaluate((el) => Promise.all(el.getAnimations().map((a) => a.finished)))

    if (SHOULD_SCREENSHOT) {
      await page.screenshot({ path: `${SCRATCH_DIR}/notes-teams-mobile.png` })
    }

    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    if (box) {
      // Bottom edge should align with bottom of viewport (740px) within 2px
      expect(Math.abs(box.y + box.height - 740)).toBeLessThanOrEqual(2)
      // Width should be full viewport width (375px)
      expect(Math.round(box.width)).toBe(375)
    }
  })

  test('3. /roster page: toolbar note button, clear note, Save sends description: null', async ({
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
    await page.route('**/api/v1/builds?game_account_id=*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([mockBuild]),
      }),
    )

    await page.goto('/roster')

    const desktopToolbar = page.locator('.sm\\:flex.items-center').first()
    const noteButton = desktopToolbar.getByRole('button', { name: 'Заметка' })
    await expect(noteButton).toBeVisible()

    if (SHOULD_SCREENSHOT) {
      await noteButton.screenshot({ path: `${SCRATCH_DIR}/notes-roster-toolbar.png` })
    }

    await noteButton.click()

    const dialog = page.locator('[data-slot="dialog-content"]')
    await expect(dialog).toBeVisible()

    const textarea = dialog.locator('textarea')
    await expect(textarea).toHaveValue('Main DPS ice tactics')
    await textarea.fill('')

    let updateBuildBody: any = null
    await page.route('**/api/v1/builds/*', async (route) => {
      const method = route.request().method()
      if (method === 'PATCH' || method === 'PUT') {
        updateBuildBody = route.request().postDataJSON()
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ...mockBuild,
            description: null,
          }),
        })
      } else {
        await route.continue()
      }
    })

    const saveButton = dialog.getByRole('button', { name: 'Сохранить' })
    await saveButton.click()

    await expect.poll(() => updateBuildBody?.description).toBeNull()
    await expect(dialog).toBeHidden()

    // Mobile toolbar screenshot check
    await page.setViewportSize({ width: 375, height: 740 })
    const mobileToolbar = page.locator('.sm\\:hidden.space-y-2').first()
    await expect(mobileToolbar).toBeVisible()

    if (SHOULD_SCREENSHOT) {
      await mobileToolbar.screenshot({ path: `${SCRATCH_DIR}/notes-roster-mobile.png` })
    }
  })
})
