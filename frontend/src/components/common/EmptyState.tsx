import type { ComponentType, ReactNode } from 'react'
import type { LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  /**
   * Lucide icon component or custom ReactNode to display.
   */
  icon?: ComponentType<LucideProps> | ReactNode
  /**
   * Optional custom styling for the icon container badge.
   */
  iconBadgeClassName?: string
  /**
   * Optional custom styling for the icon itself (if icon is a component).
   */
  iconClassName?: string
  /**
   * Primary title of the empty state (rendered as h3).
   */
  title?: ReactNode
  /**
   * Explanatory text/description.
   */
  description?: ReactNode
  /**
   * Call-to-action button or link element(s).
   */
  action?: ReactNode
  /**
   * Extra custom children to render below the action/description.
   */
  children?: ReactNode
  /**
   * Visual scale variant.
   * @default 'default'
   */
  size?: 'default' | 'sm'
  /**
   * Additional className applied to the root card container.
   */
  className?: string
}

export function EmptyState({
  icon: Icon,
  iconBadgeClassName,
  iconClassName,
  title,
  description,
  action,
  children,
  size = 'default',
  className,
}: EmptyStateProps) {
  const isIconComponent =
    typeof Icon === 'function' ||
    (typeof Icon === 'object' && Icon !== null && 'render' in Icon)

  const isSmall = size === 'sm'

  return (
    <div
      role="status"
      className={cn(
        'relative rounded-2xl border border-white/[0.08] bg-[#111620]/96 shadow-lg backdrop-blur-sm',
        isSmall ? 'p-6 sm:py-8' : 'p-8 sm:py-12',
        className
      )}
    >
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        {Icon && (
          <div
            className={cn(
              'flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-muted-foreground shadow-xs',
              isSmall ? 'size-10' : 'size-12',
              iconBadgeClassName
            )}
          >
            {isIconComponent ? (
              // @ts-expect-error Lucide/React component dynamic call
              <Icon
                className={cn(
                  'text-muted-foreground/80',
                  isSmall ? 'size-5' : 'size-6',
                  iconClassName
                )}
              />
            ) : (
              (Icon as ReactNode)
            )}
          </div>
        )}

        {(title || description) && (
          <div className="max-w-md space-y-1.5">
            {title && (
              <h3
                className={cn(
                  'font-heading font-bold text-foreground',
                  isSmall ? 'text-base' : 'text-lg'
                )}
              >
                {title}
              </h3>
            )}
            {description && (
              <p
                className={cn(
                  'leading-relaxed text-muted-foreground',
                  isSmall ? 'text-xs' : 'text-sm'
                )}
              >
                {description}
              </p>
            )}
          </div>
        )}

        {action && <div className="mt-1">{action}</div>}

        {children}
      </div>
    </div>
  )
}
