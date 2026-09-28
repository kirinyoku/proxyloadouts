import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SettingsRowProps {
  label: string
  /** Explanatory copy under the label. */
  hint?: string
  control: ReactNode
  className?: string
  /** Keep control on the same line as label on mobile (ideal for switches). */
  inline?: boolean
}

/**
 * Settings row component. Supports both stacked mobile layout (for wide selectors)
 * and horizontal inline layout (for binary toggles and compact controls).
 */
export function SettingsRow({
  label,
  hint,
  control,
  className,
  inline = false,
}: SettingsRowProps) {
  if (inline) {
    return (
      <div
        className={cn(
          'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-3.5 sm:py-4',
          className
        )}
      >
        <span className="text-sm font-medium text-foreground tracking-tight">
          {label}
        </span>

        <div className="row-span-1 flex shrink-0 items-center justify-end sm:row-span-2">
          {control}
        </div>

        {hint && (
          <p className="col-span-2 text-xs leading-relaxed text-muted-foreground/80 sm:col-span-1 sm:max-w-md">
            {hint}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2.5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <span className="block text-sm font-medium text-foreground tracking-tight">
          {label}
        </span>
        {hint && (
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground/80">{hint}</p>
        )}
      </div>

      <div className="flex w-full shrink-0 items-center sm:w-auto sm:justify-end">
        {control}
      </div>
    </div>
  )
}
