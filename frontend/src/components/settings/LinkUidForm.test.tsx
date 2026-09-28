import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { LinkUidForm } from './LinkUidForm'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru', changeLanguage: vi.fn() },
  }),
}))

const baseProps = {
  onUidChange: vi.fn(),
  onSubmit: vi.fn(),
  errorMessage: null,
  isPending: false,
  isMaxReached: false,
}

describe('LinkUidForm', () => {
  it('renders the UID field with numeric input mode and a 10 digit cap', () => {
    const html = renderToString(<LinkUidForm {...baseProps} uid="" />)
    expect(html).toContain('id="uid"')
    expect(html).toContain('inputMode="numeric"')
    expect(html).toContain('maxLength="10"')
    expect(html).toContain('settings.addAccountTitle')
    expect(html).not.toContain('settings.addAccountDesc')
  })

  it('shows the detected server chip once the prefix is conclusive', () => {
    const html = renderToString(<LinkUidForm {...baseProps} uid="1504687050" />)
    expect(html).toContain('Europe')
    expect(html).not.toContain('2 / 10')
  })

  it('shows a live digit counter before the region is known', () => {
    const html = renderToString(<LinkUidForm {...baseProps} uid="99" />)
    expect(html).toContain('2 / 10')
    expect(html).not.toContain('Europe')
  })

  it('renders the validation error instead of the hint when invalid', () => {
    const html = renderToString(
      <LinkUidForm {...baseProps} uid="12" errorMessage="settings.uidError" />
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('settings.uidError')
    expect(html).not.toContain('settings.addAccountDesc')
  })

  it('replaces the form with the account limit notice at capacity', () => {
    const html = renderToString(<LinkUidForm {...baseProps} uid="" isMaxReached />)
    expect(html).toContain('settings.limitReachedAlert')
    expect(html).not.toContain('id="uid"')
  })

  it('disables the submit button while the mutation is pending', () => {
    const html = renderToString(<LinkUidForm {...baseProps} uid="1504687050" isPending />)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('settings.adding')
  })
})
