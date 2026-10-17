import { useState } from 'react'
import { ExternalLink, Layers, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { MindscapeBadge } from '@/components/ui/MindscapeBadge'
import { AgentStatsPanel } from '@/components/showcase/AgentStatsPanel'
import { WEngineCard } from '@/components/showcase/WEngineCard'
import { DriveDiscGrid } from '@/components/showcase/DriveDiscGrid'
import {
  agentRoleCircleUrl,
  agentRoleIconUrl,
  agentRoleSelectUrl,
} from '@/lib/agent-icons'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Build } from '@/types'

type MobileInspectorSection = 'discs' | 'stats'

function MobileSectionTabs({
  activeSection,
  onChange,
}: {
  activeSection: MobileInspectorSection
  onChange: (section: MobileInspectorSection) => void
}) {
  const { t } = useTranslation()
  const tabs: ReadonlyArray<{ id: MobileInspectorSection; label: string }> = [
    { id: 'discs', label: t('showcase.mobileDiscs') },
    { id: 'stats', label: t('showcase.mobileStats') },
  ]

  return (
    <div className="sticky top-0 z-30 -mx-3.5 sm:-mx-5 border-b border-white/[0.06] bg-popover/95 px-3.5 sm:px-5 py-1 backdrop-blur-md lg:hidden">
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

interface BuildInspectorDialogProps {
  build: Build | null
  open: boolean
  onOpenChange: (open: boolean) => void
  teamName?: string
}

export function BuildInspectorDialog({
  build,
  open,
  onOpenChange,
}: BuildInspectorDialogProps) {
  const { t } = useTranslation()
  const [mobileSection, setMobileSection] = useState<MobileInspectorSection>('discs')
  const [prevBuildId, setPrevBuildId] = useState(build?.id)

  if (build?.id !== prevBuildId) {
    setPrevBuildId(build?.id)
    setMobileSection('discs')
  }

  if (!build) return null

  const agent = build.build_data
  const agentName = build.agent_name || agent.name
  const attributeName = agent.attribute ? t(`attributes.${agent.attribute}`, agent.attribute_name || agent.attribute) : (agent.attribute_name || '')
  const specialtyName = agent.specialty ? t(`specialties.${agent.specialty}`, agent.specialty_name || agent.specialty) : (agent.specialty_name || '')
  const circleUrl = agentRoleCircleUrl(agent.id)
  const selectUrl = agentRoleSelectUrl(agent.id)
  const generalUrl = agentRoleIconUrl(agent.id)
  const iconUrl = circleUrl ?? selectUrl ?? generalUrl ?? agent.splash_art_url

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100vw-1.5rem)] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto overflow-x-hidden border border-white/10 bg-popover/95 p-3.5 sm:p-4 md:p-5 shadow-2xl backdrop-blur-2xl rounded-3xl"
      >
        <div className="space-y-3 min-w-0">
          {/* Header */}
          <DialogHeader className="border-b border-white/[0.08] pb-3 text-left">
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
                    <DialogTitle className="truncate font-heading text-base sm:text-lg font-bold tracking-wide text-foreground">
                      {agentName}
                    </DialogTitle>
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

              {/* Actions: Open in Roster + Close Button */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-2.5 sm:px-3 text-xs font-semibold text-foreground transition-all cursor-pointer shadow-xs active:scale-95 hover:border-primary/60 hover:bg-primary/15 hover:text-primary dark:border-white/15 dark:bg-white/[0.04] dark:text-foreground dark:hover:border-primary/60 dark:hover:bg-primary/15 dark:hover:text-primary"
                  asChild
                >
                  <Link
                    to={`/roster?build=${encodeURIComponent(build.id)}&from=teams`}
                    title={t('roster.openInRoster')}
                    aria-label={t('roster.openInRoster')}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span className="hidden min-[380px]:inline sm:inline">{t('roster.openInRoster')}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                  </Link>
                </Button>

                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onOpenChange(false)}
                    className="size-8 rounded-xl text-muted-foreground hover:bg-white/10 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer active:scale-95"
                    aria-label={t('common.close', 'Close')}
                    title={t('common.close', 'Close')}
                  >
                    <X className="size-4" />
                    <span className="sr-only">{t('common.close', 'Close')}</span>
                  </Button>
                </DialogClose>
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
          </DialogHeader>

          {/* On mobile screens: W-Engine card is displayed above the section tabs */}
          <div className="lg:hidden">
            <WEngineCard wEngine={agent.w_engine} />
          </div>

          {/* On mobile screens, clean 2-tab switch between Discs & Build and Detailed Stats */}
          <MobileSectionTabs activeSection={mobileSection} onChange={setMobileSection} />

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
          <div className="flex items-center justify-end border-t border-white/[0.08] pt-2 text-right">
            <DialogDescription className="font-mono text-[11px] text-muted-foreground/60">
              {t('roster.updatedAt', { date: formatDateTime(build.updated_at) })}
            </DialogDescription>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

