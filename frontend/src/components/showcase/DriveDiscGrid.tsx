import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatStatName, formatStatValue } from '@/lib/format'
import { resolveStatIconUrl, getSetAccentColor } from '@/lib/design-tokens'
import { calculateSubStatTotals } from '@/lib/builds'
import { RarityBadge } from '@/components/ui/rarity-badge'
import { isDiscSubStatRecommended } from '@/lib/recommendations'
import { cn } from '@/lib/utils'
import type { DriveDisc, DriveDiscSetBonus, DriveDiscs, StatValue, WEngine } from '@/types'

function StatIcon({ stat, className }: { stat: StatValue; className?: string }) {
  const iconUrl = resolveStatIconUrl(stat)
  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn('shrink-0 opacity-90 select-none pointer-events-none', className)}
      />
    )
  }
  return <span className={cn('size-1.5 shrink-0 rounded-full bg-muted-foreground/60', className)} />
}

function DiscArtwork({ disc, className }: { disc: DriveDisc; className?: string }) {
  const color = getSetAccentColor(disc.set.id)
  const setName = disc.set.name
  return (
    <span className={cn('relative block shrink-0', className)} title={setName}>
      {disc.icon_path ? (
        <img
          src={disc.icon_path}
          alt={setName}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="size-full object-contain select-none pointer-events-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]"
        />
      ) : (
        <span className="block size-full rounded-full" style={{ backgroundColor: `${color}33` }} />
      )}
    </span>
  )
}

function SubStatRow({
  stat,
  agentId,
  recommendedSubStats,
  highlightProps,
}: {
  stat: StatValue
  agentId?: number | string
  recommendedSubStats?: readonly number[] | null
  highlightProps?: readonly number[] | null
}) {
  const { t } = useTranslation()
  const upgrades = Math.max(0, stat.rolls - 1)
  const hasRolls = upgrades > 0
  const displayName = formatStatName(stat.name, stat.property_id)
  const fullStatName = stat.name || displayName
  const rollLabel = t('gear.roll', { count: stat.rolls })
  const procLabel = t('gear.proc', { count: upgrades })
  const baseLabel = t('gear.baseRoll')
  const isRecommended = isDiscSubStatRecommended(
    stat.property_id,
    agentId,
    recommendedSubStats ?? highlightProps
  )

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-1 rounded-md px-1.5 py-1 text-xs leading-tight transition-colors sm:px-2 border',
        isRecommended
          ? 'bg-amber-400/[0.06] border-amber-400/20'
          : 'bg-white/[0.04] border-transparent'
      )}
      title={`${fullStatName}: ${stat.rolls} ${rollLabel} (${baseLabel}${hasRolls ? ` + ${upgrades} ${procLabel}` : ''})`}
    >
      <span className="flex min-w-0 items-center gap-1.5 font-medium">
        <StatIcon stat={stat} className="size-3.5 shrink-0" />
        <span className="flex min-w-0 items-center gap-1">
          <span
            className={cn(
              'truncate text-xs leading-tight',
              isRecommended ? 'font-semibold text-amber-400' : 'text-foreground/90'
            )}
          >
            {displayName}
          </span>
          {hasRolls && (
            <span className="shrink-0 font-mono text-xs font-bold text-amber-400 leading-none">
              +{upgrades}
            </span>
          )}
        </span>
      </span>
      <span
        className={cn(
          'shrink-0 font-mono text-xs font-bold tabular-nums leading-none',
          isRecommended ? 'text-amber-400' : 'text-foreground'
        )}
      >
        {formatStatValue(stat)}
      </span>
    </div>
  )
}

function MainStatRow({ stat }: { stat: StatValue }) {
  const displayName = formatStatName(stat.name, stat.property_id)
  const fullStatName = stat.name || displayName

  return (
    <div
      className="flex items-center justify-between gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1 text-xs leading-tight border border-white/5 shadow-xs"
      title={`${fullStatName}: ${formatStatValue(stat)}`}
    >
      <span className="flex min-w-0 items-center gap-1.5 font-bold text-foreground">
        <StatIcon stat={stat} className="size-3.5 shrink-0" />
        <span className="truncate text-xs leading-tight">
          {displayName}
        </span>
      </span>
      <span className="shrink-0 font-mono text-xs font-black tabular-nums text-foreground tracking-tight sm:text-xs">
        {formatStatValue(stat)}
      </span>
    </div>
  )
}

