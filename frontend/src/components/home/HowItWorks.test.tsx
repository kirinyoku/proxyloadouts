import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router-dom'
import i18n, { resources } from '@/i18n'
import { HowItWorks } from './HowItWorks'

describe('HowItWorks', () => {
  it('explains how to scan, save equipment and build a squad in one ordered list', () => {
    const { home } = resources.en.translation
    const html = renderToString(
      <I18nextProvider i18n={i18n.cloneInstance({ lng: 'en' })}>
        <MemoryRouter><HowItWorks /></MemoryRouter>
      </I18nextProvider>
    )

    expect(html).toContain(home.stepsAria)
    expect(html.match(/<ol[\s>]/g)).toHaveLength(1)
    expect(html.match(/<li[\s>]/g)).toHaveLength(5)
    expect([...html.matchAll(/<h3>(.*?)<\/h3>/g)].map((match) => match[1])).toEqual([
      home.showcaseTitle, home.scanTitle, home.discordTitle, home.saveTitle, home.squadTitle,
    ])
    for (const text of [home.showcaseGuide, home.scanGuide, home.discordGuide, home.saveGuide, home.squadGuide, home.aboutPromptLink]) {
      expect(html).toContain(text)
    }
    expect(html).toContain('href="/about"')
  })
})
