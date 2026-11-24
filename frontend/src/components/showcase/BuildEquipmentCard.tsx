import type { ReactNode } from 'react'
import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { MindscapeBadge } from '@/components/ui/MindscapeBadge'
import { AgentStatsPanel } from '@/components/showcase/AgentStatsPanel'
import { FaeBadge } from '@/components/showcase/FaeBadge'
import { WEngineCard } from '@/components/showcase/WEngineCard'
import { DriveDiscGrid } from '@/components/showcase/DriveDiscGrid'
import { agentRoleCircleUrl, agentRoleIconUrl, agentRoleSelectUrl } from '@/lib/agent-icons'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Build } from '@/types'

// The inspector and PNG share this presentation so equipment styling cannot drift.
type BuildEquipmentCardProps = { build: Build } & (
  | { variant: 'dialog'; controls: ReactNode; tabs: ReactNode; mobileSection: 'discs' | 'stats' }
  | { variant: 'image' }
)

export function BuildEquipmentCard(props: BuildEquipmentCardProps) {
  const { build, variant } = props
  const { t } = useTranslation()
  const mobileSection = variant === 'dialog' ? props.mobileSection : 'discs'
  const controls = variant === 'dialog' ? props.controls : null
  const tabs = variant === 'dialog' ? props.tabs : null
  const Header = variant === 'dialog' ? DialogHeader : 'header'
  const Heading = variant === 'dialog' ? DialogTitle : 'h2'
  const Description = variant === 'dialog' ? DialogDescription : 'p'
  const agent = build.build_data
  const agentName = build.agent_name || agent.name
  const attributeName = agent.attribute ? t(`attributes.${agent.attribute}`, agent.attribute_name || agent.attribute) : (agent.attribute_name || '')
  const specialtyName = agent.specialty ? t(`specialties.${agent.specialty}`, agent.specialty_name || agent.specialty) : (agent.specialty_name || '')
  const circleUrl = agentRoleCircleUrl(agent.id)
  const selectUrl = agentRoleSelectUrl(agent.id)
  const generalUrl = agentRoleIconUrl(agent.id)
  const iconUrl = circleUrl ?? selectUrl ?? generalUrl ?? agent.splash_art_url
  return (
    <div data-build-equipment className="space-y-3 min-w-0 text-sm">
      {/* Header */}
      <Header className="flex flex-col gap-2 border-b border-white/[0.08] pb-3 text-left">
        <div className="flex items-center justify-between gap-2.5 min-w-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            {/* Agent Circle Avatar */}
            <div
              className={cn(
                'relative size-11 sm:size-13 shrink-0 rounded-full border-2 bg-subtle shadow-md',
                agent.rarity === 'S'
                  ? 'border-amber-400/80 shadow-[0_0_12px_rgba(245,238,56,0.2)]'
                  : agent.rarity === 'A'
                    ? 'border-purple-400/80 shadow-[0_0_12px_rgba(192,132,252,0.2)]'
                    : 'border-white/20',
                variant === 'image' && 'shadow-none',
              )}
            >
              <span className="relative block size-full overflow-hidden rounded-full">
                {iconUrl ? (
                  <img
                    src={iconUrl}
                    alt={agentName}
                    width={48}
                    height={48}
                    loading="eager"
                    decoding="async"
                    className="crisp-img size-full object-cover select-none pointer-events-none"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center font-heading text-xs font-bold text-foreground">
                    {agentName.slice(0, 2)}
                  </span>
                )}
              </span>

              {agent.mindscape_cinema > 0 && (
                <MindscapeBadge level={agent.mindscape_cinema} size="sm" />
              )}
            </div>

            {/* Agent Titles & Build Details */}
            <div className="min-w-0 flex-1 space-y-0.5 sm:space-y-1">
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <Heading className="truncate font-heading text-base sm:text-lg font-bold leading-none tracking-wide text-foreground">
                  {agentName}
                </Heading>
                <div className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[6px_6px_0_6px] border border-white/[0.1] bg-white/[0.05] px-2">
                  {agent.level > 0 && (
                    <>
                      <span className="font-heading text-xs leading-none tracking-wide text-foreground">
                        {t('gear.level', { level: agent.level })}
                      </span>
                      <span className="h-3 w-px shrink-0 bg-white/[0.14]" aria-hidden="true" />
                    </>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <AttributeBadge
                      attribute={agent.attribute}
                      label={attributeName}
                      className="size-3.5"
                    />
                    <SpecialtyBadge
                      specialty={agent.specialty}
                      label={specialtyName}
                      className="size-3.5"
                    />
                  </div>
                </div>
              </div>

              {/* Line 2: Build Name */}
              <div className="flex items-center gap-2 sm:gap-3.5 text-xs min-w-0">
                <div className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                  <Layers className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="truncate font-mono text-xs font-semibold text-foreground">
                    {build.name}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions: FAE Badge (desktop) + Note Button + Open in Roster (private mode) + Close Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <FaeBadge
              rating={build.fae_rating}
              showUnassessed={false}
              className="hidden sm:inline-flex w-auto"
            />
            {controls && <div data-build-controls className="contents">{controls}</div>}
          </div>
        </div>

        {/* Mobile FAE Badge: full-width sub-row in header */}
        {variant !== 'image' && (
          <FaeBadge
            rating={build.fae_rating}
            showUnassessed={false}
            className="sm:hidden w-full mt-2.5"
          />
        )}
      </Header>

      {/* On mobile screens: W-Engine card is displayed above the section tabs */}
      {variant !== 'image' && (
        <div className="lg:hidden">
          <WEngineCard wEngine={agent.w_engine} />
        </div>
      )}

      {/* On mobile screens, clean 2-tab switch between Discs & Build and Detailed Stats */}
      {tabs}

      {/* Body: Left WEngine & Stats + Right Discs */}
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[270px_minmax(0,1fr)]">
        {/* Left Column (Desktop) / Stats & Engine Panel (Mobile Stats Tab) */}
        <div className={cn('space-y-2.5', mobileSection === 'discs' && 'hidden lg:block')}>
          <div className="hidden lg:block">
            <WEngineCard wEngine={agent.w_engine} />
          </div>
          <AgentStatsPanel
            uiStats={agent.ui_stats}
            specialty={agent.specialty}
            agentId={agent.id}
            highlightProps={agent.highlight_props}
          />
        </div>

        {/* Right Column (Desktop) / Discs & Build Section (Mobile Discs Tab) */}
        <div className={cn('min-w-0 space-y-3', mobileSection !== 'discs' && 'hidden lg:block')}>
          <DriveDiscGrid
            driveDiscs={agent.drive_discs}
            wEngine={agent.w_engine}
            agentId={agent.id}
            recommendedSubStats={agent.recommended_sub_stats}
            highlightProps={agent.highlight_props}
          />
        </div>
      </div>

      {/* Footer: Build snapshot date metadata */}
      <div
        className={cn(
          'flex items-center border-t border-white/[0.08] pt-2',
          variant === 'image' ? 'justify-between gap-4' : 'justify-end text-right',
        )}
      >
        {variant === 'image' && (
          <span className="font-mono text-[11px] text-muted-foreground/60">proxyloadouts.com</span>
        )}
        <Description className="font-mono text-[11px] text-muted-foreground/60">
          {t('roster.updatedAt', { date: formatDateTime(build.updated_at) })}
        </Description>
      </div>
    </div>
  )
}
