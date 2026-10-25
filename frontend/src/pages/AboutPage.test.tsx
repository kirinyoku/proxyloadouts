import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AboutPage } from './AboutPage'
import ru from '@/i18n/locales/ru'

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => getNestedValue(ru as unknown as Record<string, unknown>, key),
  }),
}))

describe('AboutPage', () => {
  it('renders page title and all 5 sections', () => {
    const html = renderToString(<AboutPage />)

    expect(html).toContain(ru.about.title)
    expect(html).toContain(ru.about.project.title)
    expect(html).toContain(ru.about.auth.title)
    expect(html).toContain(ru.about.limits.title)
    expect(html).toContain(ru.about.monetization.title)
    expect(html).toContain(ru.about.development.title)
  })

  it('renders external GitHub repository link and contact mailto link', () => {
    const html = renderToString(<AboutPage />)

    expect(html).toContain('href="https://github.com/kirinyoku/proxyloadouts"')
    expect(html).toContain('href="mailto:contact@proxyloadouts.com"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})
