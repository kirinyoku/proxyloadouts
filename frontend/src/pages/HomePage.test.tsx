import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import i18n, { resources } from '@/i18n'
import { HomePage } from './HomePage'

describe('HomePage', () => {
  it.each(['en', 'ru'] as const)('renders the scanner and guest instructions in %s', (lang) => {
    const { home } = resources[lang].translation
    const html = renderToString(
      <I18nextProvider i18n={i18n.cloneInstance({ lng: lang })}>
        <MemoryRouter>
          <HomePage />
        </MemoryRouter>
      </I18nextProvider>
    )

    expect(html.replace(/<[^>]+>/g, '')).toContain(home.title)
    expect(html).toContain(home.subtitle)
    expect(html).toContain(`aria-label="${home.uidAria}"`)
    expect(html).toContain(`placeholder="${home.searchPlaceholder}"`)
    expect(html).toContain(home.scanButton)
    expect(html).toContain(home.guestHint)
  })
})
