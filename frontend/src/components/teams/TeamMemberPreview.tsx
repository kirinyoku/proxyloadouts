import { Disc } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { MindscapeBadge } from '@/components/ui/MindscapeBadge'
import {
  agentRoleCircleUrl,
  agentRoleIconUrl,
  agentRoleSelectUrl,
} from '@/lib/agent-icons'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import type { Build, TeamMember } from '@/types'

export interface TeamMemberPreviewProps {
  member?: TeamMember
  slotNumber: number
  teamId: string
  onAddClick?: () => void
  onInspectClick?: (build: Build) => void
  isUpdating?: boolean
}

/**
 * Compact preview card of a squad member (Agent + W-Engine + Discs) in TeamCard.
 */
export function TeamMemberPreview({
  member,
  slotNumber,
  teamId,
  onAddClick,
  onInspectClick,
  isUpdating = false,
}: TeamMemberPreviewProps) {
  const { t } = useTranslation()

  if (!member) {
    const slotBody = (
      <>
        <div className="flex items-center gap-2.5 sm:gap-3">
          <span className="flex size-10 sm:size-11 items-center justify-center rounded-full border-2 border-dashed border-white/20 bg-black/30 text-base text-muted-foreground transition-colors duration-150 group-hover/empty:border-primary/70 group-hover/empty:text-primary">
            {isUpdating ? (
              <Spinner size="xs" color="primary" />
            ) : (
              '+'
            )}
          </span>
          <div className="flex flex-col text-left">
            <span className="font-heading text-xs uppercase tracking-wider text-foreground/80 transition-colors group-hover/empty:text-primary">
              {isUpdating ? t('teams.slotAdding') : t('teams.slotChooseAgent')}
            </span>
            <span className="text-[11px] text-muted-foreground">{t('teams.slotLabel', { slot: slotNumber })}</span>
          </div>
        </div>
      </>
    )

    const slotClasses = cn(
      'group/empty relative flex min-h-[60px] sm:min-h-[68px] w-full items-center justify-between rounded-(--radius-input-lg) border-2 border-dashed border-white/15 bg-subtle/60 px-3 sm:px-3.5 py-2 text-muted-foreground transition-colors duration-150 cursor-pointer',
      'hover:border-primary/60 hover:bg-subtle',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card active:translate-y-px',
      isUpdating && 'pointer-events-none opacity-70',
    )

    if (onAddClick) {
      return (
        <button
          type="button"
          onClick={onAddClick}
          disabled={isUpdating}
          aria-label={t('teams.slotAriaEmpty', { slot: slotNumber })}
          title={t('teams.slotChooseAgent')}
          className={slotClasses}
        >
          {slotBody}
        </button>
      )
    }

    return (
      <Link
        to={`/teams/${teamId}/edit`}
        aria-label={t('teams.slotAriaEmpty', { slot: slotNumber })}
        title={t('teams.slotChooseAgent')}
        className={slotClasses}
      >
        {slotBody}
      </Link>
    )
  }

  const { build } = member
  const agent = build.build_data
  const agentName = build.agent_name || agent.name
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

  const memberContent = (
    <>
      {/* Hover / focus accent strip — echoes the crosshatch acid bar of AppHeader */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-2 left-0 w-[3px] origin-center scale-y-0 rounded-r-full bg-primary transition-transform duration-150 group-hover/slot:scale-y-100 group-focus-visible/slot:scale-y-100"
      />

      {/* Left Part: Avatar + Agent Name & Build Tag */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* CircleIcon Avatar: black ink border + rarity ring (same recipe as the Showcase profile avatar) */}
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
                fetchPriority="low"
                draggable={false}
                className="crisp-img size-full object-cover select-none pointer-events-none"
              />
            ) : (
              <span className="flex size-full items-center justify-center font-heading text-xs text-foreground">
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

          <span className="truncate font-mono text-[10px] sm:text-[11px] font-semibold leading-tight tabular-nums text-muted-foreground transition-colors group-hover/slot:text-foreground">
            {build.name}
          </span>
        </div>
      </div>

      {/* Right Part: Gear Section (W-Engine + Discs) */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 border-l border-dashed border-white/10 pl-2 sm:pl-3">
        {/* W-Engine */}
        {wEngine ? (
          <div
            className="relative flex size-7.5 sm:size-8.5 shrink-0 items-center justify-center"
            title={`W-Engine: ${wEngineName} (P${wEngine.modification || 1})`}
          >
            {wEngine.icon_url ? (
              <img
                src={wEngine.icon_url}
                alt=""
                loading="lazy"
                decoding="async"
                fetchPriority="low"
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
              className="relative flex size-7 sm:size-8 shrink-0 items-center justify-center"
              title={`${discSet.name} (${t('gear.pieces', { count: discSet.count })})`}
            >
              {discSet.iconUrl ? (
                <img
                  src={discSet.iconUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  fetchPriority="low"
                  draggable={false}
                  className="size-full object-contain select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]"
                />
              ) : (
                <Disc className="size-3.5 sm:size-4 text-muted-foreground/60" />
              )}
              <span className="absolute -bottom-0.5 -right-1 flex size-3.5 items-center justify-center rounded-full border border-black bg-amber-400 font-mono text-[8px] font-black leading-none text-black">
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
      </div>
    </>
  )

  const slotClasses = cn(
    'group/slot relative flex w-full items-center justify-between gap-2 sm:gap-3 overflow-hidden rounded-(--radius-input-lg) border-2 border-black bg-subtle px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-left cursor-pointer transition-colors duration-150',
    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-elevated',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card active:translate-y-px',
  )

  if (onInspectClick) {
    return (
      <button
        type="button"
        onClick={() => onInspectClick(build)}
        aria-label={t('teams.slotAriaInspect', { slot: slotNumber, agent: agentName, build: build.name })}
        title={`${agentName} — «${build.name}»`}
        className={slotClasses}
      >
        {memberContent}
      </button>
    )
  }

  return (
    <Link
      to={`/roster?build=${encodeURIComponent(build.id)}`}
      aria-label={t('teams.slotAriaFilled', { slot: slotNumber, agent: agentName, build: build.name })}
      title={`${agentName} — «${build.name}»`}
      className={slotClasses}
    >
      {memberContent}
    </Link>
  )
}
