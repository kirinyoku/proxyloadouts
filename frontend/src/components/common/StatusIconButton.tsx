import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface StatusIconButtonProps extends Omit<ButtonProps, 'variant'> {
  indicator?: boolean
}

export function StatusIconButton({
  indicator = false,
  size = 'icon',
  className,
  children,
  ...props
}: StatusIconButtonProps) {
  return (
    <Button
      variant="secondary"
      size={size}
      className={cn(
        'relative shrink-0 rounded-lg border-2 border-border/60 bg-card/80 bg-clip-border text-muted-foreground shadow-xs transition-all hover:border-white/20 hover:bg-elevated hover:text-foreground aria-expanded:border-white/20 aria-expanded:bg-elevated aria-expanded:text-foreground focus-visible:border-primary/80 focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-px cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
      {indicator && (
        <span
          data-slot="status-indicator"
          aria-hidden="true"
          className="pointer-events-none absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary"
        />
      )}
    </Button>
  )
}
