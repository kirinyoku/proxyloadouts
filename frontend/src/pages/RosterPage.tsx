import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Layers, Plus, RotateCcw, ScanLine, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ApiError } from '@/api/client'
import { useBuilds } from '@/api/hooks'
import { AgentAvatarTab } from '@/components/showcase/AgentAvatarTab'
import { RosterBuildToolbar } from '@/components/roster/RosterBuildToolbar'
import { RosterToolbar } from '@/components/roster/RosterToolbar'
import { AgentStatsPanel } from '@/components/showcase/AgentStatsPanel'
import { WEngineCard } from '@/components/showcase/WEngineCard'
import { DriveDiscGrid } from '@/components/showcase/DriveDiscGrid'
import { Button } from '@/components/ui/button'
import { InterknotTerminalError } from '@/components/common/InterknotTerminalError'
import { RosterPageSkeleton } from '@/components/roster/RosterPageSkeleton'
import { useActiveAccount } from '@/hooks/useActiveAccount'
import { groupByAgent } from '@/lib/builds'
import { cn } from '@/lib/utils'
import type { Attribute, Specialty } from '@/types'

type MobileRosterSection = 'discs' | 'stats'

/** Maximum number of saved builds allowed per agent (mirrors the backend limit). */
const MAX_BUILDS_PER_AGENT = 5

