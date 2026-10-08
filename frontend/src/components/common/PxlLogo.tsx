import { cn } from '@/lib/utils'

interface PxlLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showSubtitle?: boolean
  subtitleText?: string
}

/**
 * Text-only wordmark lockup. Title tracking and subtitle tracking are tuned
 * per size so that PROXYLOADOUTS spans the same width as PXL. — keep in sync.
 * Hover/focus is driven by an ancestor `.group` (e.g. the wrapping link).
 */
export function PxlLogo({
  className,
  size = 'md',
  showSubtitle = true,
  subtitleText,
}: PxlLogoProps) {
  const titleSizes = {
    sm: 'text-[20px] tracking-[0.09em]',
    md: 'text-[20px] tracking-[0.09em]',
    lg: 'text-[32px] sm:text-[40px] tracking-[0.06em]',
  }

  const subSizes = {
    sm: 'text-[8px] tracking-[0.01em]',
    md: 'text-[8px] tracking-[0.01em]',
    lg: 'text-[11px] sm:text-[14px] tracking-[0.05em]',
  }

  return (
    <div
      className={cn(
        'group inline-flex flex-col text-left leading-none select-none',
        'opacity-85 transition-opacity duration-200 ease-out hover:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none',
        className,
      )}
    >
      {/* Primary brand typography */}
      <span
        role="img"
        aria-label="PXL"
        className={cn(
          'font-display font-black leading-[0.9] text-foreground',
          titleSizes[size],
        )}
      >
        <span aria-hidden>P</span>
        <span aria-hidden className="text-primary">
          X
        </span>
        <span aria-hidden>L</span>
        <span aria-hidden className="text-primary">
          .
        </span>
      </span>

      {/* Subtitle / descriptive tag */}
      {showSubtitle && (
        <span
          className={cn(
            'mt-1 flex justify-between font-mono font-bold uppercase text-muted-foreground',
            subSizes[size],
          )}
        >
          {subtitleText ? (
            <span>{subtitleText}</span>
          ) : (
            <>
              <span>PROXY</span>
              <span className="text-foreground/80">LOADOUTS</span>
            </>
          )}
        </span>
      )}
    </div>
  )
}
