import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Layers, Sparkles } from 'lucide-react'
import { usePublicBuild } from '@/api/hooks'
import { PublicOwnerHeader } from '@/components/common/PublicOwnerHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { PageLoader } from '@/components/common/PageLoader'
import { AgentStatsPanel } from '@/components/showcase/AgentStatsPanel'
import { WEngineCard } from '@/components/showcase/WEngineCard'
import { DriveDiscGrid } from '@/components/showcase/DriveDiscGrid'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { MindscapeBadge } from '@/components/ui/MindscapeBadge'
import { Button } from '@/components/ui/button'
import {
  agentRoleCircleUrl,
  agentRoleIconUrl,
  agentRoleSelectUrl,
} from '@/lib/agent-icons'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

type MobileSection = 'discs' | 'stats'

function MobileSectionTabs({
  activeSection,
  onChange,
}: {
  activeSection: MobileSection
  onChange: (section: MobileSection) => void
}) {
  const { t } = useTranslation()
  const tabs: ReadonlyArray<{ id: MobileSection; label: string }> = [
    { id: 'discs', label: t('showcase.mobileDiscs') },
    { id: 'stats', label: t('showcase.mobileStats') },
  ]

  return (
    <div className="sticky top-14 z-30 -mx-3 border-b border-white/[0.06] bg-background/95 px-3 py-1 backdrop-blur-sm lg:hidden">
      <div
        role="tablist"
        aria-label={t('showcase.agentSectionsAria')}
        className="mx-auto grid max-w-sm grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/40 p-0.5"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeSection
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'h-7.5 rounded-[6px] px-2 text-xs font-semibold transition-all select-none cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground font-medium',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PublicBuildPage() {
  const { t } = useTranslation()
  const { buildId } = useParams<{ buildId: string }>()
  const { data, isLoading, isError } = usePublicBuild(buildId)
  const [mobileSection, setMobileSection] = useState<MobileSection>('discs')

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageLoader label={t('common.loading')} />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={Layers}
          title={t('sharing.buildNotFoundTitle')}
          description={t('sharing.buildNotFoundDesc')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="secondary" className="gap-2 rounded-xl">
                <Link to="/">
                  <Home className="size-4" />
                  <span>{t('sharing.backToHome')}</span>
                </Link>
              </Button>
              <Button asChild className="gap-2 rounded-xl bg-primary text-primary-foreground">
                <Link to="/showcase">
                  <Sparkles className="size-4" />
                  <span>{t('sharing.backToShowcase')}</span>
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const { build, owner } = data
  const agent = build.build_data
  const agentName = build.agent_name || agent.name
  const attributeName = agent.attribute
    ? t(`attributes.${agent.attribute}`, agent.attribute_name || agent.attribute)
    : (agent.attribute_name || '')
  const specialtyName = agent.specialty
    ? t(`specialties.${agent.specialty}`, agent.specialty_name || agent.specialty)
    : (agent.specialty_name || '')

  const circleUrl = agentRoleCircleUrl(agent.id)
  const selectUrl = agentRoleSelectUrl(agent.id)
  const generalUrl = agentRoleIconUrl(agent.id)
  const iconUrl = circleUrl ?? selectUrl ?? generalUrl ?? agent.splash_art_url

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 sm:px-4 py-4 sm:py-6">
      {/* Top Author / Owner Header */}
      <PublicOwnerHeader owner={owner} />

      {/* Main Build Card */}
      <div className="rounded-3xl border border-white/[0.08] bg-card/96 p-3.5 sm:p-5 shadow-2xl backdrop-blur-sm">
        <div className="space-y-4">
          {/* Header: Agent Identity + Preset Name & Note */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/[0.08] pb-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Agent Avatar */}
              <div
                className={cn(
                  'relative size-12 sm:size-14 shrink-0 rounded-full border-2 bg-subtle shadow-md',
                  agent.rarity === 'S'
                    ? 'border-amber-400/80 shadow-[0_0_12px_rgba(245,238,56,0.2)]'
                    : agent.rarity === 'A'
                      ? 'border-purple-400/80 shadow-[0_0_12px_rgba(192,132,252,0.2)]'
                      : 'border-white/20',
                )}
              >
                <span className="relative block size-full overflow-hidden rounded-full">
                  {iconUrl ? (
                    <img
                      src={iconUrl}
                      alt={agentName}
                      width={56}
                      height={56}
                      loading="eager"
                      decoding="async"
                      className="crisp-img size-full object-cover select-none pointer-events-none"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center font-heading text-sm font-bold text-foreground">
                      {agentName.slice(0, 2)}
                    </span>
                  )}
                </span>

                {agent.mindscape_cinema > 0 && (
                  <MindscapeBadge level={agent.mindscape_cinema} size="sm" />
                )}
              </div>

              {/* Agent Titles */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <h1 className="truncate font-heading text-lg sm:text-xl font-bold tracking-wide text-foreground">
                    {agentName}
                  </h1>
                  <span className="font-mono text-xs font-semibold text-muted-foreground">
                    Lv. {agent.level}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <AttributeBadge
                      attribute={agent.attribute}
                      label={attributeName}
                      className="size-4"
                    />
                    <SpecialtyBadge
                      specialty={agent.specialty}
                      label={specialtyName}
                      className="size-4"
                    />
                  </div>
                </div>

                {/* Preset name & Note */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono font-bold text-primary">
                    {build.name}
                  </span>
                  {build.description && (
                    <span className="text-muted-foreground">
                      <span className="font-heading text-primary/70 mr-1">//</span>
                      {build.description}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Timestamp */}
            <div className="shrink-0 font-mono text-[11px] text-muted-foreground sm:text-right">
              {formatDateTime(build.updated_at || build.created_at)}
            </div>
          </div>

          {/* Mobile W-Engine Card */}
          <div className="lg:hidden">
            <WEngineCard wEngine={agent.w_engine} headingLevel={2} />
          </div>

          {/* Mobile section tabs */}
          <MobileSectionTabs activeSection={mobileSection} onChange={setMobileSection} />

          {/* 2-column layout: W-Engine + Stats (left), DriveDiscs (right) */}
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[270px_minmax(0,1fr)]">
            <div className={cn('space-y-3', mobileSection === 'discs' && 'hidden lg:block')}>
              <div className="hidden lg:block">
                <WEngineCard wEngine={agent.w_engine} headingLevel={2} />
              </div>
              <AgentStatsPanel
                uiStats={agent.ui_stats}
                specialty={agent.specialty}
                agentId={agent.id}
              />
            </div>

            <div className={cn('min-w-0', mobileSection === 'stats' && 'hidden lg:block')}>
              <DriveDiscGrid
                driveDiscs={agent.drive_discs}
                wEngine={agent.w_engine}
                agentId={agent.id}
                headingLevel={3}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
export default PublicBuildPage
