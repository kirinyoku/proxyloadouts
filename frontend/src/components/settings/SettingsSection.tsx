import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsSectionProps {
  /** Zero-padded ordinal rendered as a mono eyebrow, e.g. "01". */
  index: string
  title: string
  icon: LucideIcon
  description?: string
  /** Right-aligned header slot: counters, status pills, actions. */
  action?: ReactNode
  /** Pinned bottom block separated by a hairline: forms, hints. */
  footer?: ReactNode
  tone?: 'default' | 'danger'
  children?: ReactNode
}

/**
 * Single settings block: numbered header with icon + description, hairline
 * separated rows, optional counter/action in the header and an optional
 * footer for inline forms.
 */
export function SettingsSection({
  index,
  title,
  icon: Icon,
  description,
  action,
  footer,
  tone = 'default',
  children,
}: SettingsSectionProps) {
  const isDanger = tone === 'danger'
  const headingId = `settings-section-${index}`

  return (
    <section aria-labelledby={headingId}>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border transition-colors shadow-sm',
          isDanger
            ? 'border-destructive/25 bg-card/40'
            : 'border-white/[0.08] bg-card/40'
        )}
      >
        <header className="flex flex-col gap-1.5 border-b border-white/[0.06] px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-7.5 sm:size-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                  isDanger
                    ? 'border-destructive/30 bg-destructive/10 text-destructive'
                    : 'border-white/10 bg-white/[0.04] text-primary'
                )}
              >
                <Icon className="size-4" />
              </span>

              <h2
                id={headingId}
                className={cn(
                  'text-sm font-semibold tracking-tight sm:text-[15px] truncate',
                  isDanger ? 'text-destructive' : 'text-foreground'
                )}
              >
                {title}
              </h2>
            </div>

            {action && <div className="shrink-0">{action}</div>}
          </div>

          {description && (
            <p className="text-xs text-muted-foreground/80 leading-relaxed pl-10 sm:pl-11">
              {description}
            </p>
          )}
        </header>

        {children != null && <div className="px-4 sm:px-5">{children}</div>}

        {footer && (
          <div className="border-t border-white/[0.06] bg-black/20 px-4 py-3.5 sm:px-5">
            {footer}
          </div>
        )}
      </div>
    </section>
  )
}
