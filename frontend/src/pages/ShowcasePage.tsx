import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Check, Layers, RefreshCw, Sparkles, Users } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBuilds, useMe, useShowcase, useShowcaseRoster } from '@/api/hooks'
import { useActiveAccount } from '@/hooks/useActiveAccount'
import { findMatchingSavedBuild, getAgentEquipmentFingerprint } from '@/lib/builds'
import { persistLastUid, readLastUid, UID_PATTERN } from '@/lib/uid'
import { AgentAvatarTab } from '@/components/showcase/AgentAvatarTab'
import { AgentStatsPanel } from '@/components/showcase/AgentStatsPanel'
import { ShowcaseProfileHeader } from '@/components/showcase/ShowcaseProfileHeader'
import { ShowcaseSavedPresets } from '@/components/showcase/ShowcaseSavedPresets'
import { ShowcaseSquads } from '@/components/showcase/ShowcaseSquads'
import { WEngineCard } from '@/components/showcase/WEngineCard'
import { DriveDiscGrid } from '@/components/showcase/DriveDiscGrid'
import { SegmentedControl, type SegmentedOption } from '@/components/settings/SegmentedControl'
import { cn } from '@/lib/utils'
import { AgentAvatarListSkeleton } from '@/components/showcase/AgentAvatarListSkeleton'
import { AgentBuildInspectorSkeleton } from '@/components/showcase/AgentBuildInspectorSkeleton'
import { ShowcaseProfileHeaderSkeleton } from '@/components/showcase/ShowcaseProfileHeaderSkeleton'
import { InterknotTerminalError } from '@/components/common/InterknotTerminalError'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { getAttributeLabel, getSpecialtyLabel } from '@/lib/design-tokens'
import { useTranslation } from 'react-i18next'
import type { Agent, ShowcaseResponse } from '@/types'

const SaveBuildDialog = lazy(() =>
  import('@/components/showcase/SaveBuildDialog').then((module) => ({
    default: module.SaveBuildDialog,
  })),
)

function ShowcasePageSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <ShowcaseProfileHeaderSkeleton />
      <div className="flex flex-col md:flex-row md:items-stretch gap-3">
        <AgentAvatarListSkeleton count={6} />
        <div className="min-w-0 flex-1 w-full">
          <AgentBuildInspectorSkeleton showDiscActions showMobileSections />
        </div>
      </div>
    </div>
  )
}

type MobileAgentSection = 'discs' | 'stats'

interface AgentShowcaseSectionProps {
  agent: Agent
  isSaved: boolean
  matchingBuildName?: string | null
  canSave: boolean
  onSaveClick: () => void
}

