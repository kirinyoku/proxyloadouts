import { useMemo, useState } from 'react'
import { ArrowLeft, Link2, Plus } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/client'
import {
  useBuilds,
  useMe,
  useSaveTeam,
  useTeam,
  useTeamCount,
  useTeamValidationQuery,
  useUpdateTeam,
} from '@/api/hooks'
import { TeamBuilderHeader } from '@/components/teambuilder/TeamBuilderHeader'
import { TeamBuilderSidebar } from '@/components/teambuilder/TeamBuilderSidebar'
import { TeamConflictBanner } from '@/components/teambuilder/TeamConflictBanner'
import { TeamSlotList } from '@/components/teambuilder/TeamSlotList'
import { TeamBuilderHeaderSkeleton } from '@/components/teambuilder/TeamBuilderHeaderSkeleton'
import { TeamBuilderSidebarSkeleton } from '@/components/teambuilder/TeamBuilderSidebarSkeleton'
import { TeamSlotListSkeleton } from '@/components/teambuilder/TeamSlotListSkeleton'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { InterknotTerminalError } from '@/components/common/InterknotTerminalError'
import { useActiveAccount } from '@/hooks/useActiveAccount'
import { getDetailedSlotConflicts, getSlotConflicts } from '@/lib/conflicts'
import { generateTeamName } from '@/lib/teams'
import { useTeamDraftStore, type SlotNumber } from '@/store/useTeamDraftStore'
import type { Build, ConflictReport, TeamDetail } from '@/types'

/** Default maximum number of saved teams per game account when not customized for the user. */
const DEFAULT_MAX_TEAMS_PER_ACCOUNT = 100

function SlotsSkeleton() {
  return <TeamSlotListSkeleton />
}

interface TeamBuilderFormProps {
  isEditing: boolean
  teamId?: string
  teamDetail?: TeamDetail
  accountId: string
  builds: Build[]
  isLoadingBuilds: boolean
}

