import { expect, test } from '@playwright/test'

test.describe('ProxyLoadouts MVP Smoke Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/me', (route) => {
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'unauthorized' }),
      })
    })
  })
  test('homepage renders brand, navigation, and showcase search form', async ({ page }) => {
    // 1. Arrange & Act: Open public landing page
    await page.goto('/')

    // 2. Assert: Brand header and essential links are visible
    const brand = page.getByRole('banner').getByRole('link', { name: /PROXY\s*LOADOUTS/i })
    await expect(brand).toBeVisible()

    const showcaseHeading = page.getByRole('heading', { name: 'Build Manager' })
    await expect(showcaseHeading).toBeVisible()

    // 3. Assert: Public showcase search input and action button exist
    const uidInput = page.getByLabel('Игровой UID')
    await expect(uidInput).toBeVisible()

    const scanButton = page.getByRole('button', { name: 'SCAN' })
    await expect(scanButton).toBeVisible()
    await expect(scanButton).toBeEnabled()
  })

  test('validates UID input format and enables scan button on valid 10 digits', async ({ page }) => {
    await page.goto('/')

    const uidInput = page.getByLabel('Игровой UID')
    const scanButton = page.getByRole('button', { name: 'SCAN' })

    // Submitting fewer than 10 digits stays on / and displays the UID validation error
    await uidInput.fill('1504')
    await scanButton.click()
    await expect(page).toHaveURL('/')
    await expect(page.getByText('UID должен быть 10 цифр и начинаться с 10, 13, 15 или 17')).toBeVisible()

    // Typing a valid 10-digit UID clears the error and navigates to /showcase
    await uidInput.fill('1504687050')
    await expect(page.getByText('UID должен быть 10 цифр и начинаться с 10, 13, 15 или 17')).not.toBeVisible()

    await scanButton.click()
    await expect(page).toHaveURL(/\/showcase\?uid=1504687050/)
  })

  test('unauthenticated user is redirected to login when accessing protected pages', async ({ page }) => {
    // Attempting to visit /roster directly without session
    await page.goto('/roster')

    // Expect redirect to /login
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'ProxyLoadouts' })).toBeVisible()
    await expect(page.getByRole('link', { name: /^(Войти|Log In)$/i })).toBeVisible()
  })

  test('shows how to scan, save builds and assemble a squad', async ({ page }) => {
    await page.goto('/')
    const guide = page.getByRole('region', { name: 'С чего начать' })
    await expect(guide.getByRole('heading', { name: 'Откройте витрину' })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Сохраните сборку' })).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'Соберите отряд' })).toBeVisible()
    await guide.getByRole('link', { name: 'Подробнее о проекте' }).click()
    await expect(page).toHaveURL('/about')
  })

  test('renders 404 not found page with ZZZ terminal for unknown routes', async ({ page }) => {
    await page.goto('/unknown-hollow-sector')

    // 404 heading and status indicators are visible
    await expect(page.getByRole('heading', { name: 'Сектор не найден' })).toBeVisible()
    await expect(page.getByText('HTTP 404')).toBeVisible()
    await expect(page.getByText('/unknown-hollow-sector')).toBeVisible()

    // Primary action returns to home
    const homeButton = page.getByRole('link', { name: 'Вернуться на базу' })
    await expect(homeButton).toBeVisible()
    await homeButton.click()
    await expect(page).toHaveURL('/')
  })
})
