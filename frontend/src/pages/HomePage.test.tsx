import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { HomePage } from './HomePage'
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
    t: (key: string, defaultVal?: string) => {
      const val = getNestedValue(ru as unknown as Record<string, unknown>, key)
      return val === key && defaultVal ? defaultVal : val
    },
  }),
}))

describe('HomePage', () => {
  const renderHomeHtml = () => {
    return renderToString(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    )
  }

  it('renders updated title and subtitle copy', () => {
    const html = renderHomeHtml()

    // Title parts
    expect(html).toContain(ru.home.title1)
    expect(html).toContain(ru.home.title2)
    // Full subtitle / description text
    expect(html).toContain(ru.home.subtitle)
    expect(html).toContain('Храните сменные комплекты экипировки для каждого агента.')
    expect(html).toContain('Собирайте боевые отряды под разный боевой контент без коллизий.')
  })

  it('renders UID search input and scan button', () => {
    const html = renderHomeHtml()

    expect(html).toContain(ru.home.searchPlaceholder)
    expect(html).toContain(ru.home.showShowcase)
  })

  it('renders a link to the about page after the how-it-works section', () => {
    const html = renderHomeHtml()

    expect(html).toContain('href="/about"')
    expect(html).toContain(ru.home.aboutPromptLink)
  })
})
