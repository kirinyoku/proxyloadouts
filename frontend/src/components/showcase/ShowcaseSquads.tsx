import { useDeferredValue, useMemo, useState } from 'react'
import { Search, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/common/EmptyState'
import { TeamCard } from '@/components/teams/TeamCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TeamSummary } from '@/types'

export interface ShowcaseSquadsProps {
  teams: TeamSummary[]
}

export function ShowcaseSquads({ teams }: ShowcaseSquadsProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)

  const filteredTeams = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase()
    if (!query) return teams

    return teams.filter((summary) => {
      const matchName = summary.team.name.toLowerCase().includes(query)
      const matchDesc = summary.team.description?.toLowerCase().includes(query) ?? false
      const matchAgent = summary.members?.some(
        (m) =>
          m.build.agent_name?.toLowerCase().includes(query) ||
          m.build.name?.toLowerCase().includes(query) ||
          m.build.build_data?.name?.toLowerCase().includes(query),
      ) ?? false

      return matchName || matchDesc || matchAgent
    })
  }, [teams, deferredSearch])

  if (teams.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t('showcase.noPublicSquads')}
        description=""
      />
    )
  }

  const showSearch = teams.length > 2 || search.trim().length > 0

  return (
    <div className="space-y-3">
      {/* Search Bar (shown when there are > 2 squads or an active search query) */}
      {showSearch && (
        <div className="relative w-full sm:max-w-xs md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('teams.searchPlaceholder')}
            className="h-9 w-full rounded-[10px_10px_0_10px] border-border/60 bg-card/80 pl-9 pr-8 text-xs placeholder:text-muted-foreground/60 focus-visible:border-primary/80 focus-visible:ring-1 focus-visible:ring-primary/40 sm:text-sm shadow-xs"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label={t('teams.clearSearchAria')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/80 active:scale-95"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Filtered squads grid or empty state */}
      {filteredTeams.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t('teams.noResultsTitle')}
          description={t('teams.noResultsDesc')}
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              {t('teams.resetFilters')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
          {filteredTeams.map((summary) => (
            <TeamCard
              key={summary.team.id}
              summary={summary}
              readOnly
            />
          ))}
        </div>
      )}
    </div>
  )
}
