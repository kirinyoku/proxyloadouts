import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ShowcaseGuestBannerProps {
  className?: string
}

/**
 * Informational Guest Banner with signature ZZZ yellow/primary accent.
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
        'rounded-xl border border-primary/45 bg-primary/[0.05] p-3 sm:px-4 sm:py-2.5',
        'transition-colors hover:border-primary/65 shadow-[0_0_16px_color-mix(in_oklch,var(--primary)_10%,transparent)]',
        className
      )}
    >
      {/* Informational message */}
      <div className="flex items-start sm:items-center gap-2.5 min-w-0">
        <Info className="size-4 shrink-0 text-primary mt-0.5 sm:mt-0" aria-hidden="true" />
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
          'w-full sm:w-auto h-8 sm:h-7 px-3 text-xs font-semibold shrink-0',
          'rounded-lg border-primary/40 bg-primary/10 text-primary',
          'hover:bg-primary/20 hover:border-primary/70 hover:text-primary',
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