export interface DiscCardProps {
  slot: number
  disc?: DriveDisc
  agentId?: number | string
  recommendedSubStats?: readonly number[] | null
  highlightProps?: readonly number[] | null
  /**
   * Heading depth for the disc set name. Kept configurable for the same reason
   * as WEngineCard: the grid sits one level below the W-Engine card, and that
   * card's own depth depends on the page it is rendered into.
   */
  headingLevel?: 3 | 4
}

export function DiscCard({
  slot,
  disc,
  agentId,
  recommendedSubStats,
  highlightProps,
  headingLevel = 4,
}: DiscCardProps) {
  const { t } = useTranslation()

  if (!disc) {
    return (
      <div className="flex h-full min-h-[170px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.1] bg-subtle/50 p-2 text-center text-muted-foreground sm:p-2.5">
        <span className="flex size-7 items-center justify-center rounded-full border border-dashed border-white/[0.15] font-mono text-xs font-bold text-muted-foreground">
          {slot}
        </span>
        <div className="mt-1 min-w-0 font-mono text-xs leading-tight text-muted-foreground">
          <p className="font-bold">{t('gear.slotNumber', { slot })}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground/60">{t('gear.slotNotEquipped')}</p>
        </div>
      </div>
    )
  }

  const setName = disc.set.name

  const HeadingTag = headingLevel === 3 ? 'h3' : 'h4'

  return (
    <div className="flex h-full min-w-0 flex-col justify-between rounded-2xl border border-white/[0.2] bg-card/90 p-2.5 sm:p-3 shadow-md transition-all">
      <div>
        {/* Disc card header: slot number, set name, rarity badge and disc art */}
        <div className="flex items-start justify-between gap-2 border-b border-white/[0.08] pb-2">
          <div className="min-w-0 flex-1 space-y-1">
            <HeadingTag
              className="truncate font-sans text-xs font-bold leading-tight tracking-tight text-foreground sm:text-sm"
              title={setName}
            >
              <span className="font-mono text-xs font-semibold text-muted-foreground mr-1">[{disc.slot}]</span>
              <span className="truncate">{setName}</span>
            </HeadingTag>

            <div className="inline-flex h-5 items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.06] pl-0.5 pr-2 shadow-xs">
              <RarityBadge rarity={disc.rarity} className="size-4 shrink-0" />
              <span className="font-mono text-[11px] font-bold tracking-tight text-foreground leading-none">
                {t('gear.discLevel', { level: disc.level })}
              </span>
            </div>
          </div>

          <div className="relative shrink-0">
            <DiscArtwork disc={disc} className="size-9 sm:size-10" />
          </div>
        </div>

        {/* Main Stat */}
        <div className="mt-1.5">
          <MainStatRow stat={disc.main_stat} />
        </div>

        {/* Sub Stats list */}
        {disc.sub_stats.length > 0 && (
          <>
            <div className="my-1.5 h-px bg-white/[0.06]" />
            <div className="space-y-1">
              {disc.sub_stats.map((sub, index) => (
                <SubStatRow
                  key={index}
                  stat={sub}
                  agentId={agentId}
                  recommendedSubStats={recommendedSubStats}
                  highlightProps={highlightProps}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function SetBonusChip({ bonus, disc }: { bonus: DriveDiscSetBonus; disc?: DriveDisc }) {
  const isFullSet = bonus.count >= 4
  const setName = bonus.set.name

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border bg-card/90 px-2 py-0.5 text-xs font-medium text-foreground shadow-xs backdrop-blur-xs transition-colors sm:px-2.5 sm:py-1',
        isFullSet
          ? 'border-primary/30 hover:border-primary/50'
          : 'border-border/80 hover:border-white/20'
      )}
      title={`${setName} (${bonus.count})`}
    >
      {disc?.icon_path ? (
        <img
          src={disc.icon_path}
          alt={setName}
          loading="lazy"
          decoding="async"
          className="size-4 shrink-0 object-contain select-none pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] sm:size-4.5"
        />
      ) : (
        <span className="size-2 shrink-0 rounded-full bg-primary/80" />
      )}
      <span className="hidden sm:inline max-w-40 truncate font-heading text-xs font-bold tracking-wide text-foreground">
        {setName}
      </span>
      <span
        className={cn(
          'font-mono text-xs shrink-0',
          isFullSet ? 'font-bold text-primary' : 'font-semibold text-primary/75',
        )}
      >
        ({bonus.count})
      </span>
    </div>
  )
}

export function SetBonusChips({
  bonuses,
  discs,
  className,
}: {
  bonuses: DriveDiscSetBonus[]
  discs: DriveDisc[]
  className?: string
}) {
  if (bonuses.length === 0) return null

  // 4-piece set is always placed first (left), followed by 2-piece sets
  const sortedBonuses = [...bonuses].sort((a, b) => b.count - a.count)

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {sortedBonuses.map((bonus) => (
        <SetBonusChip
          key={`${bonus.set.id}-${bonus.count}`}
          bonus={bonus}
          disc={discs.find((d) => d.set.id === bonus.set.id)}
        />
      ))}
    </div>
  )
}

export function SubStatTotalsBar({
  driveDiscs,
  className,
  agentId,
  recommendedSubStats,
  highlightProps,
}: {
  driveDiscs?: DriveDiscs | null
  className?: string
  agentId?: number | string
  recommendedSubStats?: readonly number[] | null
  highlightProps?: readonly number[] | null
}) {
  const { t } = useTranslation()
  const totals = useMemo(() => calculateSubStatTotals(driveDiscs), [driveDiscs])

  if (totals.length === 0) return null

  return (
    <div className={cn('flex flex-wrap items-center justify-start gap-1.5 pt-0.5', className)}>
      {totals.map((stat) => {
        const rollLabel = t('gear.roll', { count: stat.rolls })
        const displayName = formatStatName(stat.name, stat.property_id)
        const fullStatName = stat.name || displayName
        const isRecommended = isDiscSubStatRecommended(
          stat.property_id,
          agentId,
          recommendedSubStats ?? highlightProps
        )
        return (
          <div
            key={stat.property_id}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-mono shadow-2xs backdrop-blur-xs transition-colors hover:bg-accent',
              isRecommended
                ? 'border-amber-400/40 bg-amber-400/[0.08] hover:border-amber-400/60'
                : 'border-border/80 bg-card/90 hover:border-white/25'
            )}
            title={`${fullStatName}: ${formatStatValue(stat)} (${stat.rolls} ${rollLabel})`}
          >
            <StatIcon stat={stat} className="size-3.5 shrink-0" />
            <span
              className={cn(
                'font-bold tabular-nums leading-none',
                isRecommended ? 'text-amber-400' : 'text-foreground'
              )}
            >
              {formatStatValue(stat)}
            </span>
            <span
              className="shrink-0 font-mono font-bold text-amber-400 leading-none"
              title={`${stat.rolls} ${rollLabel}`}
            >
              +{stat.rolls}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export interface DriveDiscGridProps {
  driveDiscs?: DriveDiscs | null
  wEngine?: WEngine | null
  headerActions?: React.ReactNode
  className?: string
  agentId?: number | string
  recommendedSubStats?: readonly number[] | null
  highlightProps?: readonly number[] | null
  /** Forwarded to every DiscCard; see DiscCardProps.headingLevel. */
  headingLevel?: 3 | 4
}

/**
 * 2x3 Grid of Drive Discs with Set Bonuses summary bar on top.
 */
export function DriveDiscGrid({
  driveDiscs,
  headerActions,
  className,
  agentId,
  recommendedSubStats,
  highlightProps,
  headingLevel = 4,
}: DriveDiscGridProps) {
  const slotMap = useMemo(() => {
    const map = new Map<number, DriveDisc>()
    for (const disc of driveDiscs?.slots ?? []) {
      map.set(disc.slot, disc)
    }
    return map
  }, [driveDiscs?.slots])

  const ALL_SLOTS = [1, 2, 3, 4, 5, 6] as const

  return (
    <div className={cn('space-y-3', className)}>
      {/* Desktop Header Actions (e.g. Save Build button) */}
      {headerActions && (
        <div className="hidden items-center justify-end lg:flex">{headerActions}</div>
      )}

      {/* 6-Disc Grid: 1 column on mobile, 2 columns on tablet (sm+), 3 columns on desktop (lg+) */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {ALL_SLOTS.map((slot) => (
          <DiscCard
            key={slot}
            slot={slot}
            disc={slotMap.get(slot)}
            agentId={agentId}
            recommendedSubStats={recommendedSubStats}
            highlightProps={highlightProps}
            headingLevel={headingLevel}
          />
        ))}
      </div>

      {/* Aggregate Sub-Stats bar */}
      <SubStatTotalsBar
        driveDiscs={driveDiscs}
        agentId={agentId}
        recommendedSubStats={recommendedSubStats}
        highlightProps={highlightProps}
      />
    </div>
  )
}
