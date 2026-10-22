import { lazy, Suspense, useState } from 'react'
import { AlertCircle, Disc, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { MindscapeBadge } from '@/components/ui/MindscapeBadge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  agentRoleCircleUrl,
  agentRoleIconUrl,
  agentRoleSelectUrl,
} from '@/lib/agent-icons'
import { getConflictLabel, type SlotConflictDetail } from '@/lib/conflicts'
import { cn } from '@/lib/utils'
import type { SlotNumber } from '@/store/useTeamDraftStore'
import type { Build, ConflictCode } from '@/types'

const BuildPickerDialog = lazy(() =>
  import('@/components/teambuilder/BuildPickerDialog').then((module) => ({
    default: module.BuildPickerDialog,
  })),
)

export interface TeamSlotRowProps {
  slot: SlotNumber
  selected: Build | null
  builds: Build[]
  squadBuilds?: readonly (Build | null | undefined)[]
  usedBuildIds: ReadonlySet<string>
  conflictCodes: ConflictCode[]
  conflictDetail?: SlotConflictDetail
  onSelect: (buildId: string) => void
  onClear: () => void
}

/**
 * Horizontal row strip representing an individual squad slot (1P / 2P / 3P).
 */
export function TeamSlotRow({
  slot,
  selected,
  builds,
  squadBuilds,
  usedBuildIds,
  conflictCodes,
  conflictDetail,
  onSelect,
  onClear,
}: TeamSlotRowProps) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const hasConflict = conflictCodes.length > 0
  const hasDiscConflict = (conflictDetail?.conflictingDiscSlots.length ?? 0) > 0
  const discSlotsStr = conflictDetail?.conflictingDiscSlots.join(', ')

  let conflictReason = conflictCodes.map((c) => getConflictLabel(c)).join(', ')
  if (hasDiscConflict && discSlotsStr) {
    conflictReason = conflictCodes.map((c) => {
      if (c === 'ITEM_REUSE') {
        return t('conflicts.slotConflictBadge', { slot: discSlotsStr })
      }
      return getConflictLabel(c)
    }).join(', ')
  }

  if (!selected) {
    return (
      <>
        {/* Empty Slot Horizontal Strip */}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-label={t('teams.slotAriaEmpty', { slot })}
          title={t('teamBuilder.emptySlotAdd')}
          className={cn(
            'group/empty relative flex min-h-[60px] sm:min-h-[68px] w-full items-center justify-between rounded-(--radius-input-lg) border-2 border-dashed border-white/15 bg-subtle/60 px-3 sm:px-3.5 py-2 text-muted-foreground transition-colors duration-150 cursor-pointer',
            'hover:border-primary/60 hover:bg-subtle',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card active:translate-y-px',
          )}
        >
          <div className="flex items-center gap-2.5 sm:gap-3">
            <span className="flex size-10 sm:size-11 items-center justify-center rounded-full border-2 border-dashed border-white/20 bg-black/30 text-base text-muted-foreground transition-colors duration-150 group-hover/empty:border-primary/70 group-hover/empty:text-primary">
              +
            </span>
            <div className="flex flex-col text-left">
              <span className="font-heading text-xs font-bold uppercase tracking-wider text-zinc-200 transition-colors group-hover/empty:text-primary">
                {t('teamBuilder.emptySlotChoose')}
              </span>
              <span className="text-[11px] text-muted-foreground">{t('teams.slotLabel', { slot })}</span>
            </div>
          </div>
        </button>

        {pickerOpen && (
          <Suspense fallback={null}>
            <BuildPickerDialog
              open={pickerOpen}
              builds={builds}
              squadBuilds={squadBuilds}
              usedBuildIds={usedBuildIds}
              onSelect={onSelect}
              onOpenChange={setPickerOpen}
            />
          </Suspense>
        )}
      </>
    )
  }

  const agent = selected.build_data
  const agentName = selected.agent_name || agent.name
  const circleUrl = agentRoleCircleUrl(agent.id)
  const selectUrl = agentRoleSelectUrl(agent.id)
  const generalUrl = agentRoleIconUrl(agent.id)
  const iconUrl = circleUrl ?? selectUrl ?? generalUrl ?? agent.splash_art_url
  const wEngine = agent.w_engine
  const wEngineName = wEngine?.name ?? ''
  const attributeName = agent.attribute ? t(`attributes.${agent.attribute}`, agent.attribute_name || agent.attribute) : (agent.attribute_name || '')
  const specialtyName = agent.specialty ? t(`specialties.${agent.specialty}`, agent.specialty_name || agent.specialty) : (agent.specialty_name || '')

  // Visual Disc Sets (Icons + counts)
  const setBonuses = agent.drive_discs?.set_bonuses ?? []
  const discs = agent.drive_discs?.slots ?? []
  const visualDiscSets = setBonuses
    .map((bonus) => {
      const matchingDisc = discs.find(
        (d) => d.set.id === bonus.set.id && d.icon_path,
      )
      return {
        setId: bonus.set.id,
        name: bonus.set.name,
        count: bonus.count,
        iconUrl: matchingDisc?.icon_path,
      }
    })
    .sort((a, b) => b.count - a.count)

  return (
    <>
      {/* Filled Slot Horizontal Strip */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setPickerOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setPickerOpen(true)
          }
        }}
        aria-label={t('teams.slotAriaFilled', { slot, agent: agentName, build: selected.name })}
        title={`${agentName} — «${selected.name}» (${t('teamBuilder.replaceAgent')})`}
        className={cn(
          'group/slot relative flex w-full items-center justify-between gap-2 sm:gap-3 overflow-hidden rounded-(--radius-input-lg) border-2 border-black bg-subtle px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-left cursor-pointer transition-colors duration-150',
          'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-elevated',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card active:translate-y-px',
          hasConflict && 'border-destructive/80 bg-[color-mix(in_oklch,var(--subtle),var(--destructive)_12%)]',
        )}
      >
        {/* Hover / focus accent strip — echoes the crosshatch acid bar of AppHeader */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-2 left-0 w-[3px] origin-center scale-y-0 rounded-r-full bg-primary transition-transform duration-150 group-hover/slot:scale-y-100 group-focus-visible/slot:scale-y-100"
        />

        {/* Left: Avatar + Agent Name & Build Tag + Conflict status */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {/* CircleIcon Avatar: black ink border + rarity ring */}
          <div
            className={cn(
              'relative size-10 sm:size-11 shrink-0 rounded-full border-2 border-black bg-background ring-2 transition-shadow duration-150 group-hover/slot:ring-primary/80',
              agent.rarity === 'S'
                ? 'ring-brand/45'
                : agent.rarity === 'A'
                  ? 'ring-attr-electric/45'
                  : 'ring-white/15',
            )}
          >
            <span className="relative block size-full overflow-hidden rounded-full">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={agentName}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="crisp-img size-full object-cover select-none pointer-events-none"
                />
              ) : (
                <span className="flex size-full items-center justify-center font-heading text-xs font-bold text-foreground">
                  {agentName.slice(0, 2)}
                </span>
              )}
            </span>

            {/* Mindscape Cinema (bottom-right) */}
            {agent.mindscape_cinema > 0 && (
              <MindscapeBadge level={agent.mindscape_cinema} size="sm" />
            )}
          </div>

          {/* Text Details: Name & Attribute on top, Build name below */}
          <div className="flex flex-col min-w-0 justify-center gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate font-heading text-xs sm:text-sm leading-tight tracking-wide text-foreground transition-colors group-hover/slot:text-primary">
                {agentName}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {agent.attribute && (
                  <AttributeBadge
                    attribute={agent.attribute}
                    label={attributeName}
                    className="size-3.5"
                  />
                )}
                {agent.specialty && (
                  <SpecialtyBadge
                    specialty={agent.specialty}
                    label={specialtyName}
                    className="size-3.5"
                  />
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate font-mono text-[10px] sm:text-[11px] font-semibold leading-tight tabular-nums text-muted-foreground transition-colors group-hover/slot:text-foreground">
                {selected.name}
              </span>

              {hasConflict && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 rounded-[4px_4px_0_4px] border border-black bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-white shrink-0 cursor-help"
                    >
                      <AlertCircle className="size-2.5 animate-pulse" />
                      <span>{conflictReason}</span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-xs">
                    {`${t('teamBuilder.conflictBadge')}: ${conflictReason}`}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Right: Gear Section (W-Engine + Discs) + Slot Tag + Remove Action */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 border-l border-dashed border-white/10 pl-2 sm:pl-3">
          {/* W-Engine */}
          {wEngine ? (
            <div
              className={cn(
                'relative flex size-7.5 sm:size-8.5 shrink-0 items-center justify-center',
                conflictDetail?.hasWeaponConflict &&
                  'ring-2 ring-destructive border border-destructive/80 bg-destructive/20 rounded-lg shadow-[0_0_8px_rgba(239,68,68,0.5)]',
              )}
              title={
                conflictDetail?.hasWeaponConflict
                  ? `${t('conflicts.weaponConflictBadge')}: ${wEngineName}`
                  : `W-Engine: ${wEngineName} (P${wEngine.modification || 1})`
              }
            >
              {wEngine.icon_url ? (
                <img
                  src={wEngine.icon_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="size-full object-contain select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
                />
              ) : (
                <span className="font-heading text-xs text-primary">
                  W
                </span>
              )}
              {(wEngine.rarity === 'S' || wEngine.modification > 1) && (
                <span className="absolute -bottom-0.5 -right-1 flex h-3.5 items-center rounded-full border border-white/20 bg-black px-1 font-sans text-[8px] font-black leading-none text-white">
                  P{wEngine.modification || 1}
                </span>
              )}
            </div>
          ) : (
            <div
              className="flex size-7.5 sm:size-8.5 shrink-0 items-center justify-center text-[10px] font-mono text-muted-foreground/60"
              title={t('teams.noWEngine')}
            >
              {t('teams.noWEngineShort')}
            </div>
          )}

          {/* Drive Discs */}
          {visualDiscSets.length > 0 ? (
            visualDiscSets.slice(0, 2).map((discSet) => (
              <div
                key={discSet.setId}
                className={cn(
                  'relative flex size-7 sm:size-8 shrink-0 items-center justify-center',
                  hasDiscConflict &&
                    'ring-1.5 ring-destructive/80 bg-destructive/15 rounded-lg border border-destructive/40 p-0.5',
                )}
                title={`${discSet.name} (${t('gear.pieces', { count: discSet.count })})`}
              >
                {discSet.iconUrl ? (
                  <img
                    src={discSet.iconUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="size-full object-contain select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
                  />
                ) : (
                  <Disc className="size-3.5 sm:size-4 text-muted-foreground/60" />
                )}
                <span className="absolute -bottom-0.5 -right-1 flex size-3.5 items-center justify-center rounded-full border border-black bg-primary font-mono text-[8px] font-black leading-none text-primary-foreground">
                  {discSet.count}
                </span>
              </div>
            ))
          ) : (
            <div
              className="flex size-7 sm:size-8 shrink-0 items-center justify-center text-[10px] font-mono text-muted-foreground/60"
              title={t('teamBuilder.noSets')}
            >
              {t('teams.noDiscsShort')}
            </div>
          )}

          {hasDiscConflict && discSlotsStr && (
            <span
              className="flex items-center gap-0.5 rounded-[4px_4px_0_4px] border border-black bg-destructive px-1 py-0.5 font-mono text-[8px] font-black text-white shadow-xs"
              title={t('conflicts.slotConflictBadge', { slot: discSlotsStr })}
            >
              #{discSlotsStr}
            </span>
          )}
        </div>

        {/* Clear/Remove action — cleanly separated from gear */}
        <div className="flex items-center shrink-0 border-l border-dashed border-white/10 pl-2 sm:pl-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
            }}
            aria-label={t('teamBuilder.removeFromSquadSpecific', { agent: agentName, slot })}
            title={t('teamBuilder.removeFromSquadSpecific', { agent: agentName, slot })}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground/45 transition-colors hover:bg-destructive/20 hover:text-destructive active:scale-95 cursor-pointer"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {pickerOpen && (
        <Suspense fallback={null}>
          <BuildPickerDialog
            open={pickerOpen}
            builds={builds}
            squadBuilds={squadBuilds}
            usedBuildIds={usedBuildIds}
            onSelect={onSelect}
            onOpenChange={setPickerOpen}
          />
        </Suspense>
      )}
    </>
  )
}
