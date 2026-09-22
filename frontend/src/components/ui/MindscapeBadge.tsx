import { cn } from '@/lib/utils'

export interface MindscapeBadgeProps {
  /** Mindscape Cinema level (0 to 6) */
  level: number
  /** Visual scale */
  size?: 'sm' | 'md' | 'lg' | 'xl'
  /** 'avatar' for absolute corner placement on circular avatar; 'inline' for text flow / headers */
  variant?: 'avatar' | 'inline'
  /** Whether to show when level is 0 (defaults to false for avatar, true for inline) */
  showZero?: boolean
  className?: string
  'data-testid'?: string
}

/**
 * Pure White on Black Mindscape Cinema Badge.
 * High optical contrast, minimal geometry, zero clutter.
 */
export function MindscapeBadge({
  level,
  size = 'md',
  variant = 'avatar',
  showZero = variant === 'inline',
  className,
  'data-testid': testId = 'mindscape-badge',
}: MindscapeBadgeProps) {
  if (level <= 0 && !showZero) {
    return null
  }

  const avatarSizeClasses = {
    sm: 'h-3.5 px-1 text-[9px] -bottom-0.5 -right-0.5',
    md: 'h-4 px-1.5 text-[10px] -bottom-1 -right-1',
    lg: 'h-4 px-1.5 text-[10px] -bottom-1 -right-1',
    xl: 'h-4.5 px-1.5 text-[11px] -bottom-1 -right-1',
  }

  const inlineSizeClasses = {
    sm: 'h-5 px-2 text-[10.5px]',
    md: 'h-6 px-2.5 text-xs',
    lg: 'h-6.5 px-3 text-[13px]',
    xl: 'h-7 px-3 text-sm',
  }

  if (variant === 'inline') {
    return (
      <span
        data-testid={testId}
        title={`Mindscape Cinema M${level}`}
        aria-label={`Mindscape Cinema M${level}`}
        className={cn(
          'inline-flex items-center justify-center rounded-full font-sans font-black leading-none tracking-tight select-none',
          'bg-black text-white border border-white/20 shadow-xs',
          level === 0 && 'text-muted-foreground border-white/10 opacity-75',
          inlineSizeClasses[size],
          className,
        )}
      >
        M{level}
      </span>
    )
  }

  return (
    <span
      data-testid={testId}
      title={`Mindscape Cinema M${level}`}
      aria-label={`Mindscape Cinema M${level}`}
      className={cn(
        'absolute z-20 flex items-center justify-center rounded-full font-sans font-black leading-none tracking-tight select-none',
        'bg-black text-white ring-1.5 ring-background shadow-md border border-white/20',
        avatarSizeClasses[size],
        className,
      )}
    >
      M{level}
    </span>
  )
}
