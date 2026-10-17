import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SettingsRowProps {
  label: string
  /** Explanatory copy or active state sublabel under the label. */
  hint?: ReactNode
  control: ReactNode
  className?: string
  /** Keep control on the same line as label on mobile (ideal for switches and compact wells). */
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
          'grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-0.5 py-3.5',
          className
        )}
      >
        <span className="text-sm font-medium text-foreground tracking-tight">
          {label}
        </span>

        <div
          className={cn(
            'flex shrink-0 items-center justify-end',
            hint ? 'row-span-2' : 'row-span-1'
          )}
        >
          {control}
        </div>

        {hint && (
          <div className="col-span-1 text-xs leading-snug text-muted-foreground/80 sm:max-w-md">
            {hint}
          </div>
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
