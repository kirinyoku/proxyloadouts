import { Check, Share2 } from 'lucide-react'
import type { ButtonProps } from '@/components/ui/button'
import { StatusIconButton } from '@/components/common/StatusIconButton'
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
    <StatusIconButton
      indicator={isPublic && !copied}
      size={size}
      className={cn(
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
    </StatusIconButton>
  )
}
