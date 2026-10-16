import { AlertCircle, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { TeamSlotRow } from '@/components/teambuilder/TeamSlotRow'
import type { SlotConflictDetail } from '@/lib/conflicts'
import { cn } from '@/lib/utils'
import type { SlotNumber } from '@/store/useTeamDraftStore'
import type { Build, ConflictCode } from '@/types'

export interface TeamSlotListProps {
  slots: readonly (string | null)[]
  selectedBuilds: readonly (Build | null)[]
  builds: Build[]
  slotConflicts: Record<SlotNumber, ConflictCode[]>
  detailedSlotConflicts?: Record<SlotNumber, SlotConflictDetail>
  onSetSlot: (slot: SlotNumber, buildId: string) => void
  onClearSlot: (slot: SlotNumber) => void
  teamName?: string
  teamDescription?: string
  isEditing?: boolean
  hasConflict?: boolean
}

/**
 * Squad slots list container displaying the 3 team member slots with status and header.
 */
export function TeamSlotList({
  slots,
  selectedBuilds,
  builds,
  slotConflicts,
  detailedSlotConflicts,
  onSetSlot,
  onClearSlot,
  teamName,
  teamDescription,
  isEditing = false,
  hasConflict = false,
}: TeamSlotListProps) {
  const { t } = useTranslation()
  const filledCount = selectedBuilds.filter(Boolean).length

  const fallbackTitle = isEditing ? t('teamBuilder.unnamedTeam') : t('teamBuilder.newTitle')

  return (
    <article
      aria-label={isEditing ? t('teamBuilder.deckAriaEdit', { name: teamName || '' }) : t('teamBuilder.deckAriaNew')}
      className={cn(
        'relative flex flex-col gap-3 sm:gap-3.5 rounded-(--radius-card) border-2 border-black bg-card p-3.5 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-16px_rgba(0,0,0,0.9)]',
        hasConflict && 'bg-[color-mix(in_oklch,var(--card),var(--destructive)_7%)]',
      )}
    >

      {/* Top Header: Squad Tag, Title, Conflict status and Slot counter */}
      <div className="flex items-center justify-between gap-2.5 min-w-0">
        <div className="flex min-w-0 items-center gap-2.5 flex-1">
          {/* Skewed acid tag — mirrors the active nav tab and squad card on /teams */}
          <span className="checker-dark inline-flex h-6 shrink-0 -skew-x-12 items-center bg-primary px-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
            <span className="skew-x-12 font-heading text-xs leading-none tabular-nums text-primary-foreground">
              {isEditing ? '#EDIT' : '#NEW'}
            </span>
          </span>

          <h2
            className="truncate font-heading text-base sm:text-lg leading-tight tracking-wide text-foreground"
            title={teamName?.trim() || fallbackTitle}
          >
            {teamName?.trim() || fallbackTitle}
          </h2>

          {hasConflict && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex h-5 shrink-0 cursor-help items-center gap-1 rounded-[4px_4px_0_4px] border border-black bg-destructive px-1.5 font-heading text-[10px] leading-none tracking-wide text-white"
                >
                  <AlertCircle className="size-3" />
                  <span className="hidden sm:inline">{t('teamBuilder.conflictBadge')}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {t('teamBuilder.conflictDeckTooltip')}
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-(--radius-input) border-2 border-black bg-elevated px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] shrink-0">
          <UsersRound className={cn('size-3.5 shrink-0', filledCount > 0 ? 'text-primary' : 'text-zinc-400')} />
          <span className={cn('font-bold', filledCount > 0 ? 'text-primary' : 'text-zinc-100')}>
            {filledCount}
          </span>
          <span className="text-zinc-500 font-normal">/</span>
          <span className="text-zinc-300 font-medium">3</span>
          <span className="hidden sm:inline text-xs font-normal text-zinc-400 ml-0.5">
            {t('teamBuilder.deckSlotCounter', { count: filledCount }).replace(/^.*?\/\s*3\s*/, '')}
          </span>
        </div>
      </div>

      {/* 3 Squad Member Slots */}
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {([1, 2, 3] as const).map((slotNumber) => {
          const selected = selectedBuilds[slotNumber - 1] ?? null
          const otherSquadBuilds = selectedBuilds.filter((_, index) => index !== slotNumber - 1)
          const usedElsewhere = new Set<string>()
          slots.forEach((id, index) => {
            if (id && index !== slotNumber - 1) usedElsewhere.add(id)
          })

          return (
            <TeamSlotRow
              key={slotNumber}
              slot={slotNumber}
              selected={selected}
              builds={builds}
              squadBuilds={otherSquadBuilds}
              usedBuildIds={usedElsewhere}
              conflictCodes={slotConflicts[slotNumber] ?? []}
              conflictDetail={detailedSlotConflicts?.[slotNumber]}
              onSelect={(buildId) => onSetSlot(slotNumber, buildId)}
              onClear={() => onClearSlot(slotNumber)}
            />
          )
        })}
      </div>

      {/* Footer: Live preview of notes or interactive prompt */}
      <div className="mt-auto flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 border-t border-dashed border-white/10 pt-2.5 text-xs text-muted-foreground">
        <div className="min-w-0 flex-1">
          {teamDescription?.trim() ? (
            <p
              className="truncate text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              title={teamDescription.trim()}
            >
              <span className="mr-1.5 select-none font-heading text-primary">//</span>
              {teamDescription.trim()}
            </p>
          ) : (
            <p className="truncate text-xs font-medium text-muted-foreground transition-colors">
              <span className="mr-1.5 select-none font-heading text-primary">//</span>
              {t('teamBuilder.deckSlotPrompt')}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
