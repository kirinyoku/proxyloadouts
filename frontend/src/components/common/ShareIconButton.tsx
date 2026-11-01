import { Check, Share2 } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ShareIconButtonProps
  extends Omit<ButtonProps, 'variant' | 'children'> {
  isPublic?: boolean
  copied?: boolean
  iconClassName?: string
}

export function ShareIconButton({
  isPublic = false,
  copied = false,
  size = 'icon',
  className,
  iconClassName,
  ...props
}: ShareIconButtonProps) {
  const iconSizeClass = size === 'icon-lg' ? 'size-3.5' : 'size-3'

  return (
    <Button
      variant="secondary"
      size={size}
      className={cn(
        'relative shrink-0 rounded-lg border-2 border-border/60 bg-card/80 bg-clip-border text-muted-foreground shadow-xs transition-all hover:border-white/20 hover:bg-elevated hover:text-foreground aria-expanded:border-white/20 aria-expanded:bg-elevated aria-expanded:text-foreground focus-visible:border-primary/80 focus-visible:ring-2 focus-visible:ring-primary/40 active:translate-y-px cursor-pointer',
        copied && 'border-primary/50 bg-primary/10 text-primary',
        className,
      )}
      {...props}
    >
      {copied ? (
        <Check className={cn(iconSizeClass, 'text-primary stroke-[2.5]', iconClassName)} />
      ) : (
        <Share2 className={cn(iconSizeClass, iconClassName)} />
      )}
      {isPublic && !copied && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0.5 right-0.5 size-1.5 rounded-full bg-primary"
        />
      )}
    </Button>
  )
}