function MobileSectionTabs({
  activeSection,
  onChange,
}: {
  activeSection: MobileAgentSection
  onChange: (section: MobileAgentSection) => void
}) {
  const { t } = useTranslation()
  const tabs: ReadonlyArray<{ id: MobileAgentSection; label: string }> = [
    { id: 'discs', label: t('showcase.mobileDiscs') },
    { id: 'stats', label: t('showcase.mobileStats') },
  ]

  return (
    <div className="sticky top-14 z-30 -mx-4 border-b border-white/[0.06] bg-background/95 px-4 py-1 backdrop-blur-sm lg:hidden">
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

function AgentShowcaseSection({
  agent,
  isSaved,
  matchingBuildName,
  canSave,
  onSaveClick,
}: AgentShowcaseSectionProps) {
  const { t, i18n } = useTranslation()
  const [mobileSection, setMobileSection] = useState<MobileAgentSection>('discs')
  const currentLang = i18n.language
  const attributeLabel = agent.attribute ? getAttributeLabel(agent.attribute, currentLang) : agent.attribute_name
  const specialtyLabel = agent.specialty ? getSpecialtyLabel(agent.specialty, currentLang) : agent.specialty_name
  let saveButton = null
  if (canSave) {
    saveButton = isSaved ? (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex h-7.5 shrink-0 items-center justify-center gap-1.5 rounded-[10px] border border-primary/30 bg-primary/10 px-2.5 text-[11px] font-semibold text-primary select-none shadow-xs sm:h-8 sm:px-3 sm:text-xs sm:rounded-xl"
        aria-label={matchingBuildName ? t('showcase.buildSavedAs', { name: matchingBuildName }) : t('showcase.buildAlreadySaved')}
        title={matchingBuildName ? t('showcase.buildSavedAs', { name: matchingBuildName }) : t('showcase.buildAlreadySaved')}
      >
        <Check className="size-3.5 stroke-[2.5]" />
        <span>{t('showcase.buildAlreadySaved')}</span>
      </span>
    ) : (
      <Button
        className="h-7.5 px-2.5 text-[11px] cursor-pointer sm:h-8 sm:px-3.5 sm:text-xs"
        onClick={onSaveClick}
        aria-label={t('showcase.saveBuild')}
        title={t('showcase.saveBuild')}
      >
        <span>{t('showcase.saveBuild')}</span>
      </Button>
    )
  }

  return (
    <div className="relative rounded-3xl border border-white/[0.08] bg-card/96 p-3 shadow-xl backdrop-blur-sm md:p-4">
      <div className="space-y-3">
        {/* Agent identity and the primary build action */}
        <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <h2 className="truncate font-heading text-[15px] font-bold leading-none tracking-wide text-foreground sm:text-xl">
              {agent.name}
            </h2>

            <div className="flex shrink-0 items-center gap-1.5">
              {agent.attribute && <AttributeBadge attribute={agent.attribute} label={attributeLabel} />}
              {agent.specialty && <SpecialtyBadge specialty={agent.specialty} label={specialtyLabel} />}
            </div>
          </div>

          {saveButton && (
            <div className="shrink-0">
              {saveButton}
            </div>
          )}
        </div>

        {/* On mobile screens: W-Engine card is displayed above the section tabs */}
        <div className="lg:hidden">
          <WEngineCard wEngine={agent.w_engine} />
        </div>

        {/* On mobile screens, clean 2-tab switch between Discs & Build and Detailed Stats */}
        <MobileSectionTabs activeSection={mobileSection} onChange={setMobileSection} />

        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[270px_minmax(0,1fr)]">
          {/* Left Column (Desktop) / Stats & Engine Panel (Mobile Stats Tab) */}
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
      </div>
    </div>
  )
}

export function ShowcasePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const isAuthed = Boolean(me)
  const [searchParams, setSearchParams] = useSearchParams()

  const urlUid = searchParams.get('uid') ?? ''
  const hasValidUrlUid = UID_PATTERN.test(urlUid)

  const { activeAccount, accounts, isPending: accountsPending } = useActiveAccount({ enabled: isAuthed })

  const initialFallbackUid = useMemo(() => {
    if (hasValidUrlUid) return urlUid
    const last = readLastUid()
    return last && UID_PATTERN.test(last) ? last : ''
  }, [hasValidUrlUid, urlUid])

  const scannedUid = hasValidUrlUid ? urlUid : (activeAccount?.uid || initialFallbackUid)

  const matchingAccount = useMemo(() => {
    return accounts.find((a) => a.uid === scannedUid) ?? null
  }, [accounts, scannedUid])
  const isOwnedUid = Boolean(matchingAccount)

  // Auto-resolve UID if missing from URL
  useEffect(() => {
    if (!urlUid) {
      if (isAuthed && accountsPending) {
        return
      }
      if (activeAccount?.uid) {
        setSearchParams({ uid: activeAccount.uid }, { replace: true })
      } else {
        const lastUid = readLastUid()
        if (lastUid && UID_PATTERN.test(lastUid)) {
          setSearchParams({ uid: lastUid }, { replace: true })
        } else {
          // No known UID — redirect to home search
          navigate('/', { replace: true })
        }
      }
    }
  }, [urlUid, isAuthed, accountsPending, activeAccount, setSearchParams, navigate])

  // Automatically update showcase if active account was switched
  const prevActiveAccountIdRef = useRef<string | null>(null)
  const isInitialMountRef = useRef(true)

  useEffect(() => {
    if (isInitialMountRef.current) {
      if (activeAccount?.id) {
        prevActiveAccountIdRef.current = activeAccount.id
        isInitialMountRef.current = false
      }
      return
    }

    if (activeAccount && activeAccount.id !== prevActiveAccountIdRef.current) {
      prevActiveAccountIdRef.current = activeAccount.id
      if (activeAccount.uid && UID_PATTERN.test(activeAccount.uid)) {
        setSearchParams({ uid: activeAccount.uid }, { replace: true })
      }
    }
  }, [activeAccount, setSearchParams])

  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(null)
  const [savingAgent, setSavingAgent] = useState<Agent | null>(null)
  const [locallySavedFingerprints, setLocallySavedFingerprints] = useState<ReadonlySet<string>>(new Set())

  type ShowcaseMode = 'live' | 'presets' | 'squads'
  const urlTab = searchParams.get('tab')

  const mode: ShowcaseMode = useMemo(() => {
    if (urlTab === 'presets' || urlTab === 'roster') return 'presets'
    if (urlTab === 'squads' || urlTab === 'teams') return 'squads'
    return 'live'
  }, [urlTab])

  const [uidInput, setUidInput] = useState(() => scannedUid || readLastUid())
  const prevScannedUidRef = useRef(scannedUid)

  useEffect(() => {
    if (prevScannedUidRef.current && scannedUid !== prevScannedUidRef.current) {
      setUidInput(scannedUid)
      setSelectedAgentId(null)
      setSavingAgent(null)
      setLocallySavedFingerprints(new Set())
      if (searchParams.has('tab')) {
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('tab')
            return next
          },
          { replace: true },
        )
      }
    } else {
      setUidInput(scannedUid)
    }
    prevScannedUidRef.current = scannedUid
  }, [scannedUid, searchParams, setSearchParams])

  const detailRef = useRef<HTMLDivElement>(null)
  const agentRailRef = useRef<HTMLDivElement>(null)

  const buildsQuery = useBuilds(isAuthed && matchingAccount ? matchingAccount.id : undefined)
  const showcaseQuery = useShowcase(scannedUid)
  const rosterQuery = useShowcaseRoster(scannedUid)

  const hasPublicBuilds = Boolean(
    (rosterQuery.data?.is_public_roster ?? rosterQuery.data?.is_public_showcase) &&
      rosterQuery.data.builds.length > 0,
  )
  const hasPublicTeams = Boolean(
    (rosterQuery.data?.is_public_teams ?? rosterQuery.data?.is_public_showcase) &&
      rosterQuery.data.teams.length > 0,
  )

  const isEnkaDownWithRosterFallback =
    showcaseQuery.isError && (hasPublicBuilds || hasPublicTeams)

  const fallbackShowcase: ShowcaseResponse | null = useMemo(() => {
    if (!isEnkaDownWithRosterFallback || !rosterQuery.data) return null
    return {
      uid: scannedUid,
      nickname: rosterQuery.data.owner.nickname || `UID ${scannedUid}`,
      region: rosterQuery.data.owner.region,
      interknot_level: 0,
      avatar_url: rosterQuery.data.owner.avatar_url ?? undefined,
      source: 'cached',
      ttl_seconds: 0,
      fetched_at: '',
      agent_count: 0,
      agents: [],
      verified_owner: rosterQuery.data.owner,
      has_public_roster: hasPublicBuilds || hasPublicTeams,
    }
  }, [isEnkaDownWithRosterFallback, rosterQuery.data, scannedUid, hasPublicBuilds, hasPublicTeams])

  const showcase = showcaseQuery.data ?? fallbackShowcase

  const effectiveMode: ShowcaseMode = useMemo(() => {
    if (showcaseQuery.isError) {
      if (mode === 'presets' && hasPublicBuilds) return 'presets'
      if (mode === 'squads' && hasPublicTeams) return 'squads'
      return hasPublicBuilds ? 'presets' : hasPublicTeams ? 'squads' : 'live'
    }
    if (mode === 'presets') {
      if (!hasPublicBuilds && !rosterQuery.isPending) return 'live'
      return 'presets'
    }
    if (mode === 'squads') {
      if (!hasPublicTeams && !rosterQuery.isPending) return 'live'
      return 'squads'
    }
    return 'live'
  }, [showcaseQuery.isError, mode, hasPublicBuilds, hasPublicTeams, rosterQuery.isPending])

  function handleModeChange(nextMode: ShowcaseMode) {
    const nextParams = new URLSearchParams(searchParams)
    if (nextMode === 'live') {
      nextParams.delete('tab')
    } else {
      nextParams.set('tab', nextMode)
    }
    setSearchParams(nextParams, { replace: true })
  }

  // Clean up URL tab parameter when queries resolve and requested tab is unavailable
  useEffect(() => {
    if (rosterQuery.isPending || showcaseQuery.isPending) return
    if (urlTab && effectiveMode !== mode) {
      const nextParams = new URLSearchParams(searchParams)
      if (effectiveMode === 'live') {
        nextParams.delete('tab')
      } else {
        nextParams.set('tab', effectiveMode)
      }
      setSearchParams(nextParams, { replace: true })
    }
  }, [rosterQuery.isPending, showcaseQuery.isPending, urlTab, effectiveMode, mode, searchParams, setSearchParams])

  useEffect(() => {
    if (scannedUid) {
      persistLastUid(scannedUid)
    }
  }, [scannedUid])

  function scan(uidRaw: string) {
    const uid = uidRaw.trim()
    if (!UID_PATTERN.test(uid)) return
    setSelectedAgentId(null)
    setUidInput(uid)
    persistLastUid(uid)
    if (uid === scannedUid) {
      void showcaseQuery.refetch()
      void rosterQuery.refetch()
    } else {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        next.set('uid', uid)
        next.delete('tab')
        return next
      })
    }
  }

  function markSaved(fingerprint: string) {
    if (!fingerprint) return
    setLocallySavedFingerprints((previous) => new Set(previous).add(fingerprint))
  }

  const selectedAgent =
    showcase?.agents.find((agent) => agent.id === selectedAgentId) ??
    showcase?.agents[0] ??
    null

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) return

    const rail = agentRailRef.current
    const selectedTab = rail?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!rail || !selectedTab) return

    if (window.matchMedia('(max-width: 767px)').matches) {
      const railRect = rail.getBoundingClientRect()
      const tabRect = selectedTab.getBoundingClientRect()
      const nextScrollLeft =
        rail.scrollLeft + tabRect.left - railRect.left - (rail.clientWidth - tabRect.width) / 2
      rail.scrollTo({ left: Math.max(0, nextScrollLeft), behavior: 'smooth' })
    } else {
      const railRect = rail.getBoundingClientRect()
      const tabRect = selectedTab.getBoundingClientRect()
      if (tabRect.top < railRect.top || tabRect.bottom > railRect.bottom) {
        selectedTab.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedAgent?.id])

  const matchingSavedBuild = useMemo(() => {
    if (!selectedAgent) return null
    return findMatchingSavedBuild(selectedAgent, buildsQuery.data ?? [])
  }, [selectedAgent, buildsQuery.data])

  const isCurrentBuildSaved = useMemo(() => {
    if (!selectedAgent) return false
    const fp = getAgentEquipmentFingerprint(selectedAgent)
    return locallySavedFingerprints.has(fp) || Boolean(matchingSavedBuild)
  }, [selectedAgent, locallySavedFingerprints, matchingSavedBuild])

  const isInputValid = UID_PATTERN.test(uidInput)

  const pageTitle = scannedUid
    ? t('showcase.pageTitleWithUid', { uid: scannedUid })
    : t('showcase.pageTitle')

  if (showcaseQuery.isError && !rosterQuery.isPending && !isEnkaDownWithRosterFallback) {
    return (
      <div className="flex flex-1 min-h-[calc(100dvh-10rem)] flex-col items-center justify-center py-6 sm:py-10">
        <title>{pageTitle}</title>
        <meta name="description" content={t('showcase.metaDescription')} />
        <InterknotTerminalError
          error={showcaseQuery.error}
          uid={scannedUid}
          onScanUid={scan}
          onRetry={() => {
            void showcaseQuery.refetch()
            void rosterQuery.refetch()
          }}
          isRetrying={showcaseQuery.isFetching}
          className="w-full mx-auto"
        />
      </div>
    )
  }

  const modeOptions: readonly SegmentedOption<ShowcaseMode>[] = [
    ...(!showcaseQuery.isError
      ? [
          {
            value: 'live' as const,
            label: `${t('showcase.liveShowcase')} (${showcase?.agents.length ?? 0})`,
            glyph: <Sparkles className="size-3.5" />,
          },
        ]
      : []),
    ...(hasPublicBuilds
      ? [
          {
            value: 'presets' as const,
            label: `${t('showcase.savedPresets')} (${rosterQuery.data?.builds.length ?? 0})`,
            glyph: <Layers className="size-3.5" />,
          },
        ]
      : []),
    ...(hasPublicTeams
      ? [
          {
            value: 'squads' as const,
            label: `${t('showcase.squads')} (${rosterQuery.data?.teams.length ?? 0})`,
            glyph: <Users className="size-3.5" />,
          },
        ]
      : []),
  ]

  const showModeSwitcher = modeOptions.length > 1

  return (
    <div className="space-y-3">
      <title>{pageTitle}</title>
      <meta name="description" content={t('showcase.metaDescription')} />
      {(showcaseQuery.isPending || (showcaseQuery.isError && rosterQuery.isPending)) &&
        !showcase &&
        scannedUid && <ShowcasePageSkeleton />}

      {showcase && (
        <div className="space-y-3">
          <ShowcaseProfileHeader
            showcase={showcase}
            verifiedOwner={rosterQuery.data?.owner ?? showcase.verified_owner}
            uidInput={uidInput}
            isUidValid={isInputValid}
            isRefetching={showcaseQuery.isRefetching}
            onScan={scan}
            onUidInputChange={setUidInput}
            onRefresh={() => {
              void showcaseQuery.refetch()
              void rosterQuery.refetch()
            }}
          />

          {isEnkaDownWithRosterFallback && (
            <div
              role="alert"
              className="flex items-center gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200 shadow-sm"
            >
              <AlertCircle className="size-4 shrink-0 text-amber-400" />
              <span>{t('showcase.enkaUnavailableNotice')}</span>
            </div>
          )}

          {showModeSwitcher && (
            <div className="flex justify-start pt-1">
              <SegmentedControl
                options={modeOptions}
                value={effectiveMode}
                onValueChange={handleModeChange}
                ariaLabel={t('showcase.liveShowcase')}
              />
            </div>
          )}

          {effectiveMode === 'live' && (
            <>
              {/* Empty State when showcase has 0 agents */}
              {showcase.agents.length === 0 && (
                <EmptyState
                  icon={Users}
                  title={t('showcase.emptyTitle')}
                  description={t('showcase.emptyDesc')}
                  action={
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void showcaseQuery.refetch()}
                      loading={showcaseQuery.isRefetching}
                      className="gap-1.5"
                    >
                      {!showcaseQuery.isRefetching && <RefreshCw className="size-3.5" />}
                      {t('showcase.refreshShowcase')}
                    </Button>
                  }
                />
              )}

              {/* Main 2-Section Body: Vertical Circle Avatars Sidebar on the left + Agent Showcase on the right */}
              {selectedAgent && (
                <div ref={detailRef} className="scroll-mt-16 flex flex-col md:flex-row md:items-stretch gap-3">
                  {/* Dynamic vertical circular agent avatars sidebar capped at card height */}
                  {showcase.agents.length > 0 && (
                    <div className="w-full md:w-[70px] md:self-stretch md:shrink-0 relative">
                      <div
                        ref={agentRailRef}
                        role="tablist"
                        aria-label={t('showcase.agentsRailAria')}
                        className="flex w-full shrink-0 snap-x snap-mandatory items-center gap-2 overflow-x-auto rounded-3xl border border-white/[0.08] bg-card/96 p-2 shadow-xl backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-2.5 md:absolute md:inset-x-0 md:top-0 md:w-full md:max-h-full md:flex-col md:overflow-y-auto md:overflow-x-hidden md:snap-none"
                      >
                        {showcase.agents.map((agent) => (
                          <AgentAvatarTab
                            key={agent.id}
                            agent={agent}
                            selected={agent.id === selectedAgent?.id}
                            className="snap-start"
                            onSelect={() => setSelectedAgentId(agent.id)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Selected Agent Preset Content */}
                  <div className="min-w-0 flex-1 w-full">
                    <AgentShowcaseSection
                      agent={selectedAgent}
                      isSaved={isCurrentBuildSaved}
                      matchingBuildName={matchingSavedBuild?.name}
                      canSave={isAuthed && isOwnedUid}
                      onSaveClick={() => setSavingAgent(selectedAgent)}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {effectiveMode === 'presets' && (
            rosterQuery.isPending ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Spinner size="md" color="primary" />
                <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : (
              <ShowcaseSavedPresets builds={rosterQuery.data?.builds ?? []} />
            )
          )}

          {effectiveMode === 'squads' && (
            rosterQuery.isPending ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Spinner size="md" color="primary" />
                <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
              </div>
            ) : (
              <ShowcaseSquads teams={rosterQuery.data?.teams ?? []} />
            )
          )}
        </div>
      )}

      {savingAgent && matchingAccount && (
        <Suspense fallback={null}>
          <SaveBuildDialog
            agent={savingAgent}
            targetAccount={matchingAccount}
            existingBuildsCount={
              buildsQuery.data?.filter((b) => b.agent_id === savingAgent.id).length ?? 0
            }
            onSaved={(agent) => markSaved(getAgentEquipmentFingerprint(agent))}
            onOpenChange={(open) => {
              if (!open) setSavingAgent(null)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