function MobileSectionTabs({
  activeSection,
  onChange,
}: {
  activeSection: MobileRosterSection
  onChange: (section: MobileRosterSection) => void
}) {
  const { t } = useTranslation()
  const tabs: ReadonlyArray<{ id: MobileRosterSection; label: string }> = [
    { id: 'discs', label: t('showcase.mobileDiscs') },
    { id: 'stats', label: t('showcase.mobileStats') },
  ]

  return (
    <div className="sticky top-14 z-30 -mx-2.5 sm:-mx-3 border-b border-white/[0.06] bg-[#0d121a]/95 px-3 py-1 backdrop-blur-md lg:hidden">
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

interface RosterPageProps {
  initialSearch?: string
  initialAttribute?: Attribute | null
  initialSpecialty?: Specialty | null
}

export function RosterPage({
  initialSearch = '',
  initialAttribute = null,
  initialSpecialty = null,
}: RosterPageProps = {}) {
  const { t } = useTranslation()
  const { activeAccount, accounts, isPending: accountsPending } = useActiveAccount()
  const buildsQuery = useBuilds(activeAccount?.id)
  const [searchParams, setSearchParams] = useSearchParams()

  const urlBuildId = searchParams.get('build')
  const fromTeams = searchParams.get('from') === 'teams'

  const [search, setSearch] = useState(initialSearch)
  const [selectedAttribute, setSelectedAttribute] = useState<Attribute | null>(initialAttribute)
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | null>(initialSpecialty)
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [selectedBuildIdMap, setSelectedBuildIdMap] = useState<Record<number, string>>({})
  const [mobileSection, setMobileSection] = useState<MobileRosterSection>('discs')
  const deferredSearch = useDeferredValue(search)
  const agentRailRef = useRef<HTMLDivElement>(null)

  const allBuilds = useMemo(() => buildsQuery.data ?? [], [buildsQuery.data])

  // Group all builds by agent
  const allGroups = useMemo(() => {
    return groupByAgent(allBuilds)
  }, [allBuilds])

  // 1. All attributes and specialties present in the full roster (for base toolbar buttons)
  const { rosterAttributes, rosterSpecialties } = useMemo(() => {
    const attrs = new Set<Attribute>()
    const specs = new Set<Specialty>()
    for (const g of allGroups) {
      const agent = g.builds[0]?.build_data
      if (agent?.attribute) attrs.add(agent.attribute)
      if (agent?.specialty) specs.add(agent.specialty)
    }
    return { rosterAttributes: attrs, rosterSpecialties: specs }
  }, [allGroups])

  // 2. Groups matching the search query
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

  // 3. Faceted available attributes: only attributes of agents that match search AND selectedSpecialty (if selected)
  const availableAttributes = useMemo(() => {
    const attrs = new Set<Attribute>()
    for (const g of groupsMatchingSearch) {
      const agent = g.builds[0]?.build_data
      if (!agent?.attribute) continue
      if (selectedSpecialty && agent.specialty !== selectedSpecialty) {
        continue
      }
      attrs.add(agent.attribute)
    }
    return attrs
  }, [groupsMatchingSearch, selectedSpecialty])

  // 4. Faceted available specialties: only specialties of agents that match search AND selectedAttribute (if selected)
  const availableSpecialties = useMemo(() => {
    const specs = new Set<Specialty>()
    for (const g of groupsMatchingSearch) {
      const agent = g.builds[0]?.build_data
      if (!agent?.specialty) continue
      if (selectedAttribute && agent.attribute !== selectedAttribute) {
        continue
      }
      specs.add(agent.specialty)
    }
    return specs
  }, [groupsMatchingSearch, selectedAttribute])

  // 5. Final filtered agent groups matching search, selectedAttribute, and selectedSpecialty
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

  const totalAgents = allGroups.length
  const totalBuilds = allBuilds.length
  const filteredAgents = filteredGroups.length

  // Deep-linked build from URL
  const urlTargetBuild = useMemo(() => {
    if (!urlBuildId || allBuilds.length === 0) return null
    return allBuilds.find((b) => b.id === urlBuildId) ?? null
  }, [allBuilds, urlBuildId])

  // Active selected agent group:
  // Explicit user selection -> selectedAgentId
  // Deep-linked build from URL -> agent of that build
  // Fallback -> first available group in filtered list
  const currentGroup = useMemo(() => {
    const targetAgentId = selectedAgentId ?? urlTargetBuild?.build_data.id
    if (targetAgentId !== undefined && targetAgentId !== null) {
      const match = filteredGroups.find((g) => g.agentId === targetAgentId)
      if (match) return match
    }
    return filteredGroups[0] ?? null
  }, [filteredGroups, selectedAgentId, urlTargetBuild])

  // Currently selected build of active agent
  const currentBuild = useMemo(() => {
    if (!currentGroup || currentGroup.builds.length === 0) return null
    const chosenId = selectedBuildIdMap[currentGroup.agentId]
    if (chosenId) {
      const matched = currentGroup.builds.find((b) => b.id === chosenId)
      if (matched) return matched
    }
    if (urlTargetBuild && urlTargetBuild.build_data.id === currentGroup.agentId) {
      const matched = currentGroup.builds.find((b) => b.id === urlTargetBuild.id)
      if (matched) return matched
    }
    return currentGroup.builds[0] ?? null
  }, [currentGroup, selectedBuildIdMap, urlTargetBuild])

  // Saved builds capacity of the active agent (max 5 per agent)
  const buildsAtLimit = (currentGroup?.builds.length ?? 0) >= MAX_BUILDS_PER_AGENT

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(max-width: 767px)').matches
    ) return

    const rail = agentRailRef.current
    const selectedTab = rail?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!rail || !selectedTab) return

    const railRect = rail.getBoundingClientRect()
    const tabRect = selectedTab.getBoundingClientRect()
    const nextScrollLeft =
      rail.scrollLeft + tabRect.left - railRect.left - (rail.clientWidth - tabRect.width) / 2
    rail.scrollTo({ left: Math.max(0, nextScrollLeft), behavior: 'smooth' })
  }, [currentGroup?.agentId])

  function handleSelectAgent(agentId: number) {
    setSelectedAgentId(agentId)
    setMobileSection('discs')
    // Clear URL param if user selects a different agent
    if (urlBuildId) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('build')
      setSearchParams(nextParams, { replace: true })
    }
  }

  function handleSelectBuildId(agentId: number, buildId: string) {
    setSelectedBuildIdMap((prev) => ({ ...prev, [agentId]: buildId }))
    // If URL has deep-link build, update or clear it
    if (urlBuildId && urlBuildId !== buildId) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('build', buildId)
      setSearchParams(nextParams, { replace: true })
    }
  }

  function handleResetFilters() {
    setSearch('')
    setSelectedAttribute(null)
    setSelectedSpecialty(null)
  }

  const capacityTitle = buildsAtLimit
    ? t('roster.buildsLimitMax')
    : t('roster.buildsLimitTitle', { count: currentGroup?.builds.length ?? 0 })

  const capacityChip = currentGroup ? (
    <span
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-xl border px-2 font-mono text-[11px] font-semibold select-none shadow-xs',
        buildsAtLimit
          ? 'border-amber-400/40 bg-amber-400/10 text-amber-300 font-bold'
          : 'border-white/10 bg-white/[0.04] text-neutral-300',
      )}
      title={capacityTitle}
      aria-label={capacityTitle}
    >
      <Layers className="size-3 text-primary stroke-[2.5] shrink-0" />
      <span className="whitespace-nowrap">
        {currentGroup.builds.length}/{MAX_BUILDS_PER_AGENT}
      </span>
    </span>
  ) : null

  return (
    <div className="space-y-1.5">
      {/* 1. Header & filtering toolbar */}
      <RosterToolbar
        search={search}
        onSearchChange={setSearch}
        selectedAttribute={selectedAttribute}
        onAttributeChange={setSelectedAttribute}
        selectedSpecialty={selectedSpecialty}
        onSpecialtyChange={setSelectedSpecialty}
        totalAgents={totalAgents}
        availableAttributes={availableAttributes}
        availableSpecialties={availableSpecialties}
        rosterAttributes={rosterAttributes}
        rosterSpecialties={rosterSpecialties}
        fromTeams={fromTeams}
        onResetFilters={handleResetFilters}
      />

      {/* 2. Account loading / empty states */}
      {accountsPending ? (
        <RosterPageSkeleton />
      ) : accounts.length === 0 ? (
        <div className="relative rounded-2xl border border-white/[0.08] bg-[#111620]/90 p-8 sm:py-12 shadow-lg backdrop-blur-xl">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-primary shadow-xs">
              <Plus className="size-6" />
            </div>
            <h3 className="font-heading text-lg font-bold">{t('roster.linkUidTitle')}</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {t('roster.linkUidDesc')}
            </p>
            <Button asChild className="mt-2">
              <Link to="/settings">
                <Plus className="size-4" />
                {t('roster.linkUidButton')}
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Builds loading state */}
          {buildsQuery.isPending && (
            <RosterPageSkeleton />
          )}

          {/* Builds loading error state */}
          {buildsQuery.isError && (
            <InterknotTerminalError
              variant="compact"
              error={buildsQuery.error}
              errorCode={buildsQuery.error instanceof ApiError ? `${buildsQuery.error.status}_ERR` : '500_ERR'}
              title={buildsQuery.error instanceof ApiError ? buildsQuery.error.message : t('roster.loadError')}
              onRetry={() => void buildsQuery.refetch()}
              isRetrying={buildsQuery.isFetching}
            />
          )}

          {/* Roster is empty state */}
          {buildsQuery.isSuccess && totalBuilds === 0 && (
            <div className="relative rounded-2xl border border-white/[0.08] bg-[#111620]/90 p-8 sm:py-12 shadow-lg backdrop-blur-xl">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-muted-foreground shadow-xs">
                  <Search className="size-6 text-muted-foreground/80" />
                </div>
                <h3 className="font-heading text-lg font-bold">{t('roster.emptyTitle')}</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  {t('roster.emptyDesc')}
                </p>
                <Button asChild className="mt-2">
                  <Link to="/showcase">
                    <ScanLine className="size-4" />
                    {t('roster.goToShowcase')}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Search yielded no results state */}
          {buildsQuery.isSuccess && totalBuilds > 0 && filteredAgents === 0 && searchNorm !== '' && (
            <div className="relative rounded-2xl border border-white/[0.08] bg-[#111620]/90 p-8 sm:py-12 shadow-lg backdrop-blur-xl">
              <div className="flex flex-col items-center justify-center gap-3 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-muted-foreground shadow-xs">
                  <Search className="size-6 text-muted-foreground/80" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">
                  {t('roster.noSearchResults')}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearch('')}
                  className="gap-1.5 rounded-xl border border-white/10 bg-black/40 hover:bg-white/[0.08] text-xs font-semibold text-foreground transition-all cursor-pointer shadow-xs"
                >
                  <RotateCcw className="size-3.5" />
                  {t('roster.clearSearchButton')}
                </Button>
              </div>
            </div>
          )}

          {/* 3. Master-detail roster layout */}
          {filteredAgents > 0 && currentGroup && currentBuild && (
            <div className="flex flex-col md:flex-row items-start gap-3">
              {/* Left column: horizontal snap scroll rail on mobile / vertical list on desktop */}
              <div
                ref={agentRailRef}
                role="tablist"
                aria-label={t('showcase.agentsRailAria')}
                className="flex w-full shrink-0 snap-x snap-mandatory items-center gap-2 overflow-x-auto rounded-3xl border border-white/[0.08] bg-[#111620]/90 p-2 shadow-xl backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-2.5 md:w-auto md:flex-col md:overflow-y-auto md:overflow-x-hidden md:max-h-[calc(100vh-8rem)] md:snap-none"
              >
                {filteredGroups.map((group) => (
                  <AgentAvatarTab
                    key={group.agentId}
                    agentId={group.agentId}
                    agentName={group.agentName}
                    primaryAgent={group.builds[0]?.build_data}
                    buildsCount={group.builds.length}
                    selected={group.agentId === currentGroup.agentId}
                    className="snap-start"
                    onSelect={() => handleSelectAgent(group.agentId)}
                  />
                ))}
              </div>

              {/* Right column: detailed build inspector */}
              <div className="min-w-0 flex-1 w-full">
                <div className="relative rounded-3xl border border-white/[0.08] bg-[#111620]/90 p-2.5 md:py-3 md:px-3.5 shadow-2xl backdrop-blur-xl">
                  <div className="space-y-2.5">
                    {/* Build management toolbar */}
                    <RosterBuildToolbar
                      agentName={currentGroup.agentName}
                      builds={currentGroup.builds}
                      selectedBuildId={currentBuild.id}
                      onSelectBuildId={(buildId) =>
                        handleSelectBuildId(currentGroup.agentId, buildId)
                      }
                      meta={capacityChip}
                    />

                    {/* On mobile screens: W-Engine card is displayed above the section tabs */}
                    <div className="lg:hidden">
                      <WEngineCard wEngine={currentBuild.build_data.w_engine} headingLevel={2} />
                    </div>

                    {/* On mobile screens, clean 2-tab switch between Discs & Build and Detailed Stats */}
                    <MobileSectionTabs activeSection={mobileSection} onChange={setMobileSection} />

                    {/* 2-column build layout: Left W-Engine & Stats, Right DriveDiscGrid */}
                    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[270px_minmax(0,1fr)]">
                      {/* Left column: W-Engine + vertical stats */}
                      <div className={cn('space-y-2.5', mobileSection === 'discs' && 'hidden lg:block')}>
                        <div className="hidden lg:block">
                          <WEngineCard wEngine={currentBuild.build_data.w_engine} headingLevel={2} />
                        </div>
                        <AgentStatsPanel
                          uiStats={currentBuild.build_data.ui_stats}
                          specialty={currentBuild.build_data.specialty}
                          agentId={currentBuild.agent_id}
                          highlightProps={currentBuild.build_data.highlight_props}
                        />
                      </div>

                      {/* Right column: 2x3 drive disc grid */}
                      <div className={cn('min-w-0 space-y-3', mobileSection !== 'discs' && 'hidden lg:block')}>
                        <DriveDiscGrid
                          driveDiscs={currentBuild.build_data.drive_discs}
                          wEngine={currentBuild.build_data.w_engine}
                          agentId={currentBuild.agent_id}
                          recommendedSubStats={currentBuild.build_data.recommended_sub_stats}
                          highlightProps={currentBuild.build_data.highlight_props}
                          headingLevel={3}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
