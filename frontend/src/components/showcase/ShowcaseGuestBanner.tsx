import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ShowcaseGuestBannerProps {
  className?: string
}

/**
 * Minimalist Informational Guest Banner with yellow accent.
 *
 * Informs unauthenticated users that logging in via Discord enables
 * saving build snapshots to their Proxy roster and assembling teams.
 */
export function ShowcaseGuestBanner({ className }: ShowcaseGuestBannerProps) {
  const { t } = useTranslation()
  const location = useLocation()

  return (
    <div
      role="region"
      aria-label={t('showcase.guestBanner')}
      className={cn(
        'flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between',
        'rounded-xl border border-amber-400/30 bg-amber-400/[0.03] p-3 sm:px-4 sm:py-2',
        'transition-colors hover:border-amber-400/45',
        className
      )}
    >
      {/* Informational message */}
      <div className="flex items-center gap-2.5 min-w-0">
        <p className="text-xs leading-relaxed text-zinc-200 font-sans">
          {t('showcase.guestBanner')}
        </p>
      </div>

      {/* Login CTA */}
      <Button
        size="sm"
        variant="outline"
        asChild
        className={cn(
          'w-full sm:w-auto h-8 sm:h-7 px-3 text-xs font-medium shrink-0',
          'rounded-lg border-white/[0.12] bg-white/[0.03] text-foreground/90',
          'hover:bg-white/[0.08] hover:border-white/20 hover:text-foreground',
          'transition-all duration-150 active:scale-[0.98]'
        )}
      >
        <Link
          to="/login"
          state={{ from: `${location.pathname}${location.search}` }}
        >
          {t('nav.login')}
        </Link>
      </Button>
    </div>
  )
}
