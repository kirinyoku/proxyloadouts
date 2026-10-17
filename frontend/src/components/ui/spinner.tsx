import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'cyan' | 'white' | 'current'
}

const sizeClasses = {
  xs: 'size-3.5', // 14px (buttons at size="xs", size="sm")
  sm: 'size-4',   // 16px (standard buttons)
  md: 'size-6',   // 24px (cards and modals)
  lg: 'size-8',   // 32px (screens and fallbacks)
  xl: 'size-12',  // 48px (oversized)
}

const strokeWidths = {
  xs: 2.5,
  sm: 2.2,
  md: 2.2,
  lg: 2.2,
  xl: 2.5,
}

const colorClasses = {
  primary: 'text-primary drop-shadow-[0_0_6px_color-mix(in_oklch,var(--primary)_45%,transparent)]',
  cyan: 'text-[#2eb6ff] drop-shadow-[0_0_6px_rgba(46,182,255,0.4)]',
  white: 'text-white',
  current: 'text-current',
}

/**
 * Symmetric Dual-Arc Spinner
 * Minimal ZZZ-style loading indicator:
 * two symmetric round-capped arcs rotating in balance, without the visual
 * jitter ("limping") that the usual border-t-transparent trick produces.
 */
export function Spinner({
  size = 'sm',
  color = 'primary',
  className,
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 select-none pointer-events-none',
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn('size-full animate-spin', colorClasses[color])}
        style={{ animationDuration: '0.8s' }}
      >
        {/* Symmetric Arc 1 */}
        <path
          d="M 12 3 A 9 9 0 0 1 21 12"
          stroke="currentColor"
          strokeWidth={strokeWidths[size]}
          strokeLinecap="round"
        />
        {/* Symmetric Arc 2 (Opposite) */}
        <path
          d="M 12 21 A 9 9 0 0 1 3 12"
          stroke="currentColor"
          strokeWidth={strokeWidths[size]}
          strokeLinecap="round"
        />
        {/* Subtle guide dots in gaps */}
        <circle cx="12" cy="3" r="1" fill="currentColor" opacity="0.25" />
        <circle cx="12" cy="21" r="1" fill="currentColor" opacity="0.25" />
      </svg>
    </div>
  )
}
