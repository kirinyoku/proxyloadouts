import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AppFooter } from './AppFooter'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => {
      const translations: Record<string, string> = {
        'footer.aria': 'Подвал сайта ProxyLoadouts',
        'footer.alphaBadge': 'ALPHA',
        'footer.alphaNoticeLeading': 'Проект находится на стадии ранней альфы. Если вы столкнулись с ошибкой или у вас есть замечания и пожелания, пишите на',
        'footer.alphaNoticeTrailing': '.',
        'footer.poweredBy': 'Данные профилей и экипировки предоставлены',
        'footer.enkaNetwork': 'EnkaNetwork',
        'footer.disclaimer': 'ProxyLoadouts — независимый фанатский проект, не связанный с COGNOSPHERE PTE. LTD. и miHoYo.',
        'footer.privacy': 'Конфиденциальность и условия',
        'footer.createdBy': 'created by',
        'settings.title': 'Настройки',
      }
      return translations[key] ?? fallback ?? key
    },
  }),
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

vi.mock('@/components/common/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}))

describe('AppFooter', () => {
  it('renders site footer with accessible landmark', () => {
    const html = renderToString(<AppFooter />)
    expect(html).toContain('aria-label="Подвал сайта ProxyLoadouts"')
    expect(html).toContain('<footer')
  })

  it('renders contact email mailto link', () => {
    const html = renderToString(<AppFooter />)
    expect(html).toContain('href="mailto:contact@proxyloadouts.com"')
    expect(html).toContain('contact@proxyloadouts.com')
  })

  it('renders alpha disclaimer notice with contact email link', () => {
    const html = renderToString(<AppFooter />)
    const cleanText = html.replace(/<!--.*?-->/g, '')
    expect(cleanText).toContain('[ALPHA]')
    expect(cleanText).toContain('Проект находится на стадии ранней альфы')
    expect(cleanText).toContain('contact@proxyloadouts.com')
  })

  it('renders created by with link to GitHub profile', () => {
    const html = renderToString(<AppFooter />)
    expect(html).toContain('created by')
    expect(html).toContain('href="https://github.com/kirinyoku"')
    expect(html).toContain('kirinyoku')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('renders EnkaNetwork attribution link', () => {
    const html = renderToString(<AppFooter />)
    expect(html).toContain('href="https://enka.network"')
    expect(html).toContain('EnkaNetwork')
  })

  it('renders settings and privacy links', () => {
    const html = renderToString(<AppFooter />)
    expect(html).toContain('href="/settings"')
    expect(html).toContain('href="/privacy"')
  })

  it('renders current year copyright', () => {
    const html = renderToString(<AppFooter />)
    const currentYear = new Date().getFullYear().toString()
    const cleanText = html.replace(/<!--.*?-->/g, '')
    expect(cleanText).toContain(`© ${currentYear} ProxyLoadouts`)
  })

  it('renders elements in bottom bar in correct order: enka -> createdBy -> settings -> privacy -> copyright', () => {
    const html = renderToString(<AppFooter />)
    const cleanText = html.replace(/<!--.*?-->/g, '')
    const currentYear = new Date().getFullYear().toString()
    const enkaIndex = cleanText.indexOf('https://enka.network')
    const createdByIndex = cleanText.indexOf('created by')
    const settingsIndex = cleanText.indexOf('href="/settings"')
    const privacyIndex = cleanText.indexOf('href="/privacy"')
    const copyrightIndex = cleanText.indexOf(`© ${currentYear} ProxyLoadouts`)

    expect(enkaIndex).toBeGreaterThan(-1)
    expect(createdByIndex).toBeGreaterThan(enkaIndex)
    expect(settingsIndex).toBeGreaterThan(createdByIndex)
    expect(privacyIndex).toBeGreaterThan(settingsIndex)
    expect(copyrightIndex).toBeGreaterThan(privacyIndex)
  })

  it('contains email only in the alpha notice, not as a redundant navigation link', () => {
    const html = renderToString(<AppFooter />)
    const mailtoMatches = html.match(/href="mailto:contact@proxyloadouts.com"/g)
    expect(mailtoMatches).toHaveLength(1)
  })
})
