import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { NotFoundPage } from './NotFoundPage'
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
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
  useTranslation: () => ({
    t: (key: string, defaultVal?: string) => {
      const localeObj = currentLocale === 'ru' ? ru : en
      const val = getNestedValue(localeObj as unknown as Record<string, unknown>, key)
      return val === key && defaultVal ? defaultVal : val
    },
    i18n: { language: currentLocale },
  }),
}))

describe('NotFoundPage', () => {
  const renderNotFoundHtml = (initialEntries = ['/lost-in-hollow']) => {
    return renderToString(
      <MemoryRouter initialEntries={initialEntries}>
        <NotFoundPage />
      </MemoryRouter>
    )
  }

  it('renders HTTP 404 alert with terminal effect and badge', () => {
    currentLocale = 'ru'
    const html = renderNotFoundHtml()

    expect(html).toContain('role="alert"')
    expect(html).toContain('HTTP 404')
    expect(html).toContain(ru.notFoundPage.badge)
  })

  it('renders localized title and description', () => {
    currentLocale = 'ru'
    const html = renderNotFoundHtml()

    expect(html).toContain(ru.notFoundPage.title)
    expect(html).toContain(ru.notFoundPage.description)
  })

  it('renders CRT terminal diagnostics containing the attempted pathname', () => {
    currentLocale = 'ru'
    const testPath = '/sector-nine/unknown'
    const html = renderNotFoundHtml([testPath])

    expect(html).toContain(testPath)
    expect(html).toContain(ru.notFoundPage.diagnostic.status)
  })

  it('renders primary navigation button returning to home', () => {
    currentLocale = 'ru'
    const html = renderNotFoundHtml()

    expect(html).toContain('href="/"')
    expect(html).toContain(ru.notFoundPage.actions.home)
  })

  it('renders back navigation button', () => {
    currentLocale = 'ru'
    const html = renderNotFoundHtml()

    expect(html).toContain(ru.notFoundPage.actions.back)
  })

  it('supports English locale seamlessly', () => {
    currentLocale = 'en'
    const html = renderNotFoundHtml(['/lost-zone'])

    expect(html).toContain(en.notFoundPage.title)
    expect(html).toContain(en.notFoundPage.description)
    expect(html).toContain(en.notFoundPage.actions.home)
    expect(html).toContain(en.notFoundPage.actions.back)
  })
})
