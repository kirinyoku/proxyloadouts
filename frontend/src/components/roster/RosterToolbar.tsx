import { useMemo } from 'react'
import { ArrowLeft, RotateCcw, Search, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import {
  ALL_ATTRIBUTES,
  ALL_SPECIALTIES,
  getAttributeLabel,
  getSpecialtyLabel,
} from '@/lib/design-tokens'
import { cn } from '@/lib/utils'
import type { Attribute, Specialty } from '@/types'

const ATTR_ACTIVE_STYLES: Record<Attribute, string> = {
  Physical: 'border-[#f0d12a] bg-[#f0d12a]/20 shadow-[0_0_10px_rgba(240,209,42,0.4)] ring-1 ring-[#f0d12a]/60',
  Fire: 'border-[#ff5522] bg-[#ff5522]/20 shadow-[0_0_10px_rgba(255,85,34,0.4)] ring-1 ring-[#ff5522]/60',
  Ice: 'border-[#98eff0] bg-[#98eff0]/20 shadow-[0_0_10px_rgba(152,239,240,0.4)] ring-1 ring-[#98eff0]/60',
  Electric: 'border-[#bf6aff] bg-[#bf6aff]/20 shadow-[0_0_10px_rgba(191,106,255,0.4)] ring-1 ring-[#bf6aff]/60',
  Ether: 'border-[#fe427e] bg-[#fe427e]/20 shadow-[0_0_10px_rgba(254,66,126,0.4)] ring-1 ring-[#fe427e]/60',
  Frost: 'border-[#7dd8ff] bg-[#7dd8ff]/20 shadow-[0_0_10px_rgba(125,216,255,0.4)] ring-1 ring-[#7dd8ff]/60',
  HonedEdge: 'border-[#ffb13d] bg-[#ffb13d]/20 shadow-[0_0_10px_rgba(255,177,61,0.4)] ring-1 ring-[#ffb13d]/60',
  Wind: 'border-[#34d399] bg-[#34d399]/20 shadow-[0_0_10px_rgba(52,211,153,0.4)] ring-1 ring-[#34d399]/60',
  AuricInk: 'border-[#818cf8] bg-[#818cf8]/20 shadow-[0_0_10px_rgba(129,140,248,0.4)] ring-1 ring-[#818cf8]/60',
  Lumiflux: 'border-[#5eead4] bg-[#5eead4]/20 shadow-[0_0_10px_rgba(94,234,212,0.4)] ring-1 ring-[#5eead4]/60',
}

const STANDARD_ATTRIBUTES: readonly Attribute[] = [
  'Physical',
  'Fire',
  'Ice',
  'Electric',
  'Ether',
  'Frost',
]

const STANDARD_SPECIALTIES: readonly Specialty[] = [
  'Attack',
  'Stun',
  'Anomaly',
  'Support',
  'Defense',
  'Rupture',
  'Armorer',
]

interface RosterToolbarProps {
  search: string
  onSearchChange: (value: string) => void
  selectedAttribute: Attribute | null
  onAttributeChange: (attr: Attribute | null) => void
  selectedSpecialty: Specialty | null
  onSpecialtyChange: (spec: Specialty | null) => void
  totalAgents: number
  availableAttributes?: Set<Attribute>
  availableSpecialties?: Set<Specialty>
  fromTeams?: boolean
  onResetFilters?: () => void
}

/**
 * Roster filtering toolbar:
 * - Title & back-to-teams link
 * - Search input
 * - Attribute capsule (standard elemental attributes)
 * - Specialty capsule (standard combat roles)
 * - Reset active filters button
 *
 * Mobile layout ergonomics:
 * - Dedicated rows for Element and Role filters so both are instantly visible
 *   without requiring horizontal scrolling or hiding roles behind elements.
 */
export function RosterToolbar({
  search,
  onSearchChange,
  selectedAttribute,
  onAttributeChange,
  selectedSpecialty,
  onSpecialtyChange,
  totalAgents,
  availableAttributes,
  availableSpecialties,
  fromTeams,
  onResetFilters,
}: RosterToolbarProps) {
  const { t } = useTranslation()
  const formattedCount = String(totalAgents).padStart(2, '0')
  const hasFilter = Boolean(search || selectedAttribute || selectedSpecialty)

  function handleReset() {
    if (onResetFilters) {
      onResetFilters()
      return
    }
    onSearchChange('')
    onAttributeChange(null)
    onSpecialtyChange(null)
  }

  // Display released game attributes plus any custom attribute present in availableAttributes
  const attributesList = useMemo(() => {
    if (!availableAttributes || availableAttributes.size === 0) {
      return STANDARD_ATTRIBUTES
    }
    return ALL_ATTRIBUTES.filter(
      (attr) => STANDARD_ATTRIBUTES.includes(attr) || availableAttributes.has(attr),
    )
  }, [availableAttributes])

  // Display released game specialties plus any present in availableSpecialties
  const specialtiesList = useMemo(() => {
    if (!availableSpecialties || availableSpecialties.size === 0) {
      return STANDARD_SPECIALTIES
    }
    return ALL_SPECIALTIES.filter(
      (spec) => STANDARD_SPECIALTIES.includes(spec) || availableSpecialties.has(spec),
    )
  }, [availableSpecialties])

  function renderAttributeButtons() {
    return attributesList.map((attr) => {
      const active = selectedAttribute === attr
      const isAvailable = availableAttributes ? availableAttributes.has(attr) : true
      const activeClass = ATTR_ACTIVE_STYLES[attr] ?? 'border-primary bg-primary/20'
      const label = getAttributeLabel(attr)

      return (
        <button
          key={attr}
          type="button"
          aria-pressed={active}
          onClick={() => onAttributeChange(active ? null : attr)}
          title={`${t('roster.attrTooltip', { label })}${active ? t('roster.attrTooltipActive') : ''}${!isAvailable ? t('roster.attrTooltipEmpty') : ''}`}
          className={cn(
            'relative flex size-7.5 sm:size-7 items-center justify-center rounded-lg border transition-all duration-150 cursor-pointer select-none',
            active
              ? `${activeClass} scale-105 z-10`
              : isAvailable
                ? 'border-transparent bg-white/[0.04] opacity-85 hover:opacity-100 hover:border-white/25 hover:bg-white/[0.1]'
                : 'border-transparent bg-transparent opacity-25 hover:opacity-50 hover:bg-white/[0.04]',
          )}
        >
          <AttributeBadge attribute={attr} className="size-4 pointer-events-none" />
        </button>
      )
    })
  }

  function renderSpecialtyButtons() {
    return specialtiesList.map((spec) => {
      const active = selectedSpecialty === spec
      const isAvailable = availableSpecialties ? availableSpecialties.has(spec) : true
      const label = getSpecialtyLabel(spec)

      return (
        <button
          key={spec}
          type="button"
          aria-pressed={active}
          onClick={() => onSpecialtyChange(active ? null : spec)}
          title={`${t('roster.specTooltip', { label })}${active ? t('roster.attrTooltipActive') : ''}${!isAvailable ? t('roster.attrTooltipEmpty') : ''}`}
          className={cn(
            'relative flex size-7.5 sm:size-7 items-center justify-center rounded-lg border transition-all duration-150 cursor-pointer select-none',
            active
              ? 'border-primary/90 bg-primary/20 shadow-[0_0_10px_rgba(201,242,75,0.35)] ring-1 ring-primary/60 scale-105 z-10'
              : isAvailable
                ? 'border-transparent bg-white/[0.04] opacity-85 hover:opacity-100 hover:border-white/25 hover:bg-white/[0.1]'
                : 'border-transparent bg-transparent opacity-25 hover:opacity-50 hover:bg-white/[0.04]',
          )}
        >
          <SpecialtyBadge specialty={spec} className="size-4 pointer-events-none" />
        </button>
      )
    })
  }

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-2xl border border-white/[0.08] bg-[#111620]/90 p-2 sm:px-3 sm:py-1.5 shadow-lg backdrop-blur-xl">
      {/* 1. Top row on mobile / Left section on desktop: Title, back to teams navigation, count badge, and mobile search */}
      <div className="flex items-center justify-between gap-2 w-full md:w-auto select-none">
        <div className="flex items-center gap-2">
          {fromTeams && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/50 gap-1 rounded-xl border border-white/10 bg-black/40 hover:bg-white/[0.08] transition-all -ml-1 cursor-pointer shadow-xs"
              title={t('roster.toTeamsTitle')}
            >
              <Link to="/teams">
                <ArrowLeft className="size-3.5" />
                <span className="hidden sm:inline">{t('roster.toTeams')}</span>
              </Link>
            </Button>
          )}
          <h1 className="font-heading text-base font-bold uppercase tracking-wide text-foreground sm:text-lg flex items-center">
            {t('nav.roster')}
            {totalAgents > 0 && (
              <span
                className="ml-2.5 font-heading"
                aria-label={t('roster.buildsCount', { count: totalAgents })}
                title={t('roster.buildsCount', { count: totalAgents })}
              >
                <span className="text-primary select-none">//</span>{' '}
                <span className="text-muted-foreground">{formattedCount}</span>
              </span>
            )}
          </h1>
        </div>

        {/* Mobile Search input & Reset button placed on the top row */}
        {totalAgents > 0 && (
          <div className="flex items-center gap-1.5 md:hidden flex-1 justify-end min-w-0 max-w-[210px]">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/80" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t('roster.searchPlaceholder')}
                className="h-7.5 w-full pl-6.5 pr-6 text-xs bg-black/60 border border-white/[0.15] focus:border-primary/60 text-foreground placeholder:text-muted-foreground/60 rounded-[8px_8px_0_8px] outline-none transition-all"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title={t('roster.clearSearch')}
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {hasFilter && (
              <button
                type="button"
                onClick={handleReset}
                className="flex size-7.5 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer select-none"
                title={t('roster.resetFiltersTitle')}
              >
                <RotateCcw className="size-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 2. Mobile Filter Rows: Two distinct, clearly-labeled rows for Element and Role */}
      {totalAgents > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/[0.06] md:hidden w-full">
          {/* Row 1: Element / Attribute */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                'flex h-7 items-center justify-center rounded-lg border px-2 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0 select-none min-w-[58px] transition-colors',
                selectedAttribute
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-white/10 bg-white/[0.04] text-muted-foreground',
              )}
            >
              {t('roster.attributeFilterLabel')}
            </span>
            <div
              role="group"
              aria-label={t('roster.filterAttributes')}
              className="flex items-center gap-1 rounded-xl border border-white/[0.1] bg-black/50 p-1 shadow-inner overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0"
            >
              {renderAttributeButtons()}
            </div>
          </div>

          {/* Row 2: Role / Specialty */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={cn(
                'flex h-7 items-center justify-center rounded-lg border px-2 font-mono text-[10px] font-bold uppercase tracking-wider shrink-0 select-none min-w-[58px] transition-colors',
                selectedSpecialty
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-white/10 bg-white/[0.04] text-muted-foreground',
              )}
            >
              {t('roster.specialtyFilterLabel')}
            </span>
            <div
              role="group"
              aria-label={t('roster.filterSpecialties')}
              className="flex items-center gap-1 rounded-xl border border-white/[0.1] bg-black/50 p-1 shadow-inner overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0"
            >
              {renderSpecialtyButtons()}
            </div>
          </div>
        </div>
      )}

      {/* 3. Desktop Filter Controls: Inline row with Element capsule, Role capsule, Search, and Reset */}
      {totalAgents > 0 && (
        <div className="hidden md:flex items-center gap-2">
          {/* Desktop Element / Attribute capsule with subtle label */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'text-[10px] font-mono font-bold uppercase tracking-wider select-none transition-colors',
                selectedAttribute ? 'text-primary' : 'text-muted-foreground/70',
              )}
            >
              {t('roster.attributeFilterLabel')}:
            </span>
            <div
              role="group"
              aria-label={t('roster.filterAttributes')}
              className="flex items-center gap-1 rounded-xl border border-white/[0.1] bg-black/50 p-1 shadow-inner shrink-0"
            >
              {renderAttributeButtons()}
            </div>
          </div>

          {/* Subtle separator */}
          <div className="h-4 w-px bg-white/10 shrink-0" aria-hidden="true" />

          {/* Desktop Role / Specialty capsule with subtle label */}
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'text-[10px] font-mono font-bold uppercase tracking-wider select-none transition-colors',
                selectedSpecialty ? 'text-primary' : 'text-muted-foreground/70',
              )}
            >
              {t('roster.specialtyFilterLabel')}:
            </span>
            <div
              role="group"
              aria-label={t('roster.filterSpecialties')}
              className="flex items-center gap-1 rounded-xl border border-white/[0.1] bg-black/50 p-1 shadow-inner shrink-0"
            >
              {renderSpecialtyButtons()}
            </div>
          </div>

          {/* Desktop Search input placed after the filters */}
          <div className="relative min-w-[130px] max-w-[180px] lg:max-w-[200px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/80" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('roster.searchPlaceholder')}
              className="h-8 w-full pl-8 pr-7 text-xs bg-black/60 border border-white/[0.15] hover:border-white/[0.28] focus:border-primary/60 focus:ring-1 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground/60 rounded-[10px_10px_0_10px] transition-all outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title={t('roster.clearSearch')}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Desktop Reset all filters button */}
          {hasFilter && (
            <button
              type="button"
              onClick={handleReset}
              className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 transition-all cursor-pointer select-none"
              title={t('roster.resetFiltersTitle')}
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
