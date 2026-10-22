import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { PrivacyPage } from './PrivacyPage'
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

describe('PrivacyPage', () => {
  const renderPrivacyHtml = () => {
    return renderToString(
      <MemoryRouter>
        <PrivacyPage />
      </MemoryRouter>
    )
  }

  it('renders page header and navigation back link', () => {
    const html = renderPrivacyHtml()

    expect(html).toContain(ru.privacy.title)
    expect(html).toContain(ru.privacy.lastUpdated)
    expect(html).toContain('href="/"')
  })


  it('renders all 10 key regulatory sections', () => {
    const html = renderPrivacyHtml()

    // Section 1: Overview & Operator
    expect(html).toContain(ru.privacy.sections.overview.title)
    // Section 2: Terms & Acceptable Use
    expect(html).toContain(ru.privacy.sections.terms.title)
    // Section 3: Intellectual Property & HoYoverse
    expect(html).toContain(ru.privacy.sections.ip.title)
    // Section 4: Data Categories & GDPR Legal Bases
    expect(html).toContain(ru.privacy.sections.collected.title.replace('&', '&amp;'))
    // Section 5: Cookies & ePrivacy
    expect(html).toContain(ru.privacy.sections.cookies.title.replace('&', '&amp;'))
    // Section 6: Non-Custodial Safety
    expect(html).toContain(ru.privacy.sections.safety.title)
    // Section 7: Retention Periods
    expect(html).toContain(ru.privacy.sections.retention.title)
    // Section 8: GDPR User Rights
    expect(html).toContain(ru.privacy.sections.rights.title.replace('&', '&amp;'))
    // Section 9: Third-Party Processors
    expect(html).toContain(ru.privacy.sections.thirdParty.title)
    // Section 10: Legal Inquiries & Contacts
    expect(html).toContain(ru.privacy.sections.contact.title.replace('&', '&amp;'))
  })

  it('provides secure mailto and external links with rel="noopener noreferrer"', () => {
    const html = renderPrivacyHtml()

    expect(ru.privacy.sections.contact.email).toBe('contact@proxyloadouts.com')
    expect(html).toContain(`mailto:${ru.privacy.sections.contact.email}`)
    expect(html).toContain('href="https://enka.network"')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
  })
})
