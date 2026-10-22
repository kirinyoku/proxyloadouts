import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { LoginPage } from './LoginPage'
import ru from '@/i18n/locales/ru'
import en from '@/i18n/locales/en'

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part]
    } else {
      return path
    }
  }
  return typeof current === 'string' ? current : path
}

let currentLocale: 'ru' | 'en' = 'ru'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => {
      const localeObj = currentLocale === 'ru' ? ru : en
      const val = getNestedValue(localeObj as unknown as Record<string, unknown>, key)
      return val === key && defaultVal ? defaultVal : val
    },
    i18n: { language: currentLocale },
  }),
}))

let mockMeData: { user: { id: string } } | null = null
let mockIsPending = false

vi.mock('@/api/hooks', () => ({
  useMe: () => ({
    data: mockMeData,
    isPending: mockIsPending,
  }),
}))

describe('LoginPage', () => {
  const renderLoginHtml = (initialEntries = ['/login']) => {
    return renderToString(
      <MemoryRouter initialEntries={initialEntries}>
        <LoginPage />
      </MemoryRouter>
    )
  }

  it('renders Discord login button with correct href and attributes', () => {
    currentLocale = 'ru'
    mockMeData = null
    mockIsPending = false

    const html = renderLoginHtml()

    expect(html).toContain('href="/api/v1/auth/discord/login"')
    expect(html).toContain(ru.login.discordButton)
  })

  it('renders top navigation and in-card buttons to return home', () => {
    currentLocale = 'ru'
    mockMeData = null

    const html = renderLoginHtml()

    // Has links to home ("/")
    expect(html).toContain('href="/"')
    // Localized text for returning home
    expect(html).toContain(ru.login.backToHome)
    // Logo should be clickable and point home
    expect(html).toContain(`aria-label="${ru.login.backToHome}"`)
  })

  it('renders localized copy for description and guestNote in Russian', () => {
    currentLocale = 'ru'
    const html = renderLoginHtml()

    expect(html).toContain(ru.login.description)
    expect(html).toContain(ru.login.guestNote)
    expect(html).toContain(ru.login.backToHome)
  })

  it('renders localized copy for description and guestNote in English', () => {
    currentLocale = 'en'
    const html = renderLoginHtml()

    expect(html).toContain(en.login.description)
    expect(html).toContain(en.login.guestNote)
    expect(html).toContain(en.login.backToHome)
  })
})
