import { FilterX, Link2, Plus, RotateCcw, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

interface TeamsNoAccountStateProps {
  variant: 'no-account'
}

interface TeamsNoTeamsStateProps {
  variant: 'no-teams'
}

interface TeamsNoResultsStateProps {
  variant: 'no-results'
  onResetFilters: () => void
}

type TeamsEmptyStateProps =
  | TeamsNoAccountStateProps
  | TeamsNoTeamsStateProps
  | TeamsNoResultsStateProps

export function TeamsEmptyState(props: TeamsEmptyStateProps) {
  const { t } = useTranslation()

  if (props.variant === 'no-account') {
    return (
      <div className="relative rounded-2xl border border-white/[0.08] bg-[#111620]/90 p-8 sm:py-12 shadow-lg backdrop-blur-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <Link2 className="size-8 text-muted-foreground" />
          <p className="max-w-md text-sm text-muted-foreground">
            {t('teams.noAccountDesc')}
          </p>
          <Button asChild className="gap-1.5">
            <Link to="/settings">
              <Plus className="size-4" />
              {t('teams.linkUid')}
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  if (props.variant === 'no-results') {
    return (
      <div className="relative rounded-2xl border border-white/[0.08] bg-[#111620]/90 p-8 sm:py-10 shadow-lg backdrop-blur-xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <FilterX className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t('teams.noResultsDesc')}
          </p>
          <Button variant="outline" size="sm" onClick={props.onResetFilters} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            {t('teams.resetFilters')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative rounded-2xl border border-white/[0.08] bg-[#111620]/90 p-8 sm:py-10 shadow-lg backdrop-blur-xl">
      <div className="flex flex-col items-center gap-3 text-center">
        <UsersRound className="size-8 text-muted-foreground" />
        <p className="max-w-md text-sm text-muted-foreground">
          {t('teams.noTeamsDesc')}
        </p>
        <Button asChild className="gap-1.5">
          <Link to="/teams/new">
            <Plus className="size-4" />
            {t('teams.createSquad')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
