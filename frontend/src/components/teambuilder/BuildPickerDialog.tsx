import { useDeferredValue, useMemo, useState } from 'react'
import {
  AlertCircle,
  ChevronRight,
  Disc,
  Layers,
  RotateCcw,
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
import { getBuildPickerConflict, type BuildPickerConflict } from '@/lib/conflicts'
import {
  ALL_ATTRIBUTES,
  ALL_SPECIALTIES,
  getAttributeLabel,
  getSpecialtyLabel,
} from '@/lib/design-tokens'
import { cn } from '@/lib/utils'
import type { Attribute, Build, Specialty } from '@/types'

interface BuildPickerDialogProps {
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
    return (candidate: Build): BuildPickerConflict | null => {
      if (squadBuilds && squadBuilds.length > 0) {
        return getBuildPickerConflict(candidate, squadBuilds)
      }
      if (usedBuildIds && usedBuildIds.has(candidate.id)) {
        return { type: 'IN_SQUAD', conflictingBuild: candidate }
      }
      return null
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

  function getConflictBadgeText(conflict: BuildPickerConflict): string {
    switch (conflict.type) {
      case 'IN_SQUAD':
        return t('teamBuilder.pickerInSquad')
      case 'DUPLICATE_AGENT':
        return t('teamBuilder.pickerAgentInSquad')
      case 'WEAPON_REUSE':
        return t('teamBuilder.pickerWeaponConflict')
      case 'ITEM_REUSE':
        return t('teamBuilder.pickerDiscConflict', { slot: conflict.discSlot ?? '?' })
      case 'ACCOUNT_MISMATCH':
        return t('teamBuilder.pickerAccountMismatch')
      default:
        return t('teamBuilder.pickerInSquad')
    }
  }

  function getConflictTooltip(conflict: BuildPickerConflict): string {
    switch (conflict.type) {
      case 'IN_SQUAD':
        return t('teamBuilder.pickerConflictTooltipInSquad')
      case 'DUPLICATE_AGENT':
        return t('teamBuilder.pickerConflictTooltipDuplicate', {
          agent: conflict.conflictingBuild.agent_name,
          build: conflict.conflictingBuild.name,
        })
      case 'WEAPON_REUSE':
        return t('teamBuilder.pickerConflictTooltipWeapon', {
          build: conflict.conflictingBuild.name,
        })
      case 'ITEM_REUSE':
        return t('teamBuilder.pickerConflictTooltipDisc', {
          slot: conflict.discSlot ?? '?',
          build: conflict.conflictingBuild.name,
        })
      case 'ACCOUNT_MISMATCH':
        return t('teamBuilder.pickerConflictTooltipAccount')
      default:
        return ''
    }
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
              #SELECT
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
                <Search className="size-4" />
                {t('teamBuilder.pickerScanShowcase')}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 min-h-0 flex-1">
            {/* Search Input (Full Width) */}
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

            {/* Filter Toolbar: Elements, Specialties, and Labeled Conflict Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-white/10 bg-[#121720] p-1.5 shadow-inner shrink-0">
              {/* Scrollable Track for Elements & Specialties */}
              <div className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth touch-pan-x py-0.5">
                {/* "All" Filter Pill */}
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

                {/* Attributes Visual Icons */}
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
                            ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(201,242,75,0.3)] scale-105'
                            : 'border-white/8 bg-white/[0.03] text-muted-foreground/80 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
                        )}
                      >
                        <AttributeBadge attribute={attr} label={label} className="size-4" />
                      </button>
                    )
                  })}
                </div>

                <div className="h-4 w-px bg-white/12 shrink-0 mx-0.5" aria-hidden="true" />

                {/* Specialties Visual Icons */}
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
                            ? 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(201,242,75,0.3)] scale-105'
                            : 'border-white/8 bg-white/[0.03] text-muted-foreground/80 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
                        )}
                      >
                        <SpecialtyBadge specialty={spec} label={label} className="size-4" />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Conflict Filter Toggle with Clear Label and Status Badge */}
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
                        : t('teamBuilder.pickerHideConflicting')
                    }
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

                    {/* Mobile status indicator badge */}
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
                      className="rounded-2xl border border-white/12 bg-[#10151f] shadow-[0_4px_16px_rgba(0,0,0,0.4)] overflow-hidden transition-all duration-200 [contain-intrinsic-size:auto_180px] [content-visibility:auto]"
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

                          const conflictTooltip = conflict ? getConflictTooltip(conflict) : ''

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
                                'group/build relative w-full rounded-xl border p-2.5 sm:px-3.5 sm:py-2.5 text-left transition-all duration-200 select-none',
                                isDisabled
                                  ? conflict?.type === 'IN_SQUAD'
                                    ? 'cursor-not-allowed border-white/[0.06] bg-[#12161f]/60 opacity-50'
                                    : 'cursor-not-allowed border-destructive/25 bg-[#141014]/60 opacity-65 hover:border-destructive/40'
                                  : 'cursor-pointer border-white/[0.14] bg-[#171e28] shadow-[0_2px_8px_rgba(0,0,0,0.35)] hover:border-primary/60 hover:bg-[#1c2432] hover:shadow-[0_4px_16px_rgba(0,0,0,0.5),0_0_14px_rgba(201,242,75,0.12)] active:scale-[0.99]',
                              )}
                            >
                              {/* Mobile Layout (< sm): 2-Tier Stacked Card */}
                              <div className="flex flex-col gap-2 w-full sm:hidden">
                                {/* Top Row: Build Name + Conflict Badge / Select Hint */}
                                <div className="flex items-center justify-between gap-2 min-w-0">
                                  <span
                                    className={cn(
                                      'truncate font-heading text-sm font-bold tracking-wide transition-colors',
                                      isDisabled
                                        ? 'text-white/60'
                                        : 'text-white group-hover/build:text-primary',
                                    )}
                                  >
                                    {build.name}
                                  </span>

                                  {conflict ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          className={cn(
                                            'inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold shadow-xs cursor-help',
                                            conflict.type === 'IN_SQUAD'
                                              ? 'border-white/15 bg-black/60 text-muted-foreground/80'
                                              : 'border-destructive/40 bg-destructive/15 text-destructive',
                                          )}
                                        >
                                          {conflict.type === 'IN_SQUAD' ? (
                                            <UsersRound className="size-3 text-primary/70" />
                                          ) : (
                                            <AlertCircle className="size-3 text-destructive" />
                                          )}
                                          <span>{getConflictBadgeText(conflict)}</span>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="end" className="text-xs max-w-xs">
                                        {conflictTooltip}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <div className="flex items-center gap-1 text-primary/70 group-hover/build:text-primary transition-colors shrink-0">
                                      <span className="font-mono text-[10px] font-bold">#SELECT</span>
                                      <ChevronRight className="size-3.5 group-hover/build:translate-x-0.5 transition-transform" />
                                    </div>
                                  )}
                                </div>

                                {/* Bottom Row: Gear Section (W-Engine on Left, Discs on Right) */}
                                <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/[0.08]">
                                  {/* W-Engine Info */}
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {wEngine ? (
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <div
                                          className="relative flex size-7 shrink-0 items-center justify-center"
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
                                      visualDiscSets.slice(0, 2).map((discSet) => (
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
                                      ))
                                    ) : (
                                      <span className="text-[11px] font-mono text-muted-foreground/40">
                                        {t('teams.noDiscsShort')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Desktop Layout (sm+): Horizontal Row */}
                              <div className="hidden sm:flex w-full items-center justify-between gap-3">
                                {/* Left: Build Name */}
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span
                                    className={cn(
                                      'truncate font-heading text-sm font-bold tracking-wide transition-colors',
                                      isDisabled
                                        ? 'text-white/60'
                                        : 'text-white group-hover/build:text-primary',
                                    )}
                                  >
                                    {build.name}
                                  </span>
                                </div>

                                {/* Right: Gear Section (W-Engine + Discs) + Status */}
                                <div className="flex items-center gap-2.5 sm:gap-3 shrink-0 pl-3 border-l border-white/12">
                                  {/* W-Engine */}
                                  {wEngine ? (
                                    <div
                                      className="relative flex size-8 sm:size-8.5 shrink-0 items-center justify-center transition-transform duration-150 group-hover/build:scale-110"
                                      title={`W-Engine: ${wEngineName} (P${wEngine.modification || 1})`}
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
                                  ) : (
                                    <div className="flex size-8 sm:size-8.5 shrink-0 items-center justify-center text-[10px] font-mono text-muted-foreground/30">
                                      {t('teams.noWEngineShort')}
                                    </div>
                                  )}

                                  {/* Drive Discs */}
                                  {visualDiscSets.length > 0 ? (
                                    <div className="flex items-center gap-1.5 sm:gap-2">
                                      {visualDiscSets.slice(0, 2).map((discSet) => (
                                        <div
                                          key={discSet.setId}
                                          className="relative flex size-7.5 sm:size-8 shrink-0 items-center justify-center transition-transform duration-150 group-hover/build:scale-110"
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
                                    <span className="text-[10px] font-mono text-muted-foreground/30">
                                      {t('teams.noDiscsShort')}
                                    </span>
                                  )}

                                  {/* Status if used or conflicting */}
                                  {conflict && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span
                                          className={cn(
                                            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[10px] font-bold shadow-xs cursor-help',
                                            conflict.type === 'IN_SQUAD'
                                              ? 'border-white/15 bg-black/60 text-muted-foreground/75'
                                              : 'border-destructive/40 bg-destructive/15 text-destructive',
                                          )}
                                        >
                                          {conflict.type === 'IN_SQUAD' ? (
                                            <UsersRound className="size-3 text-primary/70" />
                                          ) : (
                                            <AlertCircle className="size-3 text-destructive" />
                                          )}
                                          <span>
                                            {getConflictBadgeText(conflict)}
                                          </span>
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" align="end" className="text-xs max-w-xs">
                                        {conflictTooltip}
                                      </TooltipContent>
                                    </Tooltip>
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
