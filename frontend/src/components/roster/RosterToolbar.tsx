import { useMemo, useState } from 'react'
import { ArrowLeft, Check, Globe, Lock, RotateCcw, Search, Share2, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { createRosterShare, revokeRosterShare } from '@/api/client'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/sonner'
import { AttributeBadge, SpecialtyBadge } from '@/components/ui/game-badge'
import { RevokeShareDialog } from './RevokeShareDialog'
import { useShareStatus } from './useShareStatus'
import {
  ALL_ATTRIBUTES,
  ALL_SPECIALTIES,
  getAttributeLabel,
  getSpecialtyLabel,
} from '@/lib/design-tokens'
import { cn } from '@/lib/utils'
import type { Attribute, GameAccount, Specialty } from '@/types'

/**
 * Uniform neutral active styling for roster filter items (attributes and specialties).
 * Calm surface highlight with subtle border and zero neon glowing halos or scale disruption.
 */
const FILTER_ITEM_ACTIVE_CLASS =
  'border-white/40 bg-white/20 text-white opacity-100 shadow-xs z-10 hover:bg-white/25 hover:border-white/50'


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
  rosterAttributes?: Set<Attribute>
  rosterSpecialties?: Set<Specialty>
  fromTeams?: boolean
  onResetFilters?: () => void
  activeAccount?: GameAccount | null
  isPublicRoster?: boolean
  onTogglePublicRoster?: () => void
  isUpdatingVisibility?: boolean
  title?: string
  hideTitle?: boolean
}

