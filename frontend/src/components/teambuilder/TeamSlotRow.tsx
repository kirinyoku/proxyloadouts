import { lazy, Suspense, useState } from 'react'
import { AlertCircle, Disc, Pencil, X } from 'lucide-react'
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
            'group/empty relative flex h-[60px] sm:h-[64px] w-full items-center justify-between overflow-hidden rounded-xl border border-dashed px-3.5 sm:px-4 transition-all duration-200 cursor-pointer',
            'border-white/20 bg-[#0c1017] hover:border-primary/60 hover:bg-[#111622]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          {/* Subtle halftone texture */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 size-full select-none"
            style={{
              backgroundImage:
                'radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
              backgroundSize: '8px 8px',
            }}
          />

          <div className="relative z-10 flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full border border-dashed border-white/40 bg-white/[0.06] text-base font-medium text-zinc-300 transition-all duration-200 group-hover/empty:scale-105 group-hover/empty:border-primary group-hover/empty:bg-primary/15 group-hover/empty:text-primary">
              +
            </span>
            <div className="flex flex-col text-left">
              <span className="font-heading text-xs font-bold uppercase tracking-wider text-zinc-200 group-hover/empty:text-primary transition-colors">
                {t('teamBuilder.emptySlotChoose')}
              </span>
              <span className="text-[11px] font-medium text-zinc-400">{t('teams.slotLabel', { slot })}</span>
            </div>
          </div>

          <span className="relative z-10 rounded border border-white/20 bg-black/75 px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-300 transition-colors group-hover/empty:border-primary/50 group-hover/empty:text-primary">
            {slot}P
          </span>
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
  const visualDiscSets = setBonuses.map((bonus) => {
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
          'group/slot relative flex items-center justify-between gap-2.5 sm:gap-3 overflow-hidden rounded-xl border px-3.5 py-2.5 transition-all duration-200 cursor-pointer',
          hasConflict
            ? 'border-destructive/80 bg-linear-to-r from-red-950/50 via-[#181115] to-red-950/40 hover:border-destructive shadow-[0_0_16px_rgba(239,68,68,0.25)]'
            : 'border-white/15 bg-gradient-to-b from-[#161d28] to-[#121722] hover:border-primary/60 hover:from-[#1c2432] hover:to-[#161e2a] shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.6),0_0_16px_rgba(201,242,75,0.12)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        )}
      >
        {/* Background halftone texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 size-full select-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px)',
            backgroundSize: '7px 7px',
          }}
        />

        {/* Left: Avatar + Agent Name & Build Tag + Conflict status */}
        <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          {/* CircleIcon Avatar with Rarity Border */}
          <div
            className={cn(
              'relative size-11.5 sm:size-12 shrink-0 rounded-full border-2 bg-[#10141b] shadow-md transition-transform duration-200 group-hover/slot:scale-105',
              agent.rarity === 'S'
                ? 'border-amber-400/80 shadow-[0_0_10px_rgba(245,238,56,0.2)] group-hover/slot:border-primary group-hover/slot:shadow-[0_0_14px_rgba(201,242,75,0.4)]'
                : agent.rarity === 'A'
                  ? 'border-purple-400/80 shadow-[0_0_10px_rgba(192,132,252,0.2)] group-hover/slot:border-primary group-hover/slot:shadow-[0_0_14px_rgba(201,242,75,0.4)]'
                  : 'border-white/20 group-hover/slot:border-primary',
            )}
          >
            <span className="relative block size-full overflow-hidden rounded-full">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt={agentName}
                  loading="eager"
                  decoding="async"
                  draggable={false}
                  className="crisp-img size-full object-cover select-none pointer-events-none transition-transform duration-200 group-hover/slot:scale-110"
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

          {/* Text Details: Name & Attribute on top, Build tag below */}
          <div className="flex flex-col min-w-0 justify-center">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate font-heading text-xs sm:text-sm font-bold tracking-wide text-foreground transition-colors group-hover/slot:text-primary">
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

            <div className="mt-1 flex flex-wrap items-center gap-1.5 min-w-0">
              <div className="inline-flex max-w-full items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 shadow-xs transition-colors group-hover/slot:border-primary/50 group-hover/slot:bg-primary/15">
                <span className="truncate font-mono text-[10px] sm:text-[11px] font-semibold text-primary tracking-tight">
                  {selected.name}
                </span>
              </div>

              {hasConflict && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 rounded border border-destructive/50 bg-destructive/20 px-1.5 py-0.5 text-[9px] font-bold text-destructive shrink-0 cursor-help"
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

        {/* Right: Gear Section + Slot Badge + Interactive Actions */}
        <div className="relative z-10 flex items-center gap-1.5 sm:gap-2.5 shrink-0 pl-3 border-l border-white/12">
          {/* W-Engine */}
          {wEngine ? (
            <div
              className={cn(
                'relative flex size-8 sm:size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover/slot:scale-110',
                conflictDetail?.hasWeaponConflict &&
                  'ring-2 ring-destructive border border-destructive/80 bg-destructive/20 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
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
                  loading="eager"
                  decoding="async"
                  draggable={false}
                  className="size-full object-contain select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                />
              ) : (
                <span className="font-heading text-xs font-bold text-primary">
                  W
                </span>
              )}
              {wEngine.modification > 1 && (
                <span className="absolute -bottom-1 -right-1 rounded bg-black/95 px-1 font-mono text-[8px] font-black text-amber-400 border border-amber-400/40 leading-none shadow-xs">
                  P{wEngine.modification}
                </span>
              )}
            </div>
          ) : (
            <div
              className="flex size-8 sm:size-9 shrink-0 items-center justify-center text-[11px] font-mono text-zinc-500"
              title={t('teams.noWEngine')}
            >
              {t('teams.noWEngineShort')}
            </div>
          )}

          {/* Drive Discs */}
          <div
            className={cn(
              'flex items-center gap-1 sm:gap-1.5 rounded-lg transition-all',
              hasDiscConflict &&
                'ring-1.5 ring-destructive/80 bg-destructive/15 border border-destructive/40 p-0.5 shadow-[0_0_8px_rgba(239,68,68,0.3)]',
            )}
            title={
              hasDiscConflict && discSlotsStr
                ? t('conflicts.slotConflictBadge', { slot: discSlotsStr })
                : undefined
            }
          >
            {visualDiscSets.length > 0 ? (
              visualDiscSets.slice(0, 2).map((discSet) => (
                <div
                  key={discSet.setId}
                  className="relative flex size-7.5 sm:size-8.5 shrink-0 items-center justify-center transition-transform duration-200 group-hover/slot:scale-110"
                  title={`${discSet.name} (${t('gear.pieces', { count: discSet.count })})`}
                >
                  {discSet.iconUrl ? (
                    <img
                      src={discSet.iconUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="size-full object-contain select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                    />
                  ) : (
                    <Disc className="size-4 text-muted-foreground/60" />
                  )}
                  <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary font-mono text-[8px] font-black text-black shadow-xs border border-black/80">
                    {discSet.count}
                  </span>
                </div>
              ))
            ) : (
              <div
                className="flex size-7.5 sm:size-8.5 shrink-0 items-center justify-center text-[11px] font-mono text-zinc-500"
                title={t('teamBuilder.noSets')}
              >
                {t('teams.noDiscsShort')}
              </div>
            )}

            {hasDiscConflict && discSlotsStr && (
              <span
                className="flex items-center gap-0.5 rounded bg-destructive px-1 py-0.5 font-mono text-[8px] font-black text-white shadow-xs"
                title={t('conflicts.slotConflictBadge', { slot: discSlotsStr })}
              >
                #{discSlotsStr}
              </span>
            )}
          </div>

          {/* Slot position badge */}
          <span className="rounded border border-white/20 bg-black/75 px-2 py-0.5 font-mono text-[11px] font-bold text-zinc-300 transition-colors group-hover/slot:border-primary/40 group-hover/slot:text-primary">
            {slot}P
          </span>

          {/* Action buttons: Replace (visual hint) + Clear (X) */}
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-white/12">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPickerOpen(true)
              }}
              aria-label={t('teamBuilder.replaceAgent')}
              title={t('teamBuilder.replaceAgent')}
              className="group/edit hidden xs:flex size-7.5 items-center justify-center rounded-lg border border-white/20 bg-[#161d28] text-zinc-300 shadow-xs hover:border-primary/60 hover:bg-[#1c2432] hover:text-primary hover:shadow-[0_0_12px_rgba(201,242,75,0.15)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <Pencil className="size-3.5 transition-colors group-hover/edit:text-primary" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onClear()
              }}
              aria-label={t('teamBuilder.removeFromSquadSpecific', { agent: agentName, slot })}
              title={t('teamBuilder.removeFromSquadSpecific', { agent: agentName, slot })}
              className="group/del flex size-7.5 items-center justify-center rounded-lg border border-white/20 bg-[#161d28] text-zinc-300 shadow-xs hover:border-destructive/60 hover:bg-destructive/20 hover:text-destructive hover:shadow-[0_0_12px_rgba(239,68,68,0.2)] active:scale-[0.98] transition-all cursor-pointer"
            >
              <X className="size-3.5 sm:size-4 transition-colors group-hover/del:text-destructive" />
            </button>
          </div>
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
