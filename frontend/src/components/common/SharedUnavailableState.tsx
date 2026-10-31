import type { ComponentType, ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Link2Off } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface SharedUnavailableStateProps {
  title: ReactNode
  description?: ReactNode
  icon?: ComponentType<{ className?: string }>
  actions?: ReactNode
  className?: string
}

export function SharedUnavailableState({
  title,
  description,
  icon: Icon = Link2Off,
  actions,
  className,
}: SharedUnavailableStateProps) {
  const { t } = useTranslation()

  return (
    <div
      role="status"
      className={cn(
        'flex flex-1 flex-col items-center justify-center w-full px-4 py-12 sm:py-20 animate-in fade-in duration-300',
        className
      )}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-card/60 p-6 sm:p-8 backdrop-blur-md shadow-2xl text-center space-y-5">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-muted-foreground/80 shadow-xs">
          <Icon className="size-5" />
        </div>

        <div className="space-y-2">
          <h2 className="text-base sm:text-lg font-sans font-semibold tracking-tight text-foreground [text-wrap:balance]">
            {title}
          </h2>
          {description && (
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed [text-wrap:pretty] max-w-xs sm:max-w-sm mx-auto">
              {description}
            </p>
          )}
        </div>

        {actions !== undefined ? (
          actions
        ) : (
          <div className="flex items-center justify-center pt-1">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-white/10 bg-white/[0.02] hover:bg-white/[0.06] text-muted-foreground hover:text-foreground gap-2"
            >
              <Link to="/">
                <Home className="size-4" />
                <span>{t('sharing.backToHome')}</span>
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
