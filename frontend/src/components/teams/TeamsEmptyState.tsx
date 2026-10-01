import { FilterX, Link2, Plus, RotateCcw, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
      <Card className="border-dashed border-border/60 bg-card/60">
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
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
        </CardContent>
      </Card>
    )
  }

  if (props.variant === 'no-results') {
    return (
      <Card className="border-dashed border-border/60 bg-card/40">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <FilterX className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t('teams.noResultsDesc')}
          </p>
          <Button variant="outline" size="sm" onClick={props.onResetFilters} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            {t('teams.resetFilters')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-dashed border-border/60 bg-card/40">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
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
      </CardContent>
    </Card>
  )
}
