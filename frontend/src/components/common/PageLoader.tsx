import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

export interface PageLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  sublabel?: string
  /**
   * When true (default), covers the full viewport with fixed inset-0 to guarantee
   * exact horizontal and vertical screen centering without layout shift or scrollbars.
   * When false, fills the relative parent container with min-h-full.
   */
  fixed?: boolean
  /**
   * Spinner size inside the loader card.
   * Defaults to 'lg' (32px, slightly larger for clear screen visibility).
   */
  spinnerSize?: 'md' | 'lg' | 'xl'
}

/**
 * Centered PageLoader in ZZZ aesthetic.
 * Used during route transitions, full page refreshes, and auth state checks.
 */
export function PageLoader({
  label,
  sublabel,
  fixed = true,
  spinnerSize = 'lg',
  className,
  ...props
}: PageLoaderProps) {
  const { t } = useTranslation()
  const displayLabel = label ?? t('common.loading')

  return (
    <div
      role="status"
      aria-label={displayLabel}
      className={cn(
        'flex flex-col items-center justify-center gap-4 select-none',
        fixed
          ? 'fixed inset-0 z-50 min-h-dvh w-screen bg-background/80 backdrop-blur-sm'
          : 'min-h-[50vh] w-full flex-1 py-12',
        className
      )}
      {...props}
    >
      {/* ZZZ Chamfered Box with Symmetric Dual-Arc Spinner */}
      <div className="relative flex size-14 items-center justify-center rounded-[14px_14px_0_14px] border-2 border-black bg-card shadow-[inset_0_2px_3px_rgba(255,255,255,0.08),0_8px_32px_rgba(0,0,0,0.5)]">
        <Spinner size={spinnerSize} color="primary" />
      </div>

      {/* Primary Label with ZZZ Hazard Stripes */}
      <div className="flex items-center gap-3">
        <span aria-hidden className="stripes-40 h-1 w-8 rounded-full opacity-60" />
        <span className="font-heading text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {displayLabel}
        </span>
        <span aria-hidden className="stripes-40 h-1 w-8 rounded-full opacity-60" />
      </div>

      {/* Optional Sublabel */}
      {sublabel && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/60">
          {sublabel}
        </span>
      )}
    </div>
  )
}
