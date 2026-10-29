import { lazy, Suspense, useDeferredValue, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, Search, Share2, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/common/EmptyState'
import { TeamMemberPreview } from '@/components/teams/TeamMemberPreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/sonner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Build, TeamSummary } from '@/types'

const BuildInspectorDialog = lazy(() =>
  import('@/components/roster/BuildInspectorDialog').then((module) => ({
    default: module.BuildInspectorDialog,
  })),
)

export interface ShowcaseSquadsProps {
  teams: TeamSummary[]
}

export function ShowcaseSquads({ teams }: ShowcaseSquadsProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const deferredSearch = useDeferredValue(search)
  const [inspectBuild, setInspectBuild] = useState<Build | null>(null)
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

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

  async function handleCopyTeamLink(teamId: string) {
    const url = `${window.location.origin}/t/${teamId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedTeamId(teamId)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopiedTeamId(null), 2000)
      toast.success(t('showcase.squadLinkCopied'))
    } catch {
      // clipboard access error ignored
    }
  }

  const showSearch = teams.length > 2 || search.trim().length > 0

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* Search Bar (shown when there are > 2 squads or an active search query) */}
      {showSearch && (
        <div className="flex items-center justify-between gap-3">
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
          <span className="text-xs font-mono text-muted-foreground shrink-0 hidden sm:inline">
            {`${filteredTeams.length} / ${teams.length}`}
          </span>
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
          {filteredTeams.map((summary) => {
            const { team, members, report } = summary
            const sortedMembers = [...(members ?? [])].sort((a, b) => a.slot_number - b.slot_number)
            const hasConflict = Boolean(report && !report.is_valid)

            return (
              <article
                key={team.id}
                aria-label={t('teams.teamAria', { name: team.name })}
                className={cn(
                  'relative flex flex-col gap-3 sm:gap-3.5 rounded-(--radius-card) border-2 border-black bg-card p-3.5 sm:p-5',
                  'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-16px_rgba(0,0,0,0.9)]',
                  hasConflict && 'bg-[color-mix(in_oklch,var(--card),var(--destructive)_7%)]',
                )}
              >
                {/* Top rim accent */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute inset-x-8 -top-0.5 h-0.5 bg-linear-to-r from-transparent to-transparent',
                    hasConflict ? 'via-destructive' : 'via-primary/60',
                  )}
                />

                {/* Squad Header: Single compact row */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {hasConflict && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            className="inline-flex h-5 shrink-0 cursor-help items-center gap-1 rounded-[4px_4px_0_4px] border border-black bg-destructive px-1.5 font-heading text-[10px] leading-none tracking-wide text-white"
                          >
                            <AlertCircle className="size-3" />
                            <span>{t('teams.conflictBadge')}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {t('teams.conflictTooltip')}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    <h3
                      className="truncate font-heading text-base sm:text-lg leading-tight tracking-wide text-foreground"
                      title={team.name}
                    >
                      {team.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopyTeamLink(team.id)}
                      title={t('showcase.copySquadLink')}
                      aria-label={t('showcase.copySquadLink')}
                      className="size-8 p-0 sm:w-auto sm:px-3 gap-1.5 rounded-(--radius-input) border-2 border-black bg-elevated text-xs text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-accent hover:text-primary active:translate-y-px cursor-pointer"
                    >
                      {copiedTeamId === team.id ? (
                        <>
                          <Check className="size-3.5 stroke-[2.5] text-primary" />
                          <span className="hidden sm:inline">{t('sharing.linkCopied')}</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="size-3.5" />
                          <span className="hidden sm:inline">{t('sharing.share')}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Squad Members */}
                <div className="flex flex-col gap-2 sm:gap-2.5">
                  {[1, 2, 3].map((slotNumber) => {
                    const member = sortedMembers.find((m) => m.slot_number === slotNumber)
                    if (!member) return null
                    return (
                      <TeamMemberPreview
                        key={slotNumber}
                        member={member}
                        slotNumber={slotNumber}
                        teamId={team.id}
                        onInspectClick={(build) => setInspectBuild(build)}
                      />
                    )
                  })}
                </div>

                {/* Footer: Description & Updated Date */}
                <div className="mt-auto flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 border-t border-dashed border-white/10 pt-2.5 text-xs text-muted-foreground">
                  <div className="min-w-0 flex-1">
                    {team.description?.trim() && (
                      <p
                        className="text-xs font-medium text-muted-foreground line-clamp-2 sm:truncate"
                        title={team.description.trim()}
                      >
                        <span className="mr-1.5 select-none font-heading text-primary">//</span>
                        {team.description.trim()}
                      </p>
                    )}
                  </div>

                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground sm:text-right">
                    {t('teams.updatedAt', { date: formatDateTime(team.updated_at || team.created_at) })}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* Build Inspector Dialog */}
      {inspectBuild !== null && (
        <Suspense fallback={null}>
          <BuildInspectorDialog
            key={inspectBuild.id}
            build={inspectBuild}
            open={inspectBuild !== null}
            onOpenChange={(open) => {
              if (!open) setInspectBuild(null)
            }}
            publicMode={true}
            isPublicView={true}
          />
        </Suspense>
      )}
    </div>
  )
}
