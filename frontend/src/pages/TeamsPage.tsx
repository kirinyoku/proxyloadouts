import { useDeferredValue, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/client'
import { useTeams } from '@/api/hooks'
import { TeamFilterBar, type TeamSortOption } from '@/components/teams/TeamFilterBar'
import { TeamsEmptyState } from '@/components/teams/TeamsEmptyState'
import { TeamsHeader } from '@/components/teams/TeamsHeader'
import { TeamCard } from '@/components/teams/TeamCard'
import { TeamCardSkeleton } from '@/components/teams/TeamCardSkeleton'
import { TeamFilterBarSkeleton } from '@/components/teams/TeamFilterBarSkeleton'
import { InterknotTerminalError } from '@/components/common/InterknotTerminalError'
import { useActiveAccount } from '@/hooks/useActiveAccount'
import type { TeamSummary } from '@/types'

export function TeamsPage() {
  const { t, i18n } = useTranslation()
  const { activeAccount, accounts, isPending: accountsPending } = useActiveAccount()
  const teamsQuery = useTeams(activeAccount?.id)

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<TeamSortOption>('newest')
  const deferredSearch = useDeferredValue(search)

  const rawSummaries = useMemo<TeamSummary[]>(() => teamsQuery.data ?? [], [teamsQuery.data])

  const totalCount = rawSummaries.length

  // Filter and sort teams
  const filteredSummaries = useMemo(() => {
    const searchNorm = deferredSearch.trim().toLowerCase()

    const result = rawSummaries.filter((summary) => {
      // Search filter (team name, description, or member agent name)
      if (searchNorm) {
        const matchName = summary.team.name.toLowerCase().includes(searchNorm)
        const matchDescription = summary.team.description?.toLowerCase().includes(searchNorm) ?? false
        const matchAgent = summary.members?.some(
          (m) =>
            m.build.agent_name.toLowerCase().includes(searchNorm) ||
            m.build.name.toLowerCase().includes(searchNorm),
        ) ?? false

        if (!matchName && !matchDescription && !matchAgent) {
          return false
        }
      }

      return true
    })

    // Sorting
    return [...result].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.team.updated_at).getTime() - new Date(a.team.updated_at).getTime()
      }
      if (sortBy === 'oldest') {
        return new Date(a.team.updated_at).getTime() - new Date(b.team.updated_at).getTime()
      }
      if (sortBy === 'name') {
        return a.team.name.localeCompare(b.team.name, i18n.language || 'ru')
      }
      return 0
    })
  }, [deferredSearch, i18n.language, rawSummaries, sortBy])

  function handleResetFilters() {
    setSearch('')
    setSortBy('newest')
  }

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <title>{t('teams.pageTitle')}</title>
      <meta name="description" content={t('teams.metaDescription')} />
      {/* Page Header */}
      <TeamsHeader totalCount={totalCount} />

      {/* Account / Team States */}
      {accountsPending ? (
        <div className="space-y-3.5 sm:space-y-4" aria-busy="true">
          <TeamFilterBarSkeleton />
          <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <TeamCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <TeamsEmptyState variant="no-account" />
      ) : teamsQuery.isPending ? (
        <div className="space-y-3.5 sm:space-y-4" aria-busy="true">
          <TeamFilterBarSkeleton />
          <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <TeamCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : teamsQuery.isError ? (
        <InterknotTerminalError
          variant="compact"
          error={teamsQuery.error}
          errorCode={teamsQuery.error instanceof ApiError ? `${teamsQuery.error.status}_ERR` : '500_ERR'}
          title={teamsQuery.error instanceof ApiError ? teamsQuery.error.message : t('teams.loadError')}
          onRetry={() => void teamsQuery.refetch()}
          isRetrying={teamsQuery.isFetching}
        />
      ) : rawSummaries.length === 0 ? (
        <TeamsEmptyState variant="no-teams" />
      ) : (
        <div className="space-y-3.5 sm:space-y-4">
          {totalCount >= 15 && (
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 sm:px-4 py-2.5 text-xs text-amber-200">
              <AlertCircle className="size-4 shrink-0 text-amber-400" />
              <span>
                {t('teams.limitBanner')}
              </span>
            </div>
          )}

          {/* Search, Sort & Action Controls */}
          <TeamFilterBar
            search={search}
            onSearchChange={setSearch}
            sortBy={sortBy}
            onSortChange={setSortBy}
            totalCount={totalCount}
          />

          {filteredSummaries.length === 0 ? (
            <TeamsEmptyState variant="no-results" onResetFilters={handleResetFilters} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
              {filteredSummaries.map((summary) => (
                <TeamCard
                  key={summary.team.id}
                  summary={summary}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