function TeamBuilderForm({
  isEditing,
  teamId,
  teamDetail,
  accountId,
  builds,
  isLoadingBuilds,
}: TeamBuilderFormProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const saveMutation = useSaveTeam()
  const updateMutation = useUpdateTeam()

  const draftSlots = useTeamDraftStore((state) => state.slots)
  const draftName = useTeamDraftStore((state) => state.name)
  const draftDescription = useTeamDraftStore((state) => state.description)
  const setDraftSlot = useTeamDraftStore((state) => state.setSlot)
  const clearDraftSlot = useTeamDraftStore((state) => state.clearSlot)
  const setDraftName = useTeamDraftStore((state) => state.setName)
  const setDraftDescription = useTeamDraftStore((state) => state.setDescription)
  const resetDraft = useTeamDraftStore((state) => state.reset)

  const initialEditSlots = useMemo<(string | null)[]>(() => {
    if (!teamDetail) return [null, null, null]
    const sorted = [...teamDetail.members].sort((a, b) => a.slot_number - b.slot_number)
    const slotArray: (string | null)[] = [null, null, null]
    sorted.forEach((m) => {
      if (m.slot_number >= 1 && m.slot_number <= 3) {
        slotArray[m.slot_number - 1] = m.build.id
      }
    })
    return slotArray
  }, [teamDetail])

  const [editSlots, setEditSlots] = useState<(string | null)[]>(initialEditSlots)
  const [editName, setEditName] = useState(teamDetail?.team.name ?? '')
  const [editDescription, setEditDescription] = useState(teamDetail?.team.description ?? '')
  const [submissionReport, setSubmissionReport] = useState<ConflictReport | null>(null)

  const slots = isEditing ? editSlots : draftSlots
  const name = isEditing ? editName : draftName
  const description = isEditing ? editDescription : draftDescription

  const selectedBuilds = useMemo(() => {
    return slots.map((buildId) => {
      if (!buildId) return null
      return builds.find((b) => b.id === buildId) ?? null
    })
  }, [slots, builds])

  const defaultTeamName = useMemo(() => generateTeamName(selectedBuilds), [selectedBuilds])
  const effectiveName = name.trim() || defaultTeamName

  const selectedIds = useMemo(() => {
    return selectedBuilds
      .filter((build): build is Build => build !== null)
      .map((build) => build.id)
  }, [selectedBuilds])

  const { data: validationReport, isFetching: isValidating } = useTeamValidationQuery(selectedIds)
  const effectiveReport = selectedIds.length > 0 ? (submissionReport ?? validationReport ?? null) : null

  const slotConflicts = useMemo(() => {
    return getSlotConflicts(effectiveReport, selectedBuilds)
  }, [effectiveReport, selectedBuilds])
  const detailedSlotConflicts = useMemo(() => {
    return getDetailedSlotConflicts(effectiveReport, selectedBuilds)
  }, [effectiveReport, selectedBuilds])

  function handleSetSlot(slot: SlotNumber, buildId: string) {
    setSubmissionReport(null)
    if (isEditing) {
      setEditSlots((prev) => {
        const next = [...prev]
        next[slot - 1] = buildId
        return next
      })
    } else {
      setDraftSlot(slot, buildId)
    }
  }

  function handleClearSlot(slot: SlotNumber) {
    setSubmissionReport(null)
    if (isEditing) {
      setEditSlots((prev) => {
        const next = [...prev]
        next[slot - 1] = null
        return next
      })
    } else {
      clearDraftSlot(slot)
    }
  }

  function handleSetName(value: string) {
    if (isEditing) {
      setEditName(value)
    } else {
      setDraftName(value)
    }
  }

  function handleSetDescription(value: string) {
    if (isEditing) {
      setEditDescription(value)
    } else {
      setDraftDescription(value)
    }
  }

  function handleSave() {
    if (isEditing) {
      if (!teamId || !effectiveName || selectedIds.length === 0) return
      updateMutation.mutate(
        {
          id: teamId,
          game_account_id: accountId,
          name: effectiveName,
          description: description.trim() || null,
          build_ids: selectedIds,
        },
        {
          onSuccess: () => {
            navigate('/teams')
          },
          onError: (error) => {
            if (error instanceof ApiError && error.conflicts) {
              setSubmissionReport(error.conflicts)
            }
          },
        },
      )
    } else {
      if (!accountId || !effectiveName || selectedIds.length === 0) return
      saveMutation.mutate(
        {
          game_account_id: accountId,
          name: effectiveName,
          description: description.trim() || null,
          build_ids: selectedIds,
        },
        {
          onSuccess: () => {
            resetDraft()
            navigate('/teams')
          },
          onError: (error) => {
            if (error instanceof ApiError && error.conflicts) {
              setSubmissionReport(error.conflicts)
            }
          },
        },
      )
    }
  }

  function handleReset() {
    if (isEditing) {
      navigate('/teams')
    } else {
      resetDraft()
    }
  }

  const teamCountQuery = useTeamCount(accountId, { enabled: !isEditing })
  const maxTeams = teamCountQuery.data?.max ?? DEFAULT_MAX_TEAMS_PER_ACCOUNT
  const isMaxTeams = !isEditing && (teamCountQuery.data?.count ?? 0) >= maxTeams

  const isSaving = saveMutation.isPending || updateMutation.isPending

  const canSave =
    Boolean(accountId) &&
    !isMaxTeams &&
    effectiveName.length > 0 &&
    effectiveName.length <= 100 &&
    description.trim().length <= 500 &&
    selectedIds.length > 0 &&
    !isValidating &&
    (!effectiveReport || effectiveReport.is_valid)

  function getSaveHint(): string | null {
    if (!accountId) return t('teamBuilder.hintLinkAccount')
    if (isMaxTeams) return t('teamBuilder.hintMaxTeams', { max: maxTeams })
    if (selectedIds.length === 0) return t('teamBuilder.hintSelectAgent')
    if (!effectiveName) return t('teamBuilder.hintEnterName')
    if (effectiveName.length > 100) return t('teamBuilder.hintNameTooLong')
    if (description.trim().length > 500) return t('teamBuilder.hintDescTooLong')
    if (effectiveReport && !effectiveReport.is_valid) return t('teamBuilder.hintResolveConflicts')
    return null
  }

  return (
    <div className="space-y-6">
      <title>{isEditing ? t('teams.pageTitleEdit') : t('teams.pageTitleNew')}</title>
      <meta name="description" content={t('teams.metaDescriptionBuilder')} />
      {/* Header */}
      <TeamBuilderHeader isEditing={isEditing} />

      {/* Main Grid Layout: Slots Deck + Analytics (Left) vs Controls Sidebar (Right) */}
      <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="min-w-0 space-y-5">
          {/* 3:4 ZZZ Character Slots Deck */}
          {isLoadingBuilds ? (
            <SlotsSkeleton />
          ) : (
            <TeamSlotList
              slots={slots}
              selectedBuilds={selectedBuilds}
              builds={builds}
              slotConflicts={slotConflicts}
              detailedSlotConflicts={detailedSlotConflicts}
              onSetSlot={handleSetSlot}
              onClearSlot={handleClearSlot}
              teamName={effectiveName}
              teamDescription={description}
              isEditing={isEditing}
              hasConflict={Boolean(effectiveReport && !effectiveReport.is_valid)}
            />
          )}

          {/* Conflict Engine Collision Alert (only rendered if conflict exists) */}
          <TeamConflictBanner
            report={effectiveReport}
            isValidating={isValidating}
            slots={selectedBuilds}
          />
        </div>

        {/* Right Sticky Sidebar: Name, Auto-name, Description, Save CTA, Reset Modal */}
        <TeamBuilderSidebar
          isEditing={isEditing}
          name={name}
          defaultName={defaultTeamName}
          description={description}
          selectedBuilds={selectedBuilds}
          report={effectiveReport}
          isValidating={isValidating}
          isSaving={isSaving}
          canSave={canSave}
          saveHint={getSaveHint()}
          onSetName={handleSetName}
          onSetDescription={handleSetDescription}
          onSave={handleSave}
          onReset={handleReset}
        />
      </div>
    </div>
  )
}

