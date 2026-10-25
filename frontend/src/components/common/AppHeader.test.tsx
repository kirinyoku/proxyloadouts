import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AppHeader } from './AppHeader'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'nav.showcase': 'Витрина',
        'nav.roster': 'Ростер',
        'nav.teams': 'Команды',
        'nav.login': 'Войти',
        'nav.mainNavAria': 'Главная навигация',
        'nav.mobileNavAria': 'Мобильная навигация',
      }
      return translations[key] ?? key
    },
  }),
}))

vi.mock('@/api/hooks', () => ({
  useMe: () => ({ data: null }),
}))

vi.mock('@/components/common/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}))

let currentPath = '/showcase'

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  NavLink: ({
    children,
    to,
    className,
    end: _end,
    ...props
  }: {
    children: React.ReactNode | ((props: { isActive: boolean }) => React.ReactNode)
    to: string
    className?: string | ((props: { isActive: boolean }) => string | undefined)
    end?: boolean
  }) => {
    const isActive = to === currentPath
    const resolvedClassName = typeof className === 'function' ? className({ isActive }) : className
    return (
      <a href={to} className={resolvedClassName} {...props}>
        {typeof children === 'function' ? children({ isActive }) : children}
      </a>
    )
  },
}))

describe('AppHeader', () => {
  it('renders navigation tabs including showcase, roster, and teams', () => {
    currentPath = '/showcase'
    const html = renderToString(<AppHeader />)

    expect(html).toContain('Витрина')
    expect(html).toContain('Ростер')
    expect(html).toContain('Команды')
  })

  it('renders mobile navigation with full-width container and tabs', () => {
    currentPath = '/showcase'
    const html = renderToString(<AppHeader />)

    // Mobile nav aria label and full-width container class
    expect(html).toContain('aria-label="Мобильная навигация"')
    expect(html).toContain('w-full')
    expect(html).toContain('flex-1')
    expect(html).toContain('h-8.5')
  })

  it('highlights the active tab with primary styling', () => {
    currentPath = '/showcase'
    const html = renderToString(<AppHeader />)

    expect(html).toContain('bg-primary')
    expect(html).toContain('checker-dark')
  })

  it('renders brand logo and title PROXYLOADOUTS in header without ALPHA badge', () => {
    const html = renderToString(<AppHeader />)

    expect(html).toContain('PROXY')
    expect(html).toContain('LOADOUTS')
    expect(html).not.toContain('ALPHA')
    expect(html).toContain('h-[52px]')
    expect(html).not.toMatch(/class="[^"]*hidden[^"]*font-heading/)
  })

  it('renders login button with text, icon and no language switcher', () => {
    const html = renderToString(<AppHeader />)

    expect(html).toContain('href="/login"')
    expect(html).toContain('Войти')
    // Svg icon inside the login button link
    expect(html).toMatch(/href="\/login"[^>]*>.*<svg/)
    expect(html).not.toContain('lang-switcher')
  })
})
