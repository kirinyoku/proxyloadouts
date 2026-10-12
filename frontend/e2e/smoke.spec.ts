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

    const showcaseHeading = page.getByRole('heading', { name: /Менеджер сборок агентов/i })
    await expect(showcaseHeading).toBeVisible()

    // 3. Assert: Public showcase search input and action button exist
    const uidInput = page.getByLabel('Игровой UID')
    await expect(uidInput).toBeVisible()

    const scanButton = page.getByRole('button', { name: 'Сканировать' })
    await expect(scanButton).toBeVisible()
    await expect(scanButton).toBeDisabled()
  })

  test('validates UID input format and enables scan button on valid 10 digits', async ({ page }) => {
    await page.goto('/')

    const uidInput = page.getByLabel('Игровой UID')
    const scanButton = page.getByRole('button', { name: 'Сканировать' })

    // Typing less than 9 digits leaves button disabled
    await uidInput.fill('1504')
    await expect(scanButton).toBeDisabled()
    await expect(page.getByText('UID должен содержать 9–10 цифр')).toBeVisible()

    // Typing 10 digits enables the scan button and submits to /showcase
    await uidInput.fill('1504687050')
    await expect(scanButton).toBeEnabled()
    await expect(page.getByText('UID должен содержать 9–10 цифр')).not.toBeVisible()

    await scanButton.click()
    await expect(page).toHaveURL(/\/showcase\?uid=1504687050/)
  })

  test('unauthenticated user is redirected to login when accessing protected pages', async ({ page }) => {
    // Attempting to visit /roster directly without session
    await page.goto('/roster')

    // Expect redirect to /login
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'ProxyLoadouts' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Войти через Discord/i })).toBeVisible()
  })

  test('renders 5-step minimalist guide for new ZZZ players including auth', async ({ page }) => {
    await page.goto('/')

    // Check 5-step process guide
    await expect(page.getByRole('heading', { name: 'Игровая витрина' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Скан по UID' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Вход через Discord' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Менеджмент сборок' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Менеджмент отрядов' })).toBeVisible()
  })
})
