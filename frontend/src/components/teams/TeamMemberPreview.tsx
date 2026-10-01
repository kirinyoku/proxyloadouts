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
          <span className="flex size-9 sm:size-9.5 items-center justify-center rounded-full border border-dashed border-white/30 bg-white/[0.04] text-base font-light text-muted-foreground transition-all duration-200 group-hover/empty:scale-105 group-hover/empty:border-primary group-hover/empty:bg-primary/15 group-hover/empty:text-primary">
            {isUpdating ? (
              <Spinner size="xs" color="primary" />
            ) : (
              '+'
            )}
          </span>
          <div className="flex flex-col text-left">
            <span className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 group-hover/empty:text-primary transition-colors">
              {isUpdating ? t('teams.slotAdding') : t('teams.slotChooseAgent')}
            </span>
            <span className="text-[10px] text-muted-foreground/50">{t('teams.slotLabel', { slot: slotNumber })}</span>
          </div>
        </div>

        <span className="relative z-10 rounded border border-white/15 bg-black/60 px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground/70 transition-colors group-hover/empty:border-primary/40 group-hover/empty:text-primary">
          {slotNumber}P
        </span>
      </>
    )

    const slotClasses = cn(
      'group/empty relative flex min-h-[56px] sm:min-h-[64px] h-auto w-full items-center justify-between overflow-hidden rounded-xl border border-dashed px-3 sm:px-4 py-2.5 sm:py-0 text-muted-foreground transition-all duration-200 cursor-pointer',
      'border-white/15 bg-[#0c1017]/85 hover:border-primary/60 hover:bg-[#111622] hover:text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] sm:active:scale-100',
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

      {/* Left Part: Avatar + Agent Name & Build Tag */}
      <div className="relative z-10 flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
        {/* CircleIcon Avatar with Rarity Border */}
        <div
          className={cn(
            'relative size-10 sm:size-11 shrink-0 rounded-full border-2 bg-[#10141b] shadow-md transition-transform duration-200 group-hover/slot:scale-105',
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
                loading="lazy"
                decoding="async"
                fetchPriority="low"
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

          <div className="mt-0.5 flex items-center min-w-0">
            <div className="inline-flex max-w-full items-center rounded border border-primary/30 bg-primary/10 px-1.5 py-0.2 sm:py-0.5 shadow-xs transition-colors group-hover/slot:border-primary/50 group-hover/slot:bg-primary/15">
              <span className="truncate font-mono text-[10px] sm:text-[11px] font-semibold text-primary tracking-tight">
                {build.name}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Part: Gear Section (W-Engine + Discs) */}
      <div className="relative z-10 flex items-center gap-1.5 sm:gap-2 shrink-0 border-l border-white/12 pl-2 sm:pl-3">
        {/* W-Engine */}
        {wEngine ? (
          <div
            className="relative flex size-7.5 sm:size-8.5 shrink-0 items-center justify-center transition-transform duration-200 group-hover/slot:scale-110"
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
            className="flex size-7.5 sm:size-8.5 shrink-0 items-center justify-center text-[10px] font-mono text-muted-foreground/30"
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
              className="relative flex size-7 sm:size-8 shrink-0 items-center justify-center transition-transform duration-200 group-hover/slot:scale-110"
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
                  className="size-full object-contain select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]"
                />
              ) : (
                <Disc className="size-3.5 sm:size-4 text-muted-foreground/60" />
              )}
              <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-primary font-mono text-[8px] font-black text-black shadow-xs border border-black/80">
                {discSet.count}
              </span>
            </div>
          ))
        ) : (
          <div
            className="flex size-7 sm:size-8 shrink-0 items-center justify-center text-[10px] font-mono text-muted-foreground/30"
            title={t('teamBuilder.noSets')}
          >
            {t('teams.noDiscsShort')}
          </div>
        )}
      </div>
    </>
  )

  const slotClasses = cn(
    'group/slot relative flex items-center justify-between gap-2 sm:gap-3 overflow-hidden rounded-xl border px-2.5 sm:px-3.5 py-2 sm:py-2.5 transition-all duration-200 w-full text-left cursor-pointer',
    'border-white/[0.14] bg-gradient-to-b from-[#161d28] to-[#121722]',
    'hover:border-primary/60 hover:from-[#1c2432] hover:to-[#161e2a] shadow-[0_4px_16px_rgba(0,0,0,0.4)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.6),0_0_16px_rgba(201,242,75,0.12)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.99] sm:active:scale-100',
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
