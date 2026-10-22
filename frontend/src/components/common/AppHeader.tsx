import { Link, NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogIn } from 'lucide-react'
import { useMe } from '@/api/hooks'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/components/common/UserMenu'
import { PxlLogo } from '@/components/common/PxlLogo'
import { preloadRoute } from '@/lib/route-preload'
import { cn } from '@/lib/utils'

function NavTab({
  to,
  label,
  end,
  fullWidth,
}: {
  to: string
  label: string
  end?: boolean
  fullWidth?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onMouseEnter={() => preloadRoute(to)}
      onFocus={() => preloadRoute(to)}
      className={cn(
        'group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        fullWidth ? 'flex-1 min-w-0 flex' : 'inline-flex',
      )}
    >
      {({ isActive }) => (
        <span
          className={cn(
            'relative -skew-x-[12deg] items-center justify-center border-2 transition-all select-none',
            'text-sm whitespace-nowrap',
            fullWidth
              ? 'flex w-full h-8.5 px-2 text-xs font-semibold tracking-wide'
              : 'inline-flex px-4 py-1.5 text-xs md:text-sm font-semibold tracking-wide',
            isActive
              ? 'checker-dark border-black bg-primary font-bold text-primary-foreground shadow-[inset_0_0_0_2px_var(--primary),inset_0_0_0_3px_rgba(0,0,0,0.85),0_3px_14px_-4px_color-mix(in_oklch,var(--primary)_45%,transparent)]'
              : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:border-border hover:bg-elevated hover:text-foreground font-medium active:scale-[0.98]',
          )}
        >
          <span className="skew-x-[12deg] truncate">{label}</span>
        </span>
      )}
    </NavLink>
  )
}

export function AppHeader() {
  const { t } = useTranslation()
  const { data: me } = useMe()
  const isAuthed = Boolean(me)

  const navItems = [
    { to: '/showcase', label: t('nav.showcase'), end: false },
    { to: '/roster', label: t('nav.roster'), end: false },
    { to: '/teams', label: t('nav.teams'), end: false },
  ] as const

  return (
    <header className="sticky top-0 z-40 border-b-2 border-black bg-background/95 backdrop-blur-sm">
      <div
        aria-hidden
        className="crosshatch h-1 w-full opacity-90"
        style={{ backgroundColor: 'var(--primary)' }}
      />
      <div className="mx-auto max-w-6xl px-3 sm:px-4">
        <div className="relative flex h-[52px] items-center justify-between gap-2 sm:gap-4">
          <NavLink
            to="/"
            end
            aria-label="ProxyLoadouts"
            className="group flex shrink-0 items-center select-none py-1"
          >
            <PxlLogo size="md" showMark badgeText="ALPHA" />
          </NavLink>

          <nav
            className="absolute left-1/2 -translate-x-1/2 hidden items-center gap-1.5 md:flex"
            aria-label={t('nav.mainNavAria')}
          >
            {navItems.map((item) => (
              <NavTab key={item.to} to={item.to} label={item.label} end={item.end} />
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            {isAuthed ? (
              <UserMenu />
            ) : (
              <Button
                size="default"
                className="h-8 gap-1.5 px-3 text-xs"
                asChild
              >
                <Link to="/login">
                  <LogIn className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{t('nav.login')}</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        <nav
          className="flex w-full items-center gap-2 pb-2.5 md:hidden"
          aria-label={t('nav.mobileNavAria')}
        >
          {navItems.map((item) => (
            <NavTab key={item.to} to={item.to} label={item.label} end={item.end} fullWidth />
          ))}
        </nav>
      </div>
    </header>
  )
}
