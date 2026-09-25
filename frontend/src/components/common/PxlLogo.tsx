import { cn } from '@/lib/utils'

interface PxlLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showSubtitle?: boolean
  subtitleText?: string
}

export function PxlLogo({
  className,
  size = 'md',
  showSubtitle = true,
  subtitleText,
}: PxlLogoProps) {
  const titleSizes = {
    sm: 'text-sm tracking-wider',
    md: 'text-base sm:text-lg tracking-wider',
    lg: 'text-3xl sm:text-4xl tracking-widest',
  }

  const subSizes = {
    sm: 'text-[8px] tracking-widest',
    md: 'text-[9px] tracking-[0.2em]',
    lg: 'text-xs tracking-[0.25em]',
  }

  return (
    <div className={cn('inline-flex flex-col text-left leading-none select-none group', className)}>
      {/* Primary Brand Typography */}
      <span
        className={cn(
          'font-display font-black text-white transition-opacity group-hover:opacity-90',
          titleSizes[size],
        )}
      >
        <span>PXL</span>
        <span className="text-primary font-bold">.</span>
      </span>

      {/* Subtitle / Descriptive Tag */}
      {showSubtitle && (
        <span
          className={cn(
            'mt-0.5 font-mono font-bold text-muted-foreground uppercase transition-colors group-hover:text-foreground/80',
            subSizes[size],
          )}
        >
          {subtitleText ? (
            subtitleText
          ) : (
            <>
              <span>PROXY</span>
              <span className="text-foreground/80 ml-1">LOADOUTS</span>
            </>
          )}
        </span>
      )}
    </div>
  )
}