/**
 * Roster filtering toolbar:
 * - Title & back-to-teams link
 * - Search input
 * - Attribute capsule (standard combat attributes)
 * - Specialty capsule (standard combat specialties)
 * - Reset active filters button
 *
 * Mobile layout ergonomics:
 * - Dedicated rows for Attribute and Specialty filters so both are instantly visible
 *   without requiring horizontal scrolling or hiding specialties behind attributes.
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
  rosterAttributes,
  rosterSpecialties,
  fromTeams,
  onResetFilters,
  activeAccount,
  isPublicRoster,
  onTogglePublicRoster,
  isUpdatingVisibility,
  title,
  hideTitle,
}: RosterToolbarProps) {
  const { t } = useTranslation()
  const formattedCount = String(totalAgents).padStart(2, '0')
  const hasFilter = Boolean(search || selectedAttribute || selectedSpecialty)
  const [rosterLinkCopied, setRosterLinkCopied] = useState(false)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const shareStatus = useShareStatus('roster', activeAccount?.id)

  async function handleCopyRosterLink() {
    if (!activeAccount?.id) return
    try {
      const { token } = await createRosterShare(activeAccount.id)
      shareStatus.setActive(true)
      const url = `${window.location.origin}/shared/roster/${encodeURIComponent(token)}`
      await navigator.clipboard.writeText(url)
      setRosterLinkCopied(true)
      setTimeout(() => setRosterLinkCopied(false), 2000)
      toast.success(t('sharing.linkCopied'))
    } catch {
      toast.error(t('sharing.copyError'))
    }
  }

  async function handleRevokeRosterLink() {
    if (!activeAccount?.id) return
    try {
      await revokeRosterShare(activeAccount.id)
      shareStatus.setActive(false)
      toast.success(t('sharing.revoked'))
    } catch {
      toast.error(t('sharing.revokeError'))
    }
  }

  function handleReset() {
    if (onResetFilters) {
      onResetFilters()
      return
    }
    onSearchChange('')
    onAttributeChange(null)
    onSpecialtyChange(null)
  }

  // Display released game attributes plus any custom attribute present in roster
  const attributesList = useMemo(() => {
    const baseSet = rosterAttributes ?? availableAttributes
    if (!baseSet || baseSet.size === 0) {
      return STANDARD_ATTRIBUTES
    }
    return ALL_ATTRIBUTES.filter(
      (attr) => STANDARD_ATTRIBUTES.includes(attr) || baseSet.has(attr),
    )
  }, [rosterAttributes, availableAttributes])

  // Display released game specialties plus any present in roster
  const specialtiesList = useMemo(() => {
    const baseSet = rosterSpecialties ?? availableSpecialties
    if (!baseSet || baseSet.size === 0) {
      return STANDARD_SPECIALTIES
    }
    return ALL_SPECIALTIES.filter(
      (spec) => STANDARD_SPECIALTIES.includes(spec) || baseSet.has(spec),
    )
  }, [rosterSpecialties, availableSpecialties])

  function renderAttributeButtons() {
    return attributesList.map((attr) => {
      const active = selectedAttribute === attr
      const isAvailable = availableAttributes ? availableAttributes.has(attr) : true
      const isDisabled = !isAvailable && !active
      const label = getAttributeLabel(attr)

      return (
        <button
          key={attr}
          type="button"
          aria-pressed={active}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          onClick={isDisabled ? undefined : () => onAttributeChange(active ? null : attr)}
          title={`${t('roster.attrTooltip', { label })}${active ? t('roster.attrTooltipActive') : ''}${!isAvailable ? t('roster.attrTooltipEmpty') : ''}`}
          className={cn(
            'relative flex size-7.5 sm:size-7 items-center justify-center rounded-lg border transition-all duration-150 select-none',
            active
              ? FILTER_ITEM_ACTIVE_CLASS
              : isAvailable
                ? 'cursor-pointer border-transparent bg-white/[0.04] opacity-85 hover:opacity-100 hover:border-white/25 hover:bg-white/[0.1]'
                : 'cursor-not-allowed border-transparent bg-transparent opacity-20',
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
      const isDisabled = !isAvailable && !active
      const label = getSpecialtyLabel(spec)

      return (
        <button
          key={spec}
          type="button"
          aria-pressed={active}
          disabled={isDisabled}
          aria-disabled={isDisabled}
          onClick={isDisabled ? undefined : () => onSpecialtyChange(active ? null : spec)}
          title={`${t('roster.specTooltip', { label })}${active ? t('roster.attrTooltipActive') : ''}${!isAvailable ? t('roster.attrTooltipEmpty') : ''}`}
          className={cn(
            'relative flex size-7.5 sm:size-7 items-center justify-center rounded-lg border transition-all duration-150 select-none',
            active
              ? FILTER_ITEM_ACTIVE_CLASS
              : isAvailable
                ? 'cursor-pointer border-transparent bg-white/[0.04] opacity-85 hover:opacity-100 hover:border-white/25 hover:bg-white/[0.1]'
                : 'cursor-not-allowed border-transparent bg-transparent opacity-20',
          )}
        >
          <SpecialtyBadge specialty={spec} className="size-4 pointer-events-none" />
        </button>
      )
    })
  }

  const hasLeftSection = Boolean(fromTeams || !hideTitle || activeAccount)

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 rounded-2xl border border-white/[0.08] bg-card/90 p-2 sm:px-3 sm:py-1.5 shadow-lg backdrop-blur-xl">
      {/* 1. Top row on mobile / Left section on desktop: Title, back to teams navigation, count badge, and mobile search */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 select-none',
          hideTitle && !fromTeams && !activeAccount ? 'w-full md:hidden' : 'w-full md:w-auto',
        )}
      >
        {hasLeftSection && (
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
            {!hideTitle && (
              <h1 className="font-heading text-base font-bold uppercase tracking-wide text-foreground sm:text-lg flex items-center">
                {title ?? t('nav.roster')}
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
            )}

            {activeAccount && (
              <DropdownMenu onOpenChange={(open) => { if (open) shareStatus.refresh() }}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={isPublicRoster ? t('roster.statusPublic') : t('roster.statusPrivate')}
                    title={isPublicRoster ? t('roster.statusPublic') : t('roster.statusPrivate')}
                    className="relative size-7.5 shrink-0 rounded-xl text-muted-foreground hover:bg-white/[0.08] hover:text-foreground cursor-pointer"
                  >
                    <Share2 className="size-3.5" />
                    {isPublicRoster && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)] p-2">
                  <DropdownMenuItem
                    className="min-h-9 gap-2.5 px-2.5 py-1.5"
                    role="menuitemcheckbox"
                    aria-checked={isPublicRoster}
                    disabled={isUpdatingVisibility}
                    onSelect={onTogglePublicRoster}
                  >
                    {isPublicRoster ? <Globe className="size-4 text-primary" /> : <Lock className="size-4 text-muted-foreground" />}
                    {isPublicRoster ? t('roster.statusPublic') : t('roster.statusPrivate')}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="min-h-9 gap-2.5 px-2.5 py-1.5" onSelect={handleCopyRosterLink}>
                    {rosterLinkCopied ? <Check className="size-4 text-primary" /> : <Share2 className="size-4" />}
                    {t('roster.copyPublicLink')}
                  </DropdownMenuItem>
                  <DropdownMenuLabel className="mt-1 border-t border-white/10 px-2.5 pt-2 pb-1">{t(`sharing.linkStatus_${shareStatus.status}`)}</DropdownMenuLabel>
                  <DropdownMenuItem className="min-h-9 gap-2.5 px-2.5 py-1.5" disabled={shareStatus.status === 'inactive'} onSelect={() => setRevokeDialogOpen(true)}>
                    <Lock className="size-4" />
                    {t('sharing.revokeLink')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}

        {/* Mobile Search input & Reset button placed on the top row */}
        {totalAgents > 0 && (
          <div
            className={cn(
              'flex items-center gap-1.5 md:hidden flex-1 min-w-0',
              hideTitle ? 'w-full' : 'justify-end max-w-[210px]',
            )}
          >
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

      {/* 2. Mobile Filter Rows: Two distinct rows for Attribute and Specialty without text labels */}
      {totalAgents > 0 && (
        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/[0.06] md:hidden w-full">
          {/* Row 1: Attribute capsule */}
          <div
            role="group"
            aria-label={t('roster.filterAttributes')}
            className="flex items-center gap-1 rounded-xl border border-white/[0.1] bg-black/50 p-1 shadow-inner overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full"
          >
            {renderAttributeButtons()}
          </div>

          {/* Row 2: Specialty capsule */}
          <div
            role="group"
            aria-label={t('roster.filterSpecialties')}
            className="flex items-center gap-1 rounded-xl border border-white/[0.1] bg-black/50 p-1 shadow-inner overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full"
          >
            {renderSpecialtyButtons()}
          </div>
        </div>
      )}

      {/* 3. Desktop Filter Controls: Inline row with Attribute capsule, Specialty capsule, Search, and Reset */}
      {totalAgents > 0 && (
        <div
          className={cn(
            'hidden md:flex items-center gap-2',
            hideTitle ? 'w-full justify-between' : '',
          )}
        >
          <div className="flex items-center gap-2">
            {/* Desktop Attribute capsule */}
            <div
              role="group"
              aria-label={t('roster.filterAttributes')}
              className="flex items-center gap-1 rounded-xl border border-white/[0.1] bg-black/50 p-1 shadow-inner shrink-0"
            >
              {renderAttributeButtons()}
            </div>

            {/* Subtle separator */}
            <div className="h-4 w-px bg-white/10 shrink-0" aria-hidden="true" />

            {/* Desktop Specialty capsule */}
            <div
              role="group"
              aria-label={t('roster.filterSpecialties')}
              className="flex items-center gap-1 rounded-xl border border-white/[0.1] bg-black/50 p-1 shadow-inner shrink-0"
            >
              {renderSpecialtyButtons()}
            </div>
          </div>

          <div className="flex items-center gap-2">
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
        </div>
      )}
      <RevokeShareDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen} onConfirm={handleRevokeRosterLink} />
    </div>
  )
}
