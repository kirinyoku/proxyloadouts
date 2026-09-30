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
        'group relative flex flex-col justify-between space-y-3.5 rounded-2xl border p-4 sm:p-5 transition-all duration-300',
        'border-white/15 bg-[#141922] shadow-[0_16px_40px_rgba(0,0,0,0.65)] hover:border-primary/40 hover:shadow-[0_20px_48px_rgba(0,0,0,0.8),0_0_24px_rgba(201,242,75,0.08)]',
        hasConflict &&
          'border-red-500/40 bg-gradient-to-b from-[#241217] to-[#1a0c10] hover:border-red-500/60 hover:shadow-[0_16px_40px_rgba(239,68,68,0.15)]',
      )}
    >
      {/* Top Header: Squad Tag, Title, Conflict status and Slot counter */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <span className="flex h-5.5 items-center rounded-md border border-primary/40 bg-primary/15 px-2 font-mono text-xs font-bold text-primary shadow-xs">
            {isEditing ? '#EDIT' : '#NEW'}
          </span>

          <h2
            className="truncate font-heading text-base font-bold tracking-wide text-foreground sm:text-lg"
            title={teamName?.trim() || fallbackTitle}
          >
            {teamName?.trim() || fallbackTitle}
          </h2>

          {hasConflict && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded border border-destructive/40 bg-destructive/15 px-1.5 py-0.5 text-[10px] font-bold text-destructive cursor-help"
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

        <div className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground shadow-xs shrink-0">
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
      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2.5 text-xs">
        <div className="min-w-0 flex-1">
          {teamDescription?.trim() ? (
            <p
              className="truncate text-xs font-medium text-zinc-300 transition-colors hover:text-foreground"
              title={teamDescription.trim()}
            >
              <span className="mr-1.5 select-none font-mono font-bold text-primary">//</span>
              {teamDescription.trim()}
            </p>
          ) : (
            <p className="text-xs font-medium text-zinc-400 transition-colors">
              <span className="mr-1.5 select-none font-mono font-bold text-primary">//</span>
              {t('teamBuilder.deckSlotPrompt')}
            </p>
          )}
        </div>
      </div>
    </article>
  )
}
