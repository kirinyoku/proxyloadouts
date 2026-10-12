import { useDeferredValue, useMemo, useState } from 'react'
import {
  Disc,
  Layers,
  RotateCcw,
  ScanLine,
  Search,
  ShieldAlert,
  UsersRound,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { agentRoleCircleUrl, agentRoleSelectUrl } from '@/lib/agent-icons'
import { groupByAgent } from '@/lib/builds'
import {
  getDetailedBuildPickerConflict,
  type DetailedBuildPickerConflict,
} from '@/lib/conflicts'
import {
  ALL_ATTRIBUTES,
  ALL_SPECIALTIES,
  getAttributeLabel,
  getSpecialtyLabel,
} from '@/lib/design-tokens'
import { cn } from '@/lib/utils'
import type { Attribute, Build, Specialty } from '@/types'

export interface BuildPickerDialogProps {
  open: boolean
  builds: Build[]
  /**
   * Other squad builds currently placed in team slots.
   * Used to detect and proactively disable duplicate agents, weapon collisions, and disc collisions.
   */
  squadBuilds?: readonly (Build | null | undefined)[]
  /**
   * Fallback set of build IDs in use if squadBuilds is omitted.
   */
  usedBuildIds?: ReadonlySet<string>
  onSelect: (buildId: string) => void
  onOpenChange: (open: boolean) => void
}

export function BuildPickerDialog({
  open,
  builds,
  squadBuilds,
  usedBuildIds,
  onSelect,
  onOpenChange,
}: BuildPickerDialogProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [selectedAttribute, setSelectedAttribute] = useState<Attribute | 'ALL'>('ALL')
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty | 'ALL'>('ALL')
  const [hideConflicting, setHideConflicting] = useState(false)
  const deferredQuery = useDeferredValue(query)

  const getConflict = useMemo(() => {
    return (candidate: Build): DetailedBuildPickerConflict | null => {
      return getDetailedBuildPickerConflict(candidate, squadBuilds, usedBuildIds)
    }
  }, [squadBuilds, usedBuildIds])

  const hasAnyConflicts = useMemo(() => {
    return builds.some((b) => getConflict(b) !== null)
  }, [builds, getConflict])

  const groups = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase()
    const all = groupByAgent(builds)

    return all
      .map((group) => {
        const sampleAgent = group.builds[0]?.build_data

        // Filter by Attribute
        if (selectedAttribute !== 'ALL' && sampleAgent?.attribute !== selectedAttribute) {
          return null
        }

        // Filter by Specialty
        if (selectedSpecialty !== 'ALL' && sampleAgent?.specialty !== selectedSpecialty) {
          return null
        }

        // Filter by Search Query
        const searchFiltered = normalized
          ? group.builds.filter(
              (build) =>
                build.agent_name.toLowerCase().includes(normalized) ||
                build.name.toLowerCase().includes(normalized) ||
                (build.build_data.w_engine &&
                  build.build_data.w_engine.name.toLowerCase().includes(normalized)),
            )
          : group.builds

        // Filter out conflicting builds if hideConflicting is active
        const availableBuilds = hideConflicting
          ? searchFiltered.filter((build) => getConflict(build) === null)
          : searchFiltered

        if (availableBuilds.length === 0) return null

        return {
          ...group,
          builds: availableBuilds,
        }
      })
      .filter((group): group is NonNullable<typeof group> => group !== null)
  }, [builds, deferredQuery, getConflict, hideConflicting, selectedAttribute, selectedSpecialty])

  function handlePick(buildId: string) {
    onSelect(buildId)
    setQuery('')
    setSelectedAttribute('ALL')
    setSelectedSpecialty('ALL')
    setHideConflicting(false)
    onOpenChange(false)
  }

  function handleResetFilters() {
    setQuery('')
    setSelectedAttribute('ALL')
    setSelectedSpecialty('ALL')
  }

  const hasActiveFilters =
    query.trim() !== '' ||
    selectedAttribute !== 'ALL' ||
    selectedSpecialty !== 'ALL'

  // Available attributes & specialties present in the user's builds
  const availableAttributes = useMemo(() => {
    const set = new Set<Attribute>()
    for (const b of builds) set.add(b.build_data.attribute)
    return ALL_ATTRIBUTES.filter((attr) => set.has(attr))
  }, [builds])

  const availableSpecialties = useMemo(() => {
    const set = new Set<Specialty>()
    for (const b of builds) set.add(b.build_data.specialty)
    return ALL_SPECIALTIES.filter((spec) => set.has(spec))
  }, [builds])

  const totalBuildsCount = useMemo(() => {
    return groups.reduce((acc, g) => acc + g.builds.length, 0)
  }, [groups])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleResetFilters()
          setHideConflicting(false)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        className={cn(
          'flex flex-col gap-3 sm:gap-3.5 overflow-hidden border border-white/12 bg-[#0c1015] text-white shadow-[0_24px_64px_rgba(0,0,0,0.85),0_0_36px_rgba(201,242,75,0.08)] duration-200 outline-none',
          // Mobile Bottom Sheet (< sm): anchored to bottom, full width, rounded top, max-h 92dvh, safe area padding
          'inset-x-0 bottom-0 top-auto left-0 translate-x-0 translate-y-0 w-full max-w-full max-h-[92dvh] rounded-t-[28px] rounded-b-none border-x-0 border-b-0 p-3.5 pb-6',
          // Desktop Modal (sm+): centered, max-w-2xl, max-h 85vh, rounded-2xl
          'sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl sm:max-h-[85vh] sm:rounded-2xl sm:border sm:p-5',
        )}
      >
        <TooltipProvider delayDuration={100} skipDelayDuration={300}>
          {/* Mobile Sheet Drag Handle Indicator */}
          <div
            className="mx-auto w-10 h-1 rounded-full bg-white/20 -mt-0.5 mb-1 sm:hidden shrink-0"
            aria-hidden="true"
          />

          {/* Header with ZZZ badge */}
          <DialogHeader className="flex flex-row items-center justify-between pb-2.5 sm:pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 pr-2">
              <span className="flex h-5 items-center rounded-md border border-primary/40 bg-primary/15 px-1.5 font-mono text-[11px] font-bold text-primary shadow-xs shrink-0">
                SELECT
              </span>
              <DialogTitle className="font-heading text-sm sm:text-base font-bold tracking-wide uppercase text-white truncate">
                <span className="sm:hidden">{t('teamBuilder.pickerTitleMobile')}</span>
                <span className="hidden sm:inline">{t('teamBuilder.pickerTitle')}</span>
              </DialogTitle>
            </div>
            <DialogDescription className="sr-only">
              {t('teamBuilder.pickerDesc')}
            </DialogDescription>
            <div
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-xs font-bold text-foreground/90 shrink-0 mr-8 sm:mr-7"
              title={t('teamBuilder.pickerTotalBuilds')}
            >
              <Layers className="size-3.5 text-primary" />
              <span>{totalBuildsCount}</span>
            </div>
          </DialogHeader>

          {builds.length === 0 ? (
            <div className="space-y-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {t('teamBuilder.pickerNoBuilds')}
              </p>
              <Button variant="outline" asChild className="border-primary/40 text-primary hover:bg-primary/10">
                <Link to="/showcase">
                  <ScanLine className="size-4" />
                  {t('teamBuilder.pickerScanShowcase')}
                </Link>
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 min-h-0 flex-1">
              {/* Search Input */}
              <div className="relative w-full">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/80" />
                <Input
                  autoFocus={false}
                  placeholder={t('teamBuilder.pickerSearchPlaceholder')}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-10 pl-9.5 pr-8.5 w-full rounded-[10px_10px_0_10px] border border-white/12 bg-[#121722] text-xs sm:text-sm text-white placeholder:text-muted-foreground/50 focus-visible:border-primary/70 focus-visible:bg-[#151c2a] focus-visible:ring-1 focus-visible:ring-primary/40 focus-visible:shadow-[0_0_16px_rgba(201,242,75,0.12)] transition-all"
                  aria-label={t('teamBuilder.pickerSearchPlaceholder')}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label={t('teams.clearSearchAria')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded text-muted-foreground hover:bg-white/10 hover:text-white cursor-pointer transition-colors"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-white/10 bg-[#121720] p-1.5 shadow-inner shrink-0">
                {/* Scrollable Track for Elements & Specialties */}
                <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth touch-pan-x py-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAttribute('ALL')
                      setSelectedSpecialty('ALL')
                    }}
                    className={cn(
                      'h-8 px-3 rounded-lg font-mono text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border shrink-0',
                      selectedAttribute === 'ALL' && selectedSpecialty === 'ALL'
                        ? 'bg-primary text-black border-primary shadow-xs'
                        : 'border-transparent bg-white/[0.04] text-muted-foreground hover:border-white/10 hover:bg-white/[0.08] hover:text-white',
                    )}
                  >
                    {t('teamBuilder.pickerAll')}
                  </button>

                  <div className="h-4 w-px bg-white/12 shrink-0 mx-0.5" aria-hidden="true" />

                  {/* Attributes Icons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {availableAttributes.map((attr) => {
                      const isSelected = selectedAttribute === attr
                      const label = getAttributeLabel(attr)
                      return (
                        <button
                          key={attr}
                          type="button"
                          aria-label={label}
                          title={label}
                          onClick={() =>
                            setSelectedAttribute((prev) => (prev === attr ? 'ALL' : attr))
                          }
                          className={cn(
                            'size-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border shrink-0',
                            isSelected
                              ? 'bg-white/20 border-white/40 text-white opacity-100 shadow-xs z-10 hover:bg-white/25 hover:border-white/50'
                              : 'border-white/8 bg-white/[0.03] text-muted-foreground/80 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
                          )}
                        >
                          <AttributeBadge attribute={attr} label={label} className="size-4" />
                        </button>
                      )
                    })}
                  </div>

                  <div className="h-4 w-px bg-white/12 shrink-0 mx-0.5" aria-hidden="true" />

                  {/* Specialties Icons */}
                  <div className="flex items-center gap-1 shrink-0">
                    {availableSpecialties.map((spec) => {
                      const isSelected = selectedSpecialty === spec
                      const label = getSpecialtyLabel(spec)
                      return (
                        <button
                          key={spec}
                          type="button"
                          aria-label={label}
                          title={label}
                          onClick={() =>
                            setSelectedSpecialty((prev) => (prev === spec ? 'ALL' : spec))
                          }
                          className={cn(
                            'size-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border shrink-0',
                            isSelected
                              ? 'bg-white/20 border-white/40 text-white opacity-100 shadow-xs z-10 hover:bg-white/25 hover:border-white/50'
                              : 'border-white/8 bg-white/[0.03] text-muted-foreground/80 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
                          )}
                        >
                          <SpecialtyBadge specialty={spec} label={label} className="size-4" />
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Conflict Filter Toggle */}
                {hasAnyConflicts && (
                  <div className="flex items-center sm:shrink-0 pt-1.5 sm:pt-0 border-t border-white/[0.08] sm:border-t-0 sm:pl-2 sm:border-l sm:border-white/12">
                    <button
                      type="button"
                      onClick={() => setHideConflicting((prev) => !prev)}
                      className={cn(
                        'flex items-center justify-between sm:justify-start w-full sm:w-auto gap-2 rounded-lg border px-2.5 py-1.5 sm:py-1 font-mono text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer select-none',
                        hideConflicting
                          ? 'border-destructive/40 bg-destructive/15 text-destructive shadow-xs'
                          : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
                      )}
                      title={
                        hideConflicting
                          ? t('teamBuilder.pickerShowAll')
                          : t('teamBuilder.pickerHideConflicting')}
                      aria-pressed={hideConflicting}
                    >
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert className="size-3.5 text-destructive shrink-0" />
                        <span className="text-[11px]">
                          {hideConflicting
                            ? t('teamBuilder.pickerShowAll')
                            : t('teamBuilder.pickerHideConflicting')}
                        </span>
                      </div>

                      <span
                        className={cn(
                          'sm:hidden rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                          hideConflicting
                            ? 'bg-destructive/25 text-destructive border border-destructive/40'
                            : 'bg-white/8 text-muted-foreground/80 border border-white/10',
                        )}
                      >
                        {hideConflicting
                          ? t('teamBuilder.pickerHiddenShort')
                          : t('teamBuilder.pickerAllShort')}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* List of Agent Groups and Builds */}
              <div
                className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1"
                role="listbox"
              >
                {groups.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground space-y-1.5">
                    <p className="font-medium text-foreground/80">{t('teamBuilder.pickerNoResults')}</p>
                    <p className="text-xs text-muted-foreground/60">{t('teamBuilder.pickerNoResultsSub')}</p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleResetFilters}
                        className="mt-2 text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
                      >
                        <RotateCcw className="size-3.5" />
                        {t('teams.resetFilters')}
                      </Button>
                    )}
                  </div>
                ) : (
                  groups.map((group) => {
                    const sampleAgent = group.builds[0]?.build_data
                    const circleUrl = agentRoleCircleUrl(group.agentId)
                    const selectUrl = agentRoleSelectUrl(group.agentId)
                    const agentImg = circleUrl ?? selectUrl ?? sampleAgent?.splash_art_url

                    return (
                      <div
                        key={group.agentId}
                        className="rounded-2xl border border-white/12 bg-[#10151f] shadow-[0_4px_16px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-200"
                      >
                        {/* Agent Header */}
                        <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#141a24] border-b border-white/10">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Agent Circular Avatar */}
                            <div
                              className={cn(
                                'relative size-8 sm:size-9 shrink-0 rounded-full border-2 bg-[#10141b] shadow-sm',
                                sampleAgent?.rarity === 'S'
                                  ? 'border-amber-400/80 shadow-[0_0_8px_rgba(245,238,56,0.25)]'
                                  : 'border-purple-400/80 shadow-[0_0_8px_rgba(192,132,252,0.25)]',
                              )}
                            >
                              {agentImg ? (
                                <img
                                  src={agentImg}
                                  alt=""
                                  loading="lazy"
                                  decoding="async"
                                  className="size-full object-cover rounded-full select-none pointer-events-none"
                                />
                              ) : (
                                <span className="flex size-full items-center justify-center font-heading text-[10px] font-bold text-foreground">
                                  {group.agentName.slice(0, 2)}
                                </span>
                              )}
                            </div>

                            <span className="font-heading text-xs sm:text-sm font-bold uppercase tracking-wider text-white truncate">
                              {group.agentName}
                            </span>

                            {sampleAgent && (
                              <div className="flex items-center gap-1 shrink-0">
                                <AttributeBadge
                                  attribute={sampleAgent.attribute}
                                  label={sampleAgent.attribute_name || undefined}
                                  className="size-3.5"
                                />
                                <SpecialtyBadge
                                  specialty={sampleAgent.specialty}
                                  label={sampleAgent.specialty_name || undefined}
                                  className="size-3.5"
                                />
                              </div>
                            )}
                          </div>

                          <div
                            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[11px] font-bold text-foreground/80 shrink-0"
                            title={t('teamBuilder.pickerAgentBuildsTooltip')}
                          >
                            <Layers className="size-3 text-primary" />
                            <span>{group.builds.length}</span>
                          </div>
                        </div>

                        {/* Builds List */}
                        <div className="p-2 sm:p-2.5 space-y-2">
                          {group.builds.map((build) => {
                            const conflict = getConflict(build)
                            const isDisabled = conflict !== null
                            const wEngine = build.build_data.w_engine
                            const wEngineName = wEngine?.name ?? ''
                            const driveDiscs = build.build_data.drive_discs
                            const setBonuses = driveDiscs?.set_bonuses ?? []
                            const discs = driveDiscs?.slots ?? []

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

                            // Build state classification
                            const isCurrentInSquad = conflict?.type === 'IN_SQUAD'
                            const isDuplicateAgent = conflict?.type === 'DUPLICATE_AGENT'
                            const isGearConflict = conflict?.type === 'GEAR_CONFLICT'
                            const hasWeaponConflict = conflict?.hasWeaponConflict ?? false
                            const conflictingDiscSlots = conflict?.conflictingDiscSlots ?? []

                            return (
                              <button
                                key={build.id}
                                type="button"
                                role="option"
                                aria-selected={false}
                                disabled={isDisabled}
                                aria-disabled={isDisabled}
                                onClick={() => {
                                  if (isDisabled) return
                                  handlePick(build.id)
                                }}
                                className={cn(
                                  'group/build relative w-full rounded-xl border p-2.5 sm:px-3 sm:py-2.5 text-left transition-all duration-200 select-none overflow-hidden',
                                  // Base & Status Styling with Edge Indicator
                                  isCurrentInSquad && [
                                    'border-l-4 border-l-white/25 border-white/[0.08] bg-[#11141c]/90 cursor-not-allowed opacity-75',
                                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                                  ],
                                  isDuplicateAgent && [
                                    'border-l-4 border-l-slate-500 border-white/[0.08] bg-[#11141c]/80 cursor-not-allowed opacity-75',
                                  ],
                                  isGearConflict && [
                                    'border-l-4 border-l-red-500/80 border-red-500/25 bg-[#181315] cursor-not-allowed',
                                    'shadow-[inset_0_1px_0_rgba(239,68,68,0.06)]',
                                  ],
                                  !isDisabled && [
                                    'border-l-4 border-l-transparent border-white/[0.12] bg-[#141a24] cursor-pointer',
                                    'shadow-[0_2px_8px_rgba(0,0,0,0.35)]',
                                    'hover:border-l-primary hover:border-primary/50 hover:bg-[#1a2230]',
                                    'hover:shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_14px_rgba(201,242,75,0.08)] active:scale-[0.995]',
                                  ],
                                )}
                              >
                                {/* MOBILE LAYOUT (< sm): 2-Tier Stacked Card */}
                                <div className="flex flex-col gap-2 w-full sm:hidden">
                                  {/* Top Row: Build Name + Status / Select Hint */}
                                  <div className="flex items-center justify-between gap-2 min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <span
                                        className={cn(
                                          'truncate font-heading text-sm font-bold tracking-wide transition-colors',
                                          isCurrentInSquad && 'text-white/70',
                                          isDuplicateAgent && 'text-white/60',
                                          isGearConflict && 'text-white/90',
                                          !isDisabled && 'text-white group-hover/build:text-primary',
                                        )}
                                      >
                                        {build.name}
                                      </span>
                                    </div>

                                    {/* Mobile Status Tag */}
                                    {isCurrentInSquad && (
                                      <span className="inline-flex shrink-0 items-center rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white/70">
                                        <span>
                                          {conflict?.squadSlot
                                            ? `${t('teamBuilder.pickerInSquad')} • ${conflict.squadSlot}P`
                                            : t('teamBuilder.pickerInSquad')}
                                        </span>
                                      </span>
                                    )}

                                    {isDuplicateAgent && (
                                      <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                        <UsersRound className="size-3" />
                                        <span>
                                          {conflict?.squadSlot
                                            ? `${t('teamBuilder.pickerAgentInSquad')} (${conflict.squadSlot}P)`
                                            : t('teamBuilder.pickerAgentInSquad')}
                                        </span>
                                      </span>
                                    )}

                                    {isGearConflict && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="inline-flex shrink-0 items-center rounded-md border border-red-500/35 bg-red-500/12 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-red-300 cursor-help">
                                            <span>
                                              {t('teamBuilder.pickerConflictBadge', { defaultValue: 'CONFLICT' })}
                                            </span>
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="end" className="text-xs max-w-xs space-y-1">
                                          <p className="font-semibold text-red-400">
                                            {t('teamBuilder.pickerGearConflictTitle', { defaultValue: 'Конфликт экипировки:' })}
                                          </p>
                                          {hasWeaponConflict && (
                                            <p>
                                              {t('teamBuilder.pickerWEngineBusy', {
                                                agent: conflict?.conflictingAgentName ?? '',
                                                defaultValue: `• Амплификатор занят агентом ${conflict?.conflictingAgentName ?? ''}`,
                                              })}
                                            </p>
                                          )}
                                          {conflictingDiscSlots.length > 0 && (
                                            <p>
                                              {t('teamBuilder.pickerDiscBusy', {
                                                slot: conflictingDiscSlots.join(', '),
                                                agent: conflict?.conflictingAgentName ?? '',
                                                defaultValue: `• Драйв-диск [${conflictingDiscSlots.join(', ')}] занят агентом ${conflict?.conflictingAgentName ?? ''}`,
                                              })}
                                            </p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}

                                    {!isDisabled && (
                                      <div className="flex items-center text-primary/70 group-hover/build:text-primary transition-colors shrink-0">
                                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider">
                                          {t('teamBuilder.pickerSelectButton', { defaultValue: 'SELECT' })}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Bottom Row: Gear Section */}
                                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.08]">
                                    {/* W-Engine Info with conflict ring */}
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                      {wEngine ? (
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <div
                                            className="relative flex size-7 shrink-0 items-center justify-center transition-all"
                                            title={`W-Engine: ${wEngineName} (P${wEngine.modification || 1})`}
                                          >
                                            {wEngine.icon_url ? (
                                              <img
                                                src={wEngine.icon_url}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                draggable={false}
                                                className="size-full object-contain select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                                              />
                                            ) : (
                                              <span className="font-heading text-xs font-bold text-primary">W</span>
                                            )}
                                            {(wEngine.rarity === 'S' || wEngine.modification > 1) && (
                                              <span className="absolute -bottom-0.5 -right-1 flex h-3.5 items-center rounded-full border border-white/20 bg-black px-1 font-sans text-[7.5px] font-black leading-none text-white">
                                                P{wEngine.modification || 1}
                                              </span>
                                            )}
                                          </div>
                                          <span className="text-xs text-foreground/80 font-medium truncate max-w-[140px]">
                                            {wEngineName}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-[11px] font-mono text-muted-foreground/40">
                                          {t('teams.noWEngineShort')}
                                        </span>
                                      )}
                                    </div>

                                    {/* Drive Discs */}
                                    <div className="flex items-center gap-1.5 shrink-0 pl-1.5">
                                      {visualDiscSets.length > 0 ? (
                                        <div className="flex items-center gap-1">
                                          {visualDiscSets.slice(0, 2).map((discSet) => (
                                            <div
                                              key={discSet.setId}
                                              className="relative flex size-7 shrink-0 items-center justify-center"
                                              title={`${discSet.name} (${t('gear.pieces', { count: discSet.count })})`}
                                            >
                                              {discSet.iconUrl ? (
                                                <img
                                                  src={discSet.iconUrl}
                                                  alt=""
                                                  loading="lazy"
                                                  decoding="async"
                                                  draggable={false}
                                                  className="size-full object-contain select-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                                                />
                                              ) : (
                                                <Disc className="size-3 text-muted-foreground/60" />
                                              )}
                                              <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-amber-400 font-mono text-[8px] font-black leading-none text-black shadow-xs border border-black">
                                                {discSet.count}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span className="text-[11px] font-mono text-muted-foreground/40">
                                          {t('teams.noDiscsShort')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* DESKTOP LAYOUT (sm+): 3-Column Grid */}
                                <div className="hidden sm:grid sm:grid-cols-[1fr_auto_148px] items-center gap-3 w-full">
                                  {/* Column 1: Build Name */}
                                  <div className="flex flex-col justify-center min-w-0 pr-2">
                                    <span
                                      className={cn(
                                        'truncate font-heading text-sm font-bold tracking-wide transition-colors',
                                        isCurrentInSquad && 'text-white/70',
                                        isDuplicateAgent && 'text-white/60',
                                        isGearConflict && 'text-white/90',
                                        !isDisabled && 'text-white group-hover/build:text-primary',
                                      )}
                                    >
                                      {build.name}
                                    </span>
                                  </div>

                                  {/* Column 2: Fixed Gear Block (W-Engine + Discs) with Contextual Warnings */}
                                  <div className="flex items-center gap-2.5 shrink-0 px-3 border-x border-white/10 h-9">
                                    {/* W-Engine Item */}
                                    {wEngine ? (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div
                                            className={cn(
                                              'relative flex size-8 sm:size-8.5 shrink-0 items-center justify-center transition-transform duration-150',
                                              !isDisabled && 'group-hover/build:scale-110',
                                            )}
                                          >
                                            {wEngine.icon_url ? (
                                              <img
                                                src={wEngine.icon_url}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                draggable={false}
                                                className="size-full object-contain select-none drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
                                              />
                                            ) : (
                                              <span className="font-heading text-xs font-bold text-primary">
                                                W
                                              </span>
                                            )}
                                            {(wEngine.rarity === 'S' || wEngine.modification > 1) && (
                                              <span className="absolute -bottom-0.5 -right-1 flex h-3.5 items-center rounded-full border border-white/20 bg-black px-1 font-sans text-[8px] font-black leading-none text-white">
                                                P{wEngine.modification || 1}
                                              </span>
                                            )}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs">
                                          {`W-Engine: ${wEngineName} (P${wEngine.modification || 1})`}
                                        </TooltipContent>
                                      </Tooltip>
                                    ) : (
                                      <div className="flex size-8 shrink-0 items-center justify-center text-[10px] font-mono text-muted-foreground/30 bg-white/[0.02] border border-white/5 rounded-lg">
                                        W-
                                      </div>
                                    )}

                                    {/* Drive Discs Items */}
                                    {visualDiscSets.length > 0 ? (
                                      <div className="flex items-center gap-1.5">
                                        {visualDiscSets.slice(0, 2).map((discSet) => (
                                          <div
                                            key={discSet.setId}
                                            className={cn(
                                              'relative flex size-7.5 shrink-0 items-center justify-center transition-transform duration-150',
                                              !isDisabled && 'group-hover/build:scale-105',
                                            )}
                                            title={`${discSet.name} (${t('gear.pieces', { count: discSet.count })})`}
                                          >
                                            {discSet.iconUrl ? (
                                              <img
                                                src={discSet.iconUrl}
                                                alt=""
                                                loading="lazy"
                                                decoding="async"
                                                draggable={false}
                                                className="size-full object-contain select-none drop-shadow-[0_2px_5px_rgba(0,0,0,0.85)]"
                                              />
                                            ) : (
                                              <Disc className="size-3.5 text-muted-foreground/60" />
                                            )}
                                            <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-amber-400 font-mono text-[8px] font-black leading-none text-black shadow-xs border border-black">
                                              {discSet.count}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="flex size-7.5 shrink-0 items-center justify-center text-[10px] font-mono text-muted-foreground/30 bg-white/[0.02] border border-white/5 rounded-lg">
                                        D-
                                      </div>
                                    )}
                                  </div>

                                  {/* Column 3: Fixed Status / Action Zone */}
                                  <div className="flex items-center justify-end shrink-0 pl-1">
                                    {isCurrentInSquad && (
                                      <div
                                        className="flex w-full items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white/70 shadow-xs"
                                        title={t('teamBuilder.pickerConflictTooltipInSquad')}
                                      >
                                        <span className="truncate">
                                          {conflict?.squadSlot
                                            ? `${t('teamBuilder.pickerInSquad')} • ${conflict.squadSlot}P`
                                            : t('teamBuilder.pickerInSquad')}
                                        </span>
                                      </div>
                                    )}

                                    {isDuplicateAgent && (
                                      <div
                                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.05] px-2 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground shadow-xs"
                                        title={t('teamBuilder.pickerAgentInSquad')}
                                      >
                                        <UsersRound className="size-3.5 shrink-0 text-muted-foreground/70" />
                                        <span className="truncate">
                                          {conflict?.squadSlot
                                            ? `${t('teamBuilder.pickerAgentInSquad')} (${conflict.squadSlot}P)`
                                            : t('teamBuilder.pickerAgentInSquad')}
                                        </span>
                                      </div>
                                    )}

                                    {isGearConflict && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="flex w-full items-center justify-center rounded-lg border border-red-500/35 bg-red-500/12 px-2.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-red-300 cursor-help transition-colors hover:bg-red-500/18 shadow-xs">
                                            <span className="truncate">
                                              {t('teamBuilder.pickerConflictBadge', { defaultValue: 'CONFLICT' })}
                                            </span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" align="end" className="text-xs max-w-xs space-y-1">
                                          <p className="font-semibold text-red-400">
                                            {t('teamBuilder.pickerGearConflictTitle', { defaultValue: 'Конфликт экипировки:' })}
                                          </p>
                                          {hasWeaponConflict && (
                                            <p>
                                              {t('teamBuilder.pickerWEngineBusyWithTitle', {
                                                name: conflict?.conflictingWeaponName ?? '',
                                                agent: conflict?.conflictingAgentName ?? '',
                                                defaultValue: `• Амплификатор «${conflict?.conflictingWeaponName ?? ''}» занят агентом ${conflict?.conflictingAgentName ?? ''}`,
                                              })}
                                            </p>
                                          )}
                                          {conflictingDiscSlots.length > 0 && (
                                            <p>
                                              {t('teamBuilder.pickerDiscBusy', {
                                                slot: conflictingDiscSlots.join(', '),
                                                agent: conflict?.conflictingAgentName ?? '',
                                                defaultValue: `• Драйв-диск [${conflictingDiscSlots.join(', ')}] занят агентом ${conflict?.conflictingAgentName ?? ''}`,
                                              })}
                                            </p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    )}

                                    {!isDisabled && (
                                      <div className="flex w-full items-center justify-center rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-primary transition-all group-hover/build:bg-primary group-hover/build:text-black group-hover/build:border-primary group-hover/build:shadow-[0_0_12px_rgba(201,242,75,0.25)]">
                                        <span>{t('teamBuilder.pickerSelectButton', { defaultValue: 'SELECT' })}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </TooltipProvider>
      </DialogContent>
    </Dialog>
  )
}
