import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Layers, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AgentAvatarTab } from '@/components/showcase/AgentAvatarTab'
import { AgentStatsPanel } from '@/components/showcase/AgentStatsPanel'
import { WEngineCard } from '@/components/showcase/WEngineCard'
import { DriveDiscGrid } from '@/components/showcase/DriveDiscGrid'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { MindscapeBadge } from '@/components/ui/MindscapeBadge'
import { RosterToolbar } from '@/components/roster/RosterToolbar'
import { toast } from '@/components/ui/sonner'
import { getAttributeLabel, getSpecialtyLabel } from '@/lib/design-tokens'
import { groupByAgent } from '@/lib/builds'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Attribute, Build, Specialty } from '@/types'

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

  const [search, setSearch] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState<Attribute | null>(null)
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(null)
  const deferredSearch = useDeferredValue(search)

  const allGroups = useMemo(() => groupByAgent(builds), [builds])

  const rosterAttributes = useMemo(() => {
    const attrs = new Set<Attribute>()
    for (const b of builds) {
      if (b.build_data.attribute) attrs.add(b.build_data.attribute)
    }
    return attrs
  }, [builds])

  const rosterSpecialties = useMemo(() => {
    const specs = new Set<Specialty>()
    for (const b of builds) {
      if (b.build_data.specialty) specs.add(b.build_data.specialty)
    }
    return specs
  }, [builds])

  const searchNorm = deferredSearch.trim().toLowerCase()
  const groupsMatchingSearch = useMemo(() => {
    if (!searchNorm) return allGroups
    return allGroups.filter((group) => {
      const matchAgent = group.agentName.toLowerCase().includes(searchNorm)
      const matchBuildName = group.builds.some((b) =>
        b.name.toLowerCase().includes(searchNorm),
      )
      const matchWeapon = group.builds.some((b) =>
        b.build_data.w_engine?.name.toLowerCase().includes(searchNorm),
      )
      return matchAgent || matchBuildName || matchWeapon
    })
  }, [allGroups, searchNorm])

  const availableAttributes = useMemo(() => {
    const attrs = new Set<Attribute>()
    for (const g of groupsMatchingSearch) {
      const firstAgent = g.builds[0]?.build_data
      if (!firstAgent?.attribute) continue
      if (selectedSpecialty && firstAgent.specialty !== selectedSpecialty) {
        continue
      }
      attrs.add(firstAgent.attribute)
    }
    return attrs
  }, [groupsMatchingSearch, selectedSpecialty])

  const availableSpecialties = useMemo(() => {
    const specs = new Set<Specialty>()
    for (const g of groupsMatchingSearch) {
      const firstAgent = g.builds[0]?.build_data
      if (!firstAgent?.specialty) continue
      if (selectedAttribute && firstAgent.attribute !== selectedAttribute) {
        continue
      }
      specs.add(firstAgent.specialty)
    }
    return specs
  }, [groupsMatchingSearch, selectedAttribute])

  const filteredGroups = useMemo(() => {
    return groupsMatchingSearch.filter((group) => {
      const primaryAgent = group.builds[0]?.build_data
      if (selectedAttribute && primaryAgent?.attribute !== selectedAttribute) {
        return false
      }
      if (selectedSpecialty && primaryAgent?.specialty !== selectedSpecialty) {
        return false
      }
      return true
    })
  }, [groupsMatchingSearch, selectedAttribute, selectedSpecialty])

  function handleResetFilters() {
    setSearch('')
    setSelectedAttribute(null)
    setSelectedSpecialty(null)
  }

  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(() => allGroups[0]?.agentId ?? null)
  const [selectedBuildIdMap, setSelectedBuildIdMap] = useState<Record<number, string>>({})
  const [mobileSection, setMobileSection] = useState<MobileSection>('discs')
  const [copiedBuildId, setCopiedBuildId] = useState<string | null>(null)

  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const agentRailRef = useRef<HTMLDivElement>(null)

  // Default agent if current selection is invalid
  const activeGroup = useMemo(() => {
    if (selectedAgentId !== null) {
      const match = filteredGroups.find((g) => g.agentId === selectedAgentId)
      if (match) return match
    }
    return filteredGroups[0] ?? null
  }, [filteredGroups, selectedAgentId])

  const activeAgentBuilds = activeGroup?.builds ?? []
  const activeBuildId = activeGroup ? (selectedBuildIdMap[activeGroup.agentId] ?? activeAgentBuilds[0]?.id) : null
  const activeBuild = activeAgentBuilds.find((b) => b.id === activeBuildId) ?? activeAgentBuilds[0] ?? null
  const agent = activeBuild?.build_data ?? null

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  if (allGroups.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title={t('showcase.noPublicPresets')}
        description=""
      />
    )
  }

  const attributeLabel = agent?.attribute ? getAttributeLabel(agent.attribute, currentLang) : agent?.attribute_name
  const specialtyLabel = agent?.specialty ? getSpecialtyLabel(agent.specialty, currentLang) : agent?.specialty_name

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
      const g = allGroups.find((grp) => grp.agentId === agentId)
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
    <div className="space-y-3">
      {/* Filtering Toolbar */}
      <RosterToolbar
        search={search}
        onSearchChange={setSearch}
        selectedAttribute={selectedAttribute}
        onAttributeChange={setSelectedAttribute}
        selectedSpecialty={selectedSpecialty}
        onSpecialtyChange={setSelectedSpecialty}
        totalAgents={allGroups.length}
        availableAttributes={availableAttributes}
        availableSpecialties={availableSpecialties}
        rosterAttributes={rosterAttributes}
        rosterSpecialties={rosterSpecialties}
        onResetFilters={handleResetFilters}
        hideTitle
      />

      {filteredGroups.length === 0 || !activeGroup || !activeBuild || !agent ? (
        <EmptyState
          icon={Layers}
          title={search ? t('roster.noSearchResults') : t('roster.noFilterResults')}
          description=""
          action={
            <Button variant="outline" size="sm" onClick={handleResetFilters}>
              {search ? t('roster.clearSearchButton') : t('roster.resetFilters')}
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col md:flex-row md:items-stretch gap-3">
          {/* Dynamic agent rail / avatars on the left */}
          <div className="w-full md:w-[70px] md:self-stretch md:shrink-0 relative">
            <div
              ref={agentRailRef}
              role="tablist"
              aria-label={t('showcase.agentsRailAria')}
              className="flex w-full shrink-0 snap-x snap-mandatory items-center gap-2 overflow-x-auto rounded-3xl border border-white/[0.08] bg-card/96 p-2 shadow-xl backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-2.5 md:absolute md:inset-x-0 md:top-0 md:w-full md:max-h-full md:flex-col md:overflow-y-auto md:overflow-x-hidden md:snap-none"
            >
              {filteredGroups.map((group) => {
                const firstAgent = group.builds[0]?.build_data
                if (!firstAgent) return null
                const isSelected = group.agentId === activeGroup.agentId
                return (
                  <AgentAvatarTab
                    key={group.agentId}
                    agent={firstAgent}
                    selected={isSelected}
                    buildsCount={group.builds.length}
                    className="snap-start"
                    onSelect={() => handleSelectAgent(group.agentId)}
                  />
                )
              })}
            </div>
          </div>

          {/* Selected Agent Preset Content */}
          <div className="min-w-0 flex-1 w-full space-y-3">
            <div className="relative rounded-3xl border border-white/[0.08] bg-card/96 p-3 shadow-xl backdrop-blur-sm md:p-4">
              <div className="space-y-3">
                {/* Upper Header: Agent name, attributes, build select/chip, note & Share link */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {/* Agent name */}
                    <h2 className="truncate font-heading text-base sm:text-lg font-bold text-foreground">
                      {agent.name}
                    </h2>

                    {/* Badges: Attribute, Specialty, Mindscape */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      {agent.attribute && <AttributeBadge attribute={agent.attribute} label={attributeLabel} />}
                      {agent.specialty && <SpecialtyBadge specialty={agent.specialty} label={specialtyLabel} />}
                      {agent.mindscape_cinema > 0 && (
                        <MindscapeBadge level={agent.mindscape_cinema} size="sm" variant="inline" />
                      )}
                    </div>

                    {/* Build dropdown if >1 preset; otherwise mono chip */}
                    {activeAgentBuilds.length > 1 ? (
                      <Select value={activeBuild.id} onValueChange={handleSelectBuild}>
                        <SelectTrigger
                          size="sm"
                          className="h-7.5 w-auto max-w-[200px] gap-1.5 font-mono text-xs bg-white/[0.05] border-white/10"
                        >
                          <SelectValue>{activeBuild.name}</SelectValue>
                        </SelectTrigger>
                        <SelectContent align="start">
                          {activeAgentBuilds.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              <div className="flex items-center justify-between gap-3">
                                <span className="font-mono text-xs">{b.name}</span>
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {formatDateTime(b.updated_at || b.created_at)}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                        {activeBuild.name}
                      </span>
                    )}

                    {/* Note if present */}
                    {activeBuild.description?.trim() && (
                      <span className="truncate text-xs text-muted-foreground font-mono">
                        <span className="text-primary/70 mr-1">//</span>
                        {activeBuild.description.trim()}
                      </span>
                    )}
                  </div>

                  {/* Share button */}
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
  )}
</div>
  )
}
