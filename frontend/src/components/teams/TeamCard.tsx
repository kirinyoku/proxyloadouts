import { lazy, memo, Suspense, useMemo, useState } from 'react'
import { AlertCircle, Pencil, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from '@/components/ui/sonner'
import { ApiError } from '@/api/client'
import { queryKeys, useBuilds, useDeleteTeam, useUpdateTeam } from '@/api/hooks'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Build, TeamDetail, TeamSummary } from '@/types'
import { TeamMemberPreview } from './TeamMemberPreview'

const BuildPickerDialog = lazy(() =>
  import('@/components/teambuilder/BuildPickerDialog').then((module) => ({
    default: module.BuildPickerDialog,
  })),
)

const BuildInspectorDialog = lazy(() =>
  import('@/components/roster/BuildInspectorDialog').then((module) => ({
    default: module.BuildInspectorDialog,
  })),
)

export interface TeamCardProps {
  summary: TeamSummary
  index: number
}

export const TeamCard = memo(function TeamCard({ summary, index }: TeamCardProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const deleteMutation = useDeleteTeam()
  const updateMutation = useUpdateTeam()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activePickerSlot, setActivePickerSlot] = useState<number | null>(null)
  const [updatingSlot, setUpdatingSlot] = useState<number | null>(null)
  const [inspectBuild, setInspectBuild] = useState<Build | null>(null)

  const { team, members, report } = summary
  const sortedMembers = useMemo(
    () => [...(members ?? [])].sort((a, b) => a.slot_number - b.slot_number),
    [members],
  )
  const squadIndex = String(index + 1).padStart(2, '0')
  const hasConflict = Boolean(report && !report.is_valid)

  const buildsQuery = useBuilds(team.game_account_id, { enabled: activePickerSlot !== null })
  const builds = buildsQuery.data ?? []

  const usedBuildIds = useMemo(() => {
    return new Set(sortedMembers.map((m) => m.build.id))
  }, [sortedMembers])

  const pickerSquadBuilds = useMemo(() => {
    if (activePickerSlot === null) return []
    return sortedMembers
      .filter((m) => m.slot_number !== activePickerSlot)
      .map((m) => m.build)
  }, [activePickerSlot, sortedMembers])

  function handleSelectBuild(buildId: string) {
    if (activePickerSlot === null) return
    const targetSlot = activePickerSlot
    setActivePickerSlot(null)
    setUpdatingSlot(targetSlot)

    const slotArray: (string | null)[] = [null, null, null]
    sortedMembers.forEach((m) => {
      if (m.slot_number >= 1 && m.slot_number <= 3) {
        slotArray[m.slot_number - 1] = m.build.id
      }
    })
    slotArray[targetSlot - 1] = buildId
    const newBuildIds = slotArray.filter((id): id is string => id !== null)

    updateMutation.mutate(
      {
        id: team.id,
        game_account_id: team.game_account_id,
        name: team.name,
        description: team.description,
        build_ids: newBuildIds,
      },
      {
        onSettled: () => {
          setUpdatingSlot(null)
        },
        onError: (error) => {
          if (error instanceof ApiError && error.conflicts) {
            const reasons = error.conflicts.errors.map((e) => e.message).join('; ')
            toast.error(
              t('toasts.teamConflictToast', {
                reasons: reasons || t('toasts.teamConflictFallback'),
              }),
            )
          }
        },
      },
    )
  }

  function handleEdit() {
    const langKey = i18n.language?.slice(0, 2) === 'en' ? 'en' : 'ru'
    queryClient.setQueryData<TeamDetail>(queryKeys.team(team.id, langKey), {
      team,
      members: sortedMembers,
    })
  }

  return (
    <article
      aria-label={t('teams.teamAria', { name: team.name })}
      className={cn(
        'group relative flex flex-col justify-between space-y-3 sm:space-y-3.5 rounded-2xl border p-3.5 sm:p-5 transition-all duration-300 [contain-intrinsic-size:auto_380px] [content-visibility:auto]',
        'border-border/60 bg-card/80 shadow-[0_16px_40px_rgba(0,0,0,0.65)] hover:border-primary/50 hover:shadow-[0_20px_48px_rgba(0,0,0,0.8),0_0_24px_rgba(201,242,75,0.1)]',
        hasConflict &&
          'border-red-500/40 bg-gradient-to-b from-[#241217] to-[#1a0c10] hover:border-red-500/60 hover:shadow-[0_16px_40px_rgba(239,68,68,0.15)]',
      )}
    >
      {/* Top Header: Single compact row on all screens */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        {/* Squad Index, Conflict status & Team Title */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="flex h-5.5 items-center rounded-md border border-primary/40 bg-primary/15 px-2 font-mono text-xs font-bold text-primary shadow-xs shrink-0">
            #{squadIndex}
          </span>

          {hasConflict && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-destructive/40 bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive cursor-help"
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

          <h2
            className="truncate font-heading text-base sm:text-lg font-bold tracking-wide text-foreground"
            title={team.name}
          >
            {team.name}
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="group/btn size-7.5 sm:size-auto sm:h-8 sm:px-2.5 p-0 sm:py-0 gap-1.5 rounded-lg border border-white/15 bg-[#161d28] text-xs font-semibold text-foreground shadow-xs hover:border-primary/60 hover:bg-[#1c2432] hover:text-primary hover:shadow-[0_0_12px_rgba(201,242,75,0.15)] focus-visible:ring-1 focus-visible:ring-primary active:scale-[0.98] transition-all"
            asChild
          >
            <Link
              to={`/teams/${team.id}/edit`}
              onClick={handleEdit}
              aria-label={t('teams.editTeamAria', { name: team.name })}
              title={t('teams.editTeam')}
            >
              <Pencil className="size-3.5 text-muted-foreground transition-colors group-hover/btn:text-primary" />
              <span className="hidden sm:inline">{t('teams.editTeam')}</span>
            </Link>
          </Button>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="group/del size-7.5 sm:size-8 rounded-lg border border-white/15 bg-[#161d28] text-muted-foreground shadow-xs hover:border-destructive/60 hover:bg-destructive/20 hover:text-destructive hover:shadow-[0_0_12px_rgba(239,68,68,0.2)] focus-visible:ring-1 focus-visible:ring-destructive active:scale-[0.98] transition-all"
                aria-label={t('teams.deleteTeam')}
                title={t('teams.deleteTeam')}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="size-3.5 transition-colors group-hover/del:text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('teams.deleteDialogTitle', { name: team.name })}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('teams.deleteDialogDesc')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('teams.deleteDialogCancel')}</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={deleteMutation.isPending}
                  onClick={() =>
                    deleteMutation.mutate({
                      id: team.id,
                      gameAccountId: team.game_account_id,
                    })
                  }
                >
                  {deleteMutation.isPending ? t('teams.deleteDialogDeleting') : t('teams.deleteDialogConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* 3 Squad Member Slots */}
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {[1, 2, 3].map((slotNumber) => {
          const member = sortedMembers.find((m) => m.slot_number === slotNumber)
          return (
            <TeamMemberPreview
              key={slotNumber}
              member={member}
              slotNumber={slotNumber}
              teamId={team.id}
              onAddClick={() => setActivePickerSlot(slotNumber)}
              onInspectClick={(b) => setInspectBuild(b)}
              isUpdating={updatingSlot === slotNumber}
            />
          )
        })}
      </div>

      {activePickerSlot !== null && (
        <Suspense fallback={null}>
          <BuildPickerDialog
            open={activePickerSlot !== null}
            builds={builds}
            squadBuilds={pickerSquadBuilds}
            usedBuildIds={usedBuildIds}
            onSelect={handleSelectBuild}
            onOpenChange={(open) => {
              if (!open) setActivePickerSlot(null)
            }}
          />
        </Suspense>
      )}

      {inspectBuild !== null && (
        <Suspense fallback={null}>
          <BuildInspectorDialog
            key={inspectBuild.id}
            build={inspectBuild}
            open={inspectBuild !== null}
            onOpenChange={(open) => {
              if (!open) setInspectBuild(null)
            }}
            teamName={team.name}
          />
        </Suspense>
      )}

      {/* Footer: Description & Updated Date */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 border-t border-white/10 pt-2.5 text-xs text-muted-foreground">
        <div className="min-w-0 flex-1">
          {team.description?.trim() && (
            <p
              className="text-xs font-medium text-muted-foreground/80 line-clamp-2 sm:truncate transition-colors hover:text-foreground/90"
              title={team.description.trim()}
            >
              <span className="mr-1.5 select-none font-mono font-bold text-primary/70">//</span>
              {team.description.trim()}
            </p>
          )}
        </div>

        <span className="shrink-0 text-[11px] text-muted-foreground/60 font-mono sm:text-right">
          {t('teams.updatedAt', { date: formatDateTime(team.updated_at) })}
        </span>
      </div>
    </article>
  )
})
