import { lazy, memo, Suspense, useMemo, useState } from 'react'
import { AlertCircle, Globe, Lock, Pencil, Share2, Trash2 } from 'lucide-react'
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
}

export const TeamCard = memo(function TeamCard({ summary }: TeamCardProps) {
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

  async function handleShareTeam() {
    const url = `${window.location.origin}/t/${team.id}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // ignore
    }

    if (!team.is_public) {
      updateMutation.mutate(
        {
          id: team.id,
          game_account_id: team.game_account_id,
          name: team.name,
          description: team.description,
          build_ids: sortedMembers.map((m) => m.build.id),
          is_public: true,
        },
        {
          onSuccess: () => {
            toast.success(t('sharing.linkCopiedPublishedTeam'))
          },
        },
      )
    } else {
      toast.success(t('sharing.linkCopied'))
    }
  }

  function handleToggleTeamVisibility(newPublic: boolean) {
    updateMutation.mutate(
      {
        id: team.id,
        game_account_id: team.game_account_id,
        name: team.name,
        description: team.description,
        build_ids: sortedMembers.map((m) => m.build.id),
        is_public: newPublic,
      },
      {
        onSuccess: () => {
          toast.success(
            newPublic ? t('sharing.teamPublished') : t('sharing.teamMadePrivate'),
          )
        },
      },
    )
  }

  return (
    <article
      aria-label={t('teams.teamAria', { name: team.name })}
      className={cn(
        'relative flex flex-col gap-3 sm:gap-3.5 rounded-(--radius-card) border-2 border-black bg-card p-3.5 sm:p-5 [contain-intrinsic-size:auto_380px] [content-visibility:auto]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-16px_rgba(0,0,0,0.9)]',
        hasConflict && 'bg-[color-mix(in_oklch,var(--card),var(--destructive)_7%)]',
      )}
    >
      {/* Top rim accent sitting on the ink border (same idea as .glow-top, but
          inset from the rounded corners so the card does not need overflow-hidden) */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-x-8 -top-0.5 h-0.5 bg-linear-to-r from-transparent to-transparent',
          hasConflict ? 'via-destructive' : 'via-primary/60',
        )}
      />

      {/* Top Header: Single compact row on all screens */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        {/* Conflict status & Team Title */}
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

          <h2
            className="truncate font-heading text-base sm:text-lg leading-tight tracking-wide text-foreground"
            title={team.name}
          >
            {team.name}
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Visibility toggle / indicator */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleToggleTeamVisibility(!team.is_public)}
                disabled={updateMutation.isPending}
                aria-label={team.is_public ? t('sharing.teamPublicTooltip') : t('sharing.teamPrivateTooltip')}
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-(--radius-input) border-2 border-black transition-all cursor-pointer select-none',
                  team.is_public
                    ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                    : 'bg-elevated text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {team.is_public ? (
                  <Globe className="size-3.5" />
                ) : (
                  <Lock className="size-3.5" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {team.is_public ? t('sharing.teamPublicTooltip') : t('sharing.teamPrivateTooltip')}
            </TooltipContent>
          </Tooltip>

          {/* Share button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleShareTeam}
            disabled={updateMutation.isPending}
            className="size-8 p-0 sm:w-auto sm:px-3 gap-1.5 rounded-(--radius-input) border-2 border-black bg-elevated text-xs text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-accent hover:text-primary active:translate-y-px"
            title={t('sharing.share')}
            aria-label={t('sharing.share')}
          >
            <Share2 className="size-3.5" />
            <span className="hidden sm:inline">{t('sharing.share')}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="size-8 p-0 sm:w-auto sm:px-3 gap-1.5 rounded-(--radius-input) border-2 border-black bg-elevated text-xs text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-accent hover:text-primary active:translate-y-px"
            asChild
          >
            <Link
              to={`/teams/${team.id}/edit`}
              onClick={handleEdit}
              aria-label={t('teams.editTeamAria', { name: team.name })}
              title={t('teams.editTeam')}
            >
              <Pencil className="size-3.5" />
              <span className="hidden sm:inline">{t('teams.editTeam')}</span>
            </Link>
          </Button>

          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                aria-label={t('teams.deleteTeam')}
                title={t('teams.deleteTeam')}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="size-3.5" />
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
          {t('teams.updatedAt', { date: formatDateTime(team.updated_at) })}
        </span>
      </div>
    </article>
  )
})
