import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface TeamsHeaderProps {
  totalCount?: number
}

export function TeamsHeader({ totalCount = 0 }: TeamsHeaderProps) {
  const { t } = useTranslation()
  const formattedCount = String(totalCount).padStart(2, '0')
  const isMaxTeams = totalCount >= 15

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3 sm:pb-4">
      <h1 className="font-heading text-xl font-bold tracking-wide text-white sm:text-2xl md:text-3xl">
        {t('teams.title')}
        {totalCount > 0 && (
          <span
            className="ml-2 sm:ml-3"
            aria-label={t('teams.totalAria', { count: totalCount })}
            title={t('teams.totalAria', { count: totalCount })}
          >
            <span className="text-primary select-none">//</span>{' '}
            <span className="text-muted-foreground">{formattedCount}</span>
          </span>
        )}
      </h1>

      {isMaxTeams ? (
        <Button
          disabled
          title={t('teams.limitReachedTooltip')}
          className="gap-1.5"
        >
          <Plus className="size-4" />
          {t('teams.createSquad')}
        </Button>
      ) : (
        <Button asChild className="gap-1.5">
          <Link to="/teams/new">
            <Plus className="size-4" />
            {t('teams.createSquad')}
          </Link>
        </Button>
      )}
    </div>
  )
}
