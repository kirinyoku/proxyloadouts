import { cn } from '@/lib/utils'
import { PxlMark } from './PxlMark'

interface PxlLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showSubtitle?: boolean
  subtitleText?: string
  showMark?: boolean
  showWordmark?: boolean
  layout?: 'horizontal' | 'vertical'
}

/**
 * PxlLogo brand lockup.
 * When `showMark` is true, renders the PxlMark emblem perfectly aligned in height
 * with the adjacent PROXYLOADOUTS typography, eliminating redundant duplicate PXL text.
 * When `showMark` is false, renders the legacy text-only wordmark lockup.
 */
export function PxlLogo({
  className,
  size = 'md',
  showSubtitle = true,
  subtitleText,
  showMark = false,
  showWordmark,
  layout = 'horizontal',
}: PxlLogoProps) {
  const shouldShowWordmark = showWordmark ?? !showMark

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

  const markSizes = {
    sm: 'sm' as const,
    md: 'md' as const,
    lg: 'lg' as const,
  }

  const textLockupStyles = {
    sm: {
      height: 'h-[17px]',
      gap: 'gap-2',
      proxy: 'text-[11.5px] tracking-[0.12em]',
      loadouts: 'text-[6.5px] tracking-[0.44em]',
    },
    md: {
      height: 'h-[22px]',
      gap: 'gap-2.5',
      proxy: 'text-[15px] tracking-[0.12em]',
      loadouts: 'text-[8px] tracking-[0.44em]',
    },
    lg: {
      height: 'h-11',
      gap: 'gap-3.5',
      proxy: 'text-[23px] tracking-[0.12em]',
      loadouts: 'text-[12px] tracking-[0.44em]',
    },
  }

  const currentLockup = textLockupStyles[size]

  return (
    <div
      role="img"
      aria-label="PXL"
      className={cn(
        'group inline-flex select-none leading-none',
        layout === 'horizontal'
          ? cn('flex-row items-center', currentLockup.gap)
          : 'flex-col items-center gap-2.5',
        'opacity-90 transition-opacity duration-200 ease-out hover:opacity-100 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none',
        className,
      )}
    >
      {showMark && (
        <PxlMark
          size={markSizes[size]}
          className="transition-transform duration-200 ease-out group-hover:scale-105 motion-reduce:transition-none"
        />
      )}

      {/* Typography container */}
      {(shouldShowWordmark || showSubtitle) && (
        <div
          className={cn(
            'inline-flex flex-col text-left leading-none',
            !shouldShowWordmark && layout === 'horizontal' && cn('justify-between', currentLockup.height),
          )}
        >
          {/* Legacy Wordmark (only if mark is not present or explicitly enabled) */}
          {shouldShowWordmark && (
            <span
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
          )}

          {/* Subtitle / Descriptive Tag */}
          {showSubtitle && (
            <div
              className={cn(
                'flex leading-none',
                shouldShowWordmark
                  ? cn('mt-1 flex-row justify-between font-mono font-bold uppercase text-muted-foreground', subSizes[size])
                  : layout === 'horizontal'
                    ? 'flex-col justify-between h-full'
                    : 'flex-col gap-1 text-center',
              )}
            >
              {subtitleText ? (
                <span className="font-mono text-xs font-bold uppercase text-muted-foreground">
                  {subtitleText}
                </span>
              ) : shouldShowWordmark ? (
                <>
                  <span>PROXY</span>
                  <span className="text-foreground/80">LOADOUTS</span>
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      'font-tech font-bold text-foreground uppercase leading-none',
                      currentLockup.proxy,
                    )}
                  >
                    PROXY
                  </span>
                  <span
                    className={cn(
                      'font-tech font-bold text-primary uppercase leading-none',
                      currentLockup.loadouts,
                    )}
                  >
                    LOADOUTS
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
