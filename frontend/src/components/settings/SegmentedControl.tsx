import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  /** Optional leading visual — used to preview the setting itself. */
  glyph?: ReactNode
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  ariaLabel: string
  className?: string
}

/**
 * Accessible segmented control built on the radiogroup pattern: arrow-free
 * native buttons, each exposing `role="radio"` + `aria-checked`.
 *
 * Options stretch to share the row on mobile and shrink to their content on
 * desktop, so a two-way choice never renders as a half-empty pill bar.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-slot="segmented-control"
      className={cn(
        'inline-flex w-full items-center gap-1 rounded-lg border border-white/10 bg-black/35 p-1 sm:w-auto',
        className
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'flex h-9 sm:h-8 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium whitespace-nowrap transition-all outline-none select-none active:scale-[0.98] sm:flex-none',
              'focus-visible:ring-2 focus-visible:ring-primary/60',
              isSelected
                ? 'border border-primary/35 bg-primary/15 text-primary shadow-sm font-semibold'
                : 'border border-transparent text-muted-foreground hover:border-white/10 hover:bg-white/[0.04] hover:text-foreground'
            )}
          >
            {option.glyph}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
