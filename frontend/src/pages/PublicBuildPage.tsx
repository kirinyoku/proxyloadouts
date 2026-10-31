import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Check, Layers, Share2 } from 'lucide-react'
import { usePublicBuild } from '@/api/hooks'
import { PublicOwnerHeader } from '@/components/common/PublicOwnerHeader'
import { PageLoader } from '@/components/common/PageLoader'
import { SharedUnavailableState } from '@/components/common/SharedUnavailableState'
import { AgentStatsPanel } from '@/components/showcase/AgentStatsPanel'
import { WEngineCard } from '@/components/showcase/WEngineCard'
import { DriveDiscGrid } from '@/components/showcase/DriveDiscGrid'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { MindscapeBadge } from '@/components/ui/MindscapeBadge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import {
  agentRoleCircleUrl,
  agentRoleIconUrl,
  agentRoleSelectUrl,
} from '@/lib/agent-icons'
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
  const { buildId, token } = useParams<{ buildId: string; token: string }>()
  const { data, isLoading, isError } = usePublicBuild(buildId, token)
  const [mobileSection, setMobileSection] = useState<MobileSection>('discs')
  const [linkCopied, setLinkCopied] = useState(false)
  const linkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function handleShare() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
      if (linkTimerRef.current) clearTimeout(linkTimerRef.current)
      linkTimerRef.current = setTimeout(() => setLinkCopied(false), 1500)
      toast.success(t('sharing.linkCopied'))
    } catch {
      toast.error(t('sharing.copyError'))
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <PageLoader label={t('common.loading')} />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <SharedUnavailableState
        title={t('sharing.buildNotFoundTitle')}
        description={t('sharing.buildNotFoundDesc')}
      />
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

  const pageTitle = t('sharing.buildPageTitle', { agent: agentName, build: build.name })
  const pageDescription = t('sharing.buildPageMetaDesc', {
    agent: agentName,
    owner: owner.nickname || owner.uid,
  })

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-3 sm:px-4 py-4 sm:py-6">
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      {/* Top Author / Owner Header */}
      <PublicOwnerHeader owner={owner} targetTab="presets" showShareButton={false} />

      {/* Main Build Card */}
      <div className="rounded-3xl border border-white/[0.08] bg-card/96 p-3.5 sm:p-5 shadow-2xl backdrop-blur-sm">
        <div className="space-y-4">
          {/* Header: Agent Identity + Preset Name & Note + Share Button */}
          <div className="border-b border-white/[0.08] pb-3">
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
                  {/* Line 1: Agent Name + Attribute Badge + Specialty Badge */}
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <h1 className="truncate font-heading text-base sm:text-lg font-bold tracking-wide text-foreground">
                      {agentName}
                    </h1>
                    <div className="flex shrink-0 items-center gap-1">
                      <AttributeBadge
                        attribute={agent.attribute}
                        label={attributeName}
                        className="size-3.5 sm:size-4"
                      />
                      <SpecialtyBadge
                        specialty={agent.specialty}
                        label={specialtyName}
                        className="size-3.5 sm:size-4"
                      />
                    </div>
                  </div>

                  {/* Line 2: Build Name (and Note on desktop sm+) */}
                  <div className="flex items-center gap-2 sm:gap-3.5 text-xs min-w-0">
                    <div className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
                      <Layers className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate font-mono text-xs font-semibold text-foreground">
                        {build.name}
                      </span>
                    </div>

                    {/* Desktop Note: inline next to build */}
                    {build.description?.trim() && (
                      <span
                        className="hidden sm:inline-flex items-center gap-1.5 min-w-0 max-w-full font-mono text-xs text-muted-foreground"
                        title={build.description.trim()}
                      >
                        <span className="inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary select-none shrink-0">
                          {t('roster.addNote')}
                        </span>
                        <span className="truncate text-muted-foreground">
                          {build.description.trim()}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions: Separator + Share Button */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="hidden h-6 w-px shrink-0 bg-white/[0.12] sm:block" aria-hidden="true" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleShare}
                  aria-label={t('sharing.shareBuild')}
                  title={t('sharing.shareBuild')}
                  className="relative size-8 shrink-0 rounded-xl text-muted-foreground hover:bg-white/[0.08] hover:text-foreground cursor-pointer"
                >
                  {linkCopied ? (
                    <Check className="size-3.5 text-primary" />
                  ) : (
                    <Share2 className="size-3.5" />
                  )}
                  {build.is_public && !linkCopied && (
                    <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />
                  )}
                </Button>
              </div>
            </div>

            {/* Mobile Note: full-width sub-row in header */}
            {build.description?.trim() && (
              <div
                className="flex sm:hidden items-center gap-1.5 min-w-0 pt-2 font-mono text-xs text-muted-foreground"
                title={build.description.trim()}
              >
                <span className="inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary select-none shrink-0">
                  {t('roster.addNote')}
                </span>
                <span className="truncate text-muted-foreground">
                  {build.description.trim()}
                </span>
              </div>
            )}
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
                highlightProps={agent.highlight_props}
              />
            </div>

            <div className={cn('min-w-0', mobileSection === 'stats' && 'hidden lg:block')}>
              <DriveDiscGrid
                driveDiscs={agent.drive_discs}
                wEngine={agent.w_engine}
                agentId={agent.id}
                highlightProps={agent.highlight_props}
                recommendedSubStats={agent.recommended_sub_stats}
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
