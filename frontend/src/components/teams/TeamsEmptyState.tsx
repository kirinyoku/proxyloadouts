import { FilterX, Link2, Plus, RotateCcw, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/common/EmptyState'
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
      <EmptyState
        icon={Link2}
        title={t('teams.noAccountTitle')}
        description={t('teams.noAccountDesc')}
        action={
          <Button asChild className="gap-1.5">
            <Link to="/settings">
              <Plus className="size-4" />
              {t('teams.linkUid')}
            </Link>
          </Button>
        }
      />
    )
  }

  if (props.variant === 'no-results') {
    return (
      <EmptyState
        icon={FilterX}
        title={t('teams.noResultsTitle')}
        description={t('teams.noResultsDesc')}
        action={
          <Button variant="outline" size="sm" onClick={props.onResetFilters} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            {t('teams.resetFilters')}
          </Button>
        }
      />
    )
  }

  return (
    <EmptyState
      icon={UsersRound}
      title={t('teams.noTeamsTitle')}
      description={t('teams.noTeamsDesc')}
      action={
        <Button asChild className="gap-1.5">
          <Link to="/teams/new">
            <Plus className="size-4" />
            {t('teams.createSquad')}
          </Link>
        </Button>
      }
    />
  )
}
