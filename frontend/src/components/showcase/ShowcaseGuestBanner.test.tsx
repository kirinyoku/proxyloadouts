import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ShowcaseGuestBanner } from './ShowcaseGuestBanner'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, fallback?: string) => {
        const dict: Record<string, string> = {
          'showcase.guestBanner': 'Авторизуйтесь через Discord, чтобы сохранять билды агентов в ростер и собирать команды.',
          'nav.login': 'Войти',
        }
        return dict[key] ?? fallback ?? key
      },
      i18n: { language: 'ru' },
    }),
  }
})

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, state, ...props }: { children: React.ReactNode; to: string; state?: { from?: string } }) => (
    <a href={to} data-state-from={state?.from} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ({
    pathname: '/showcase',
    search: '?uid=1504687050',
    hash: '',
    state: null,
    key: 'test',
  }),
}))

describe('ShowcaseGuestBanner (Minimalist)', () => {
  it('renders callout message and login action button cleanly', () => {
    const html = renderToString(<ShowcaseGuestBanner />)

    expect(html).toContain('Авторизуйтесь через Discord, чтобы сохранять билды агентов в ростер и собирать команды.')
    expect(html).toContain('Войти')
    expect(html).toContain('href="/login"')
  })

  it('preserves return redirect location in state', () => {
    const html = renderToString(<ShowcaseGuestBanner />)

    expect(html).toContain('data-state-from="/showcase?uid=1504687050"')
  })

  it('includes proper accessible landmark role and label', () => {
    const html = renderToString(<ShowcaseGuestBanner />)

    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Авторизуйтесь через Discord')
  })

  it('applies responsive layout classes for mobile stack and desktop row', () => {
    const html = renderToString(<ShowcaseGuestBanner className="custom-test-class" />)

    // Mobile stack (flex-col, w-full button) to Desktop inline row (sm:flex-row, sm:w-auto button)
    expect(html).toContain('flex flex-col')
    expect(html).toContain('sm:flex-row')
    expect(html).toContain('sm:items-center')
    expect(html).toContain('sm:justify-between')
    expect(html).toContain('custom-test-class')
  })
})
