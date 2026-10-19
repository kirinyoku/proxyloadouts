import { cn } from '@/lib/utils'

export interface PxlMarkProps {
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  animated?: boolean
}

const sizeClasses = {
  xs: 'h-4 w-auto',
  sm: 'h-[17px] w-auto',
  md: 'h-[22px] w-auto',
  lg: 'h-11 w-auto',
  xl: 'h-16 w-auto',
} as const

/**
 * PxlMark — Glitch Pixel Matrix Brand Emblem (P-x-L Monogram).
 *
 * Concept 05 (Extended L Base):
 * - P: Sliced techno glyph with glowing glitch laser cut.
 * - x: Pure 5-pixel modular matrix cluster.
 * - L: Tall digital pillar with confident extended techno base (76px) and terminal accent.
 */
export function PxlMark({
  className,
  size = 'md',
  animated = false,
}: PxlMarkProps) {
  return (
    <svg
      viewBox="34 30 182 154"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn(
        'select-none shrink-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]',
        sizeClasses[size],
        animated && 'transition-transform duration-200 ease-out hover:scale-105 active:scale-95',
        className,
      )}
    >
      <defs>
        <filter id="pxl-mark-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="var(--primary)" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* P Letter: Sliced Techno Glyph */}
      <g fill="currentColor" opacity="0.95">
        <rect x="40" y="32" width="22" height="40" rx="1.5" />
        <rect x="42" y="76" width="22" height="42" rx="1.5" />
        <rect x="66" y="32" width="40" height="18" rx="1.5" />
        <rect x="106" y="44" width="18" height="32" rx="1.5" />
        <rect x="66" y="70" width="40" height="18" rx="1.5" />
      </g>

      {/* Glitch Slice on P */}
      <rect
        x="36"
        y="66"
        width="94"
        height="4"
        rx="1"
        fill="var(--primary)"
        filter="url(#pxl-mark-glow)"
      />

      {/* X: Pure Pixel Matrix (5 Square Pixel Blocks) */}
      <g fill="var(--primary)" filter="url(#pxl-mark-glow)">
        <rect x="60" y="134" width="14" height="14" rx="2" />
        <rect x="94" y="134" width="14" height="14" rx="2" />
        <rect x="77" y="151" width="14" height="14" rx="2" />
        <rect x="60" y="168" width="14" height="14" rx="2" />
        <rect x="94" y="168" width="14" height="14" rx="2" />
      </g>

      {/* L: Digital Pillar with Extended Grounding Base */}
      <g fill="currentColor" opacity="0.95">
        <rect x="140" y="32" width="22" height="80" rx="1.5" />
        <rect x="138" y="116" width="22" height="38" rx="1.5" />
        <rect x="138" y="154" width="76" height="22" rx="1.5" />
      </g>

      {/* L Terminal Accent */}
      <rect
        x="196"
        y="142"
        width="18"
        height="8"
        rx="1"
        fill="var(--primary)"
        opacity="0.9"
      />
    </svg>
  )
}
