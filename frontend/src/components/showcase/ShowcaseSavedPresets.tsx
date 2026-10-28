import { useEffect, useRef, useState } from 'react'
import { Check, Layers, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AgentAvatarTab } from '@/components/showcase/AgentAvatarTab'
import { AgentStatsPanel } from '@/components/showcase/AgentStatsPanel'
import { WEngineCard } from '@/components/showcase/WEngineCard'
import { DriveDiscGrid } from '@/components/showcase/DriveDiscGrid'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { MindscapeBadge } from '@/components/ui/MindscapeBadge'
import { toast } from '@/components/ui/sonner'
import { getAttributeLabel, getSpecialtyLabel } from '@/lib/design-tokens'
import { groupByAgent } from '@/lib/builds'
import { cn } from '@/lib/utils'
import type { Build } from '@/types'

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
                'h-7.5 rounded-[6px] px-2 text-xs font-semibold transition-all select-none',
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

export interface ShowcaseSavedPresetsProps {
  builds: Build[]
}

export function ShowcaseSavedPresets({ builds }: ShowcaseSavedPresetsProps) {
  const { t, i18n } = useTranslation()
  const currentLang = i18n.language

  const groups = groupByAgent(builds)
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(() => groups[0]?.agentId ?? null)
  const [selectedBuildIdMap, setSelectedBuildIdMap] = useState<Record<number, string>>({})
  const [mobileSection, setMobileSection] = useState<MobileSection>('discs')
  const [copiedBuildId, setCopiedBuildId] = useState<string | null>(null)

  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const agentRailRef = useRef<HTMLDivElement>(null)

  // Default agent if current selection is invalid
  const activeGroup = groups.find((g) => g.agentId === selectedAgentId) ?? groups[0] ?? null
  const activeAgentBuilds = activeGroup?.builds ?? []
  const activeBuildId = activeGroup ? (selectedBuildIdMap[activeGroup.agentId] ?? activeAgentBuilds[0]?.id) : null
  const activeBuild = activeAgentBuilds.find((b) => b.id === activeBuildId) ?? activeAgentBuilds[0] ?? null
  const agent = activeBuild?.build_data ?? null

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  if (groups.length === 0 || !activeGroup || !activeBuild || !agent) {
    return (
      <EmptyState
        icon={Layers}
        title={t('showcase.noPublicPresets')}
        description=""
      />
    )
  }

  const attributeLabel = agent.attribute ? getAttributeLabel(agent.attribute, currentLang) : agent.attribute_name
  const specialtyLabel = agent.specialty ? getSpecialtyLabel(agent.specialty, currentLang) : agent.specialty_name

  async function handleCopyLink(buildId: string) {
    const url = `${window.location.origin}/b/${buildId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedBuildId(buildId)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopiedBuildId(null), 2000)
      toast.success(t('showcase.presetLinkCopied'))
    } catch {
      // clipboard unavailable
    }
  }

  function handleSelectAgent(agentId: number) {
    setSelectedAgentId(agentId)
    // Keep first build of this agent if not yet selected
    if (!selectedBuildIdMap[agentId]) {
      const g = groups.find((grp) => grp.agentId === agentId)
      const firstBuild = g?.builds[0]
      if (firstBuild) {
        setSelectedBuildIdMap((prev) => ({ ...prev, [agentId]: firstBuild.id }))
      }
    }
  }

  function handleSelectBuild(buildId: string) {
    if (!activeGroup) return
    setSelectedBuildIdMap((prev) => ({ ...prev, [activeGroup.agentId]: buildId }))
  }

  return (
    <div className="flex flex-col md:flex-row md:items-stretch gap-3">
      {/* Dynamic agent rail / avatars on the left */}
      <div className="w-full md:w-[70px] md:self-stretch md:shrink-0 relative">
        <div
          ref={agentRailRef}
          role="tablist"
          aria-label={t('showcase.agentsRailAria')}
          className="flex w-full shrink-0 snap-x snap-mandatory items-center gap-2 overflow-x-auto rounded-3xl border border-white/[0.08] bg-card/96 p-2 shadow-xl backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-2.5 md:absolute md:inset-x-0 md:top-0 md:w-full md:max-h-full md:flex-col md:overflow-y-auto md:overflow-x-hidden md:snap-none"
        >
          {groups.map((group) => {
            const firstAgent = group.builds[0]?.build_data
            if (!firstAgent) return null
            const isSelected = group.agentId === activeGroup.agentId
            return (
              <div key={group.agentId} className="relative snap-start">
                <AgentAvatarTab
                  agent={firstAgent}
                  selected={isSelected}
                  onSelect={() => handleSelectAgent(group.agentId)}
                />
                {group.builds.length > 1 && (
                  <span
                    aria-label={t('showcase.viewAllPresets', { count: group.builds.length })}
                    className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[9px] font-bold text-primary-foreground shadow-xs pointer-events-none"
                  >
                    {group.builds.length}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Selected Agent Preset Content */}
      <div className="min-w-0 flex-1 w-full space-y-3">
        <div className="relative rounded-3xl border border-white/[0.08] bg-card/96 p-3 shadow-xl backdrop-blur-sm md:p-4">
          <div className="space-y-3">
            {/* Upper Header: Agent name, attributes, preset switcher pills & Share link */}
            <div className="flex flex-col gap-2.5 border-b border-white/[0.08] pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="truncate font-heading text-[15px] font-bold leading-none tracking-wide text-foreground sm:text-xl">
                    {agent.name}
                  </h2>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {agent.attribute && <AttributeBadge attribute={agent.attribute} label={attributeLabel} />}
                    {agent.specialty && <SpecialtyBadge specialty={agent.specialty} label={specialtyLabel} />}
                    {agent.mindscape_cinema > 0 && (
                      <MindscapeBadge level={agent.mindscape_cinema} size="sm" />
                    )}
                  </div>
                </div>

                {/* Direct link copy button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(activeBuild.id)}
                  title={t('showcase.copyPresetLink')}
                  className="h-8 gap-1.5 rounded-xl border-white/10 text-xs font-medium hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all shrink-0"
                >
                  {copiedBuildId === activeBuild.id ? (
                    <>
                      <Check className="size-3.5 stroke-[2.5] text-primary" />
                      <span>{t('sharing.linkCopied')}</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="size-3.5" />
                      <span>{t('sharing.share')}</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Preset Selector tabs (if multiple presets exist for this agent) + Preset name/desc */}
              <div className="flex flex-col gap-1.5">
                {activeAgentBuilds.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {activeAgentBuilds.map((b) => {
                      const isSelected = b.id === activeBuild.id
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleSelectBuild(b.id)}
                          className={cn(
                            'rounded-lg px-2.5 py-1 text-xs font-semibold transition-all select-none',
                            isSelected
                              ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                              : 'border border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground',
                          )}
                        >
                          {b.name}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-baseline gap-2 pt-0.5">
                  <span className="font-mono text-sm font-bold text-primary">
                    {activeBuild.name}
                  </span>
                  {activeBuild.description?.trim() && (
                    <span className="text-xs text-muted-foreground">
                      // {activeBuild.description.trim()}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile WEngine card */}
            <div className="lg:hidden">
              <WEngineCard wEngine={agent.w_engine} />
            </div>

            {/* Mobile Section Tabs */}
            <MobileSectionTabs activeSection={mobileSection} onChange={setMobileSection} />

            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[270px_minmax(0,1fr)]">
              {/* Left Column (Desktop) / Stats & Engine (Mobile Stats) */}
              <div className={cn('space-y-3', mobileSection === 'discs' && 'hidden lg:block')}>
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

              {/* Right Column (Desktop) / Discs Section (Mobile Discs) */}
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
          </div>
        </div>
      </div>
    </div>
  )
}
