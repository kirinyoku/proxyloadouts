import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus, RefreshCw, Users } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useBuilds, useMe, useShowcase } from '@/api/hooks'
import { useActiveAccount } from '@/hooks/useActiveAccount'
import { findMatchingSavedBuild, getAgentEquipmentFingerprint } from '@/lib/builds'
import { persistLastUid, readLastUid, UID_PATTERN } from '@/lib/uid'
import { AgentAvatarTab } from '@/components/showcase/AgentAvatarTab'
import { AgentStatsPanel } from '@/components/showcase/AgentStatsPanel'
import { ShowcaseProfileHeader } from '@/components/showcase/ShowcaseProfileHeader'
import { ShowcaseGuestBanner } from '@/components/showcase/ShowcaseGuestBanner'
import { WEngineCard } from '@/components/showcase/WEngineCard'
import { DriveDiscGrid } from '@/components/showcase/DriveDiscGrid'
import { cn } from '@/lib/utils'
import { AgentAvatarListSkeleton } from '@/components/showcase/AgentAvatarListSkeleton'
import { AgentBuildInspectorSkeleton } from '@/components/showcase/AgentBuildInspectorSkeleton'
import { ShowcaseProfileHeaderSkeleton } from '@/components/showcase/ShowcaseProfileHeaderSkeleton'
import { InterknotTerminalError } from '@/components/common/InterknotTerminalError'
import { Button } from '@/components/ui/button'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { getAttributeLabel, getSpecialtyLabel } from '@/lib/design-tokens'
import { useTranslation } from 'react-i18next'
import type { Agent } from '@/types'

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
  isAuthed: boolean
  isOwnedUid: boolean
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
  isAuthed,
  isOwnedUid,
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
  } else if (isAuthed && !isOwnedUid) {
    saveButton = (
      <Button
        variant="outline"
        className="h-7.5 shrink-0 gap-1.5 border-dashed border-primary/40 px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/10 cursor-pointer sm:h-8 sm:px-3 sm:text-xs"
        asChild
      >
        <Link to="/settings" title={t('showcase.linkUidTooltip')} aria-label={t('showcase.linkUid')}>
          <Plus className="size-3.5" />
          <span>{t('showcase.linkUid')}</span>
        </Link>
      </Button>
    )
  }

  return (
    <div className="relative rounded-3xl border border-white/[0.08] bg-[#111620]/96 p-3 shadow-xl backdrop-blur-sm md:p-4">
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

  const [uidInput, setUidInput] = useState(() => scannedUid || readLastUid())
  const [prevScannedUid, setPrevScannedUid] = useState(scannedUid)
  if (scannedUid && scannedUid !== prevScannedUid) {
    setPrevScannedUid(scannedUid)
    setUidInput(scannedUid)
    setSelectedAgentId(null)
    setSavingAgent(null)
    setLocallySavedFingerprints(new Set())
  }

  const detailRef = useRef<HTMLDivElement>(null)
  const agentRailRef = useRef<HTMLDivElement>(null)

  const buildsQuery = useBuilds(isAuthed && matchingAccount ? matchingAccount.id : undefined)
  const showcaseQuery = useShowcase(scannedUid)
  const showcase = showcaseQuery.data

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
    } else {
      setSearchParams((previous) => {
        const next = new URLSearchParams(previous)
        next.set('uid', uid)
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

  return (
    <div className="space-y-3">
      {showcaseQuery.isPending && scannedUid && <ShowcasePageSkeleton />}

      {showcaseQuery.isError && (
        <InterknotTerminalError
          error={showcaseQuery.error}
          uid={scannedUid}
          onScanUid={scan}
          onRetry={() => void showcaseQuery.refetch()}
          isRetrying={showcaseQuery.isFetching}
          className="mx-auto"
        />
      )}

      {showcase && (
        <div className="space-y-3">
          <ShowcaseProfileHeader
            showcase={showcase}
            uidInput={uidInput}
            isUidValid={isInputValid}
            isRefetching={showcaseQuery.isRefetching}
            onScan={scan}
            onUidInputChange={setUidInput}
            onRefresh={() => void showcaseQuery.refetch()}
          />

          {!isAuthed && <ShowcaseGuestBanner />}

          {/* Empty State when showcase has 0 agents */}
          {showcase.agents.length === 0 && (
            <div className="relative rounded-2xl border border-white/[0.08] bg-[#111620]/96 p-8 sm:py-12 shadow-lg backdrop-blur-sm">
              <div className="flex flex-col items-center justify-center space-y-3 max-w-md mx-auto text-center">
                <Users className="size-8 text-muted-foreground" />
                <div className="space-y-1">
                  <h3 className="font-heading text-base font-bold text-foreground">{t('showcase.emptyTitle')}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground max-w-prose">
                    {t('showcase.emptyDesc')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void showcaseQuery.refetch()}
                  loading={showcaseQuery.isRefetching}
                  className="mt-2"
                >
                  {!showcaseQuery.isRefetching && <RefreshCw className="size-3.5 mr-1.5" />}
                  {t('showcase.refreshShowcase')}
                </Button>
              </div>
            </div>
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
                    className="flex w-full shrink-0 snap-x snap-mandatory items-center gap-2 overflow-x-auto rounded-3xl border border-white/[0.08] bg-[#111620]/96 p-2 shadow-xl backdrop-blur-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:p-2.5 md:absolute md:inset-x-0 md:top-0 md:w-full md:max-h-full md:flex-col md:overflow-y-auto md:overflow-x-hidden md:snap-none"
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
                  isAuthed={isAuthed}
                  isOwnedUid={isOwnedUid}
                  onSaveClick={() => setSavingAgent(selectedAgent)}
                />
              </div>
            </div>
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