export function TeamBuilderPage() {
  const { t } = useTranslation()
  const { teamId } = useParams<{ teamId?: string }>()
  const isEditing = Boolean(teamId)

  const { data: me } = useMe()
  const isAuthed = Boolean(me)
  const { activeAccount, accounts, isPending: accountsPending } = useActiveAccount({
    enabled: isAuthed,
  })

  const teamQuery = useTeam(teamId)

  const effectiveAccountId = isEditing ? teamQuery.data?.team.game_account_id : activeAccount?.id
  const buildsQuery = useBuilds(isAuthed ? effectiveAccountId : undefined)
  const builds: Build[] = useMemo(() => buildsQuery.data ?? [], [buildsQuery.data])

  if (isEditing && teamQuery.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <TeamBuilderHeaderSkeleton />
        <div className="space-y-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-6 lg:space-y-0">
          <div className="min-w-0 space-y-5">
            <TeamSlotListSkeleton />
          </div>
          <TeamBuilderSidebarSkeleton />
        </div>
      </div>
    )
  }

  if (isEditing && (teamQuery.isError || !teamQuery.data)) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/teams">
            <ArrowLeft className="size-4" />
            <span>{t('nav.teams')}</span>
          </Link>
        </Button>
        <InterknotTerminalError
          variant="compact"
          status={404}
          errorCode="404_TEAM"
          title={t('teams.teamNotFound')}
          onRetry={() => void teamQuery.refetch()}
          isRetrying={teamQuery.isFetching}
        />
      </div>
    )
  }

  if (!isEditing && !accountsPending && accounts.length === 0) {
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

  return (
    <TeamBuilderForm
      key={isEditing ? teamId : 'new'}
      isEditing={isEditing}
      teamId={teamId}
      teamDetail={teamQuery.data}
      accountId={effectiveAccountId ?? ''}
      builds={builds}
      isLoadingBuilds={buildsQuery.isPending}
    />
  )
}
