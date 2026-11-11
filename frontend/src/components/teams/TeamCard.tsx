import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, Globe, Lock, Pencil, Share2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from '@/components/ui/sonner'
import { ApiError, createTeamShare, revokeTeamShare } from '@/api/client'
import { queryKeys, useBuilds, useDeleteTeam, usePatchTeam, useUpdateTeam } from '@/api/hooks'
import { RevokeShareDialog } from '@/components/roster/RevokeShareDialog'
import { useShareStatus } from '@/components/roster/useShareStatus'
import { ShareIconButton } from '@/components/common/ShareIconButton'
import { NoteButton } from '@/components/common/NoteButton'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  readOnly?: boolean
  shareUrl?: string
}

export const TeamCard = memo(function TeamCard({
  summary,
  readOnly = false,
  shareUrl,
}: TeamCardProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const deleteMutation = useDeleteTeam()
  const updateMutation = useUpdateTeam()
  const patchMutation = usePatchTeam()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [activePickerSlot, setActivePickerSlot] = useState<number | null>(null)
  const [updatingSlot, setUpdatingSlot] = useState<number | null>(null)
  const [inspectBuild, setInspectBuild] = useState<Build | null>(null)
  const [teamLinkCopied, setTeamLinkCopied] = useState(false)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const shareStatus = useShareStatus('team', readOnly ? undefined : summary.team.id)
  const linkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (linkTimerRef.current) clearTimeout(linkTimerRef.current)
    }
  }, [])

  const { team, members, report } = summary
  const sortedMembers = useMemo(
    () => [...(members ?? [])].sort((a, b) => a.slot_number - b.slot_number),
    [members],
  )
  const hasConflict = Boolean(report && !report.is_valid)

  const isPending = updateMutation.isPending || patchMutation.isPending

  const buildsQuery = useBuilds(team.game_account_id, {
    enabled: !readOnly && activePickerSlot !== null,
  })
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
    try {
      let url = shareUrl || `${window.location.origin}/t/${team.id}`
      if (!readOnly) {
        const { token } = await createTeamShare(team.id)
        shareStatus.setActive(true)
        url = `${window.location.origin}/shared/team/${encodeURIComponent(token)}`
      }
      await navigator.clipboard.writeText(url)
      setTeamLinkCopied(true)
      if (linkTimerRef.current) clearTimeout(linkTimerRef.current)
      linkTimerRef.current = setTimeout(() => setTeamLinkCopied(false), 2000)
      toast.success(t('sharing.linkCopied'))
    } catch {
      toast.error(t('sharing.copyError'))
    }
  }

  async function handleRevokeTeamLink() {
    try {
      await revokeTeamShare(team.id)
      shareStatus.setActive(false)
      toast.success(t('sharing.revoked'))
    } catch {
      toast.error(t('sharing.revokeError'))
    }
  }

  function handleToggleTeamVisibility(newPublic: boolean) {
    patchMutation.mutate(
      {
        id: team.id,
        gameAccountId: team.game_account_id,
        body: { is_public: newPublic },
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

  const shareButton = (
    <ShareIconButton
      disabled={!readOnly && isPending}
      onClick={readOnly ? handleShareTeam : undefined}
      isPublic={team.is_public}
      copied={teamLinkCopied}
      aria-label={t('sharing.shareTeam')}
      title={t('sharing.shareTeam')}
    />
  )

  const shareMenu = readOnly ? (
    shareButton
  ) : (
    <DropdownMenu onOpenChange={(open) => { if (open) shareStatus.refresh() }}>
      <DropdownMenuTrigger asChild>
        {shareButton}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max min-w-0 max-w-[calc(100vw-2rem)] p-1.5">
        <DropdownMenuItem
          role="menuitemcheckbox"
          aria-checked={team.is_public}
          disabled={isPending}
          onSelect={() => handleToggleTeamVisibility(!team.is_public)}
          className="gap-2.5 px-2.5 py-1.5 whitespace-nowrap"
        >
          {team.is_public ? (
            <Globe className="size-4 text-primary" />
          ) : (
            <Lock className="size-4 text-muted-foreground" />
          )}
          {team.is_public ? t('sharing.isPublic') : t('sharing.isPrivate')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="gap-2.5 px-2.5 py-1.5 whitespace-nowrap"
          disabled={isPending}
          onSelect={handleShareTeam}
        >
          {teamLinkCopied ? (
            <Check className="size-4 text-primary stroke-[2.5]" />
          ) : (
            <Share2 className="size-4" />
          )}
          {t('sharing.shareTeam')}
        </DropdownMenuItem>
        <DropdownMenuLabel className="mt-0.5 border-t border-white/10 px-2.5 pt-1.5 pb-0.5 whitespace-nowrap">
          {t(`sharing.linkStatus_${shareStatus.status}`)}
        </DropdownMenuLabel>
        <DropdownMenuItem
          className="gap-2.5 px-2.5 py-1.5 whitespace-nowrap"
          disabled={isPending || shareStatus.status === 'inactive'}
          onSelect={() => setRevokeDialogOpen(true)}
        >
          <Lock className="size-4" />
          {t('sharing.revokeLink')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <article
      aria-label={t('teams.teamAria', { name: team.name })}
      className={cn(
        'relative flex flex-col gap-3 sm:gap-3.5 rounded-(--radius-card) border-2 border-black bg-card p-3.5 sm:p-5 [contain-intrinsic-size:auto_380px] [content-visibility:auto]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-16px_rgba(0,0,0,0.9)]',
        hasConflict && 'bg-[color-mix(in_oklch,var(--card),var(--destructive)_7%)]',
      )}
    >
      <RevokeShareDialog
        open={revokeDialogOpen}
        onOpenChange={setRevokeDialogOpen}
        onConfirm={handleRevokeTeamLink}
      />
      {/* Top rim accent sitting on the ink border */}
      {hasConflict && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 -top-0.5 h-0.5 bg-linear-to-r from-transparent via-destructive to-transparent"
        />
      )}

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
          <NoteButton
            note={team.description}
            title={t('notes.teamTitle')}
            subtitle={team.name}
            {...(readOnly
              ? { readOnly: true as const }
              : {
                  readOnly: false as const,
                  onSave: (next) =>
                    patchMutation.mutateAsync({
                      id: team.id,
                      gameAccountId: team.game_account_id,
                      body: { description: next },
                    }),
                  isSaving: patchMutation.isPending,
                })}
          />

          {shareMenu}

          {!readOnly && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* 3 Squad Member Slots */}
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {[1, 2, 3].map((slotNumber) => {
          const member = sortedMembers.find((m) => m.slot_number === slotNumber)
          if (readOnly && !member) return null
          return (
            <TeamMemberPreview
              key={slotNumber}
              member={member}
              slotNumber={slotNumber}
              teamId={team.id}
              onAddClick={readOnly ? undefined : () => setActivePickerSlot(slotNumber)}
              onInspectClick={(b) => setInspectBuild(b)}
              isUpdating={updatingSlot === slotNumber}
            />
          )
        })}
      </div>

      {!readOnly && activePickerSlot !== null && (
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

      {/* Footer: Updated Date */}
      <div className="mt-auto flex items-center justify-end border-t border-dashed border-white/10 pt-2.5 text-xs text-muted-foreground">
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {t('teams.updatedAt', { date: formatDateTime(team.updated_at) })}
        </span>
      </div>
    </article>
  )
})
