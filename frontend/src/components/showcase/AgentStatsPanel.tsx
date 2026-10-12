import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { formatStatName } from '@/lib/format'
import { resolveStatIconUrl } from '@/lib/design-tokens'
import { isHighlightProp } from '@/lib/recommendations'
import type { FormattedStatBreakdown, Specialty, UIStats } from '@/types'

function StatRow({
  stat,
  isRecommended,
}: {
  stat: FormattedStatBreakdown
  isRecommended?: boolean
}) {
  const { t } = useTranslation()
  const iconUrl = resolveStatIconUrl(stat)
  const displayName = formatStatName(stat.name, stat.property_id)
  const fullStatName = stat.name || displayName

  return (
    <div
      className="flex min-w-0 items-center justify-between gap-2 rounded bg-white/[0.04] px-2.5 py-1 text-xs leading-tight"
      title={t('gear.statTooltip', {
        name: fullStatName,
        total: stat.total,
        base: stat.base,
        added: stat.added,
      })}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-foreground/90">
        {iconUrl ? (
          <img
            src={iconUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className={cn(
              'size-3.5 shrink-0 select-none pointer-events-none',
              isRecommended ? 'opacity-100' : 'opacity-85',
            )}
          />
        ) : (
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              isRecommended ? 'bg-amber-400' : 'bg-primary/60',
            )}
          />
        )}
        <span
          className={cn(
            'truncate text-xs font-medium',
            isRecommended ? 'text-amber-400 font-semibold' : 'text-muted-foreground',
          )}
        >
          {displayName}
        </span>
      </div>

      <span
        className={cn(
          'shrink-0 font-mono text-xs tabular-nums',
          isRecommended ? 'font-bold text-amber-400' : 'font-bold text-foreground',
        )}
      >
        {stat.total}
      </span>
    </div>
  )
}

export interface AgentStatsPanelProps {
  uiStats?: UIStats | null
  specialty?: Specialty | string
  agentId?: number | string
  highlightProps?: readonly number[] | null
  /** Show only the most important rows for the mobile overview. */
  compact?: boolean
  className?: string
}

export function AgentStatsPanel({
  uiStats,
  specialty,
  agentId,
  highlightProps,
  compact = false,
  className,
}: AgentStatsPanelProps) {
  const { t } = useTranslation()

  const statList = useMemo(() => {
    if (!uiStats) return []

    const isValid = (stat?: FormattedStatBreakdown): stat is FormattedStatBreakdown =>
      Boolean(stat && stat.property_id !== 0 && stat.name && stat.name.trim() !== '')

    const list: FormattedStatBreakdown[] = []

    if (isValid(uiStats.hp)) list.push(uiStats.hp)
    if (isValid(uiStats.atk)) list.push(uiStats.atk)
    if (isValid(uiStats.def)) list.push(uiStats.def)
    if (isValid(uiStats.impact)) list.push(uiStats.impact)
    if (isValid(uiStats.crit_rate)) list.push(uiStats.crit_rate)
    if (isValid(uiStats.crit_dmg)) list.push(uiStats.crit_dmg)
    if (isValid(uiStats.sharp_crit_dmg) && uiStats.sharp_crit_dmg.total !== '0.0%') {
      list.push(uiStats.sharp_crit_dmg)
    }
    if (isValid(uiStats.anomaly_mastery)) list.push(uiStats.anomaly_mastery)
    if (isValid(uiStats.anomaly_proficiency)) list.push(uiStats.anomaly_proficiency)
    if (isValid(uiStats.pen_ratio)) list.push(uiStats.pen_ratio)
    if (isValid(uiStats.pen_flat)) list.push(uiStats.pen_flat)

    // Hide EnergyRegen / Automatic Sharpness Accumulation when 0.00 / 0 (unused)
    if (isValid(uiStats.energy_regen) && uiStats.energy_regen.total !== '0.00' && uiStats.energy_regen.total !== '0') {
      list.push(uiStats.energy_regen)
    }

    // Skip Lumiflux / invalid damage bonus (u.AttributeDMGBonus.PropertyID != 0 && u.AttributeDMGBonus.Name != "")
    if (isValid(uiStats.attribute_dmg_bonus)) {
      list.push(uiStats.attribute_dmg_bonus)
    }

    // Sheer Force is only shown for Rupture agents
    if (specialty === 'Rupture' && isValid(uiStats.sheer_force) && uiStats.sheer_force.total !== '0') {
      list.push(uiStats.sheer_force)
    }

    return list
  }, [uiStats, specialty])

  const visibleStatList = compact ? statList.slice(0, 4) : statList
  const hiddenStatCount = statList.length - visibleStatList.length

  return (
    <div
      className={cn(
        'rounded-2xl border border-white/[0.2] bg-card/96 p-3 shadow-md backdrop-blur-sm transition-all',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2 border-b border-white/[0.08] pb-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {compact ? t('gear.keyStatsTitle') : t('gear.statsTitle')}
        </span>
        {compact && hiddenStatCount > 0 && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">
            {t('gear.moreStats', { count: hiddenStatCount })}
          </span>
        )}
      </div>

      {/* Single-column stats list */}
      {visibleStatList.length === 0 ? (
        <div className="py-2.5 text-center text-xs text-muted-foreground/60 italic">
          {t('gear.noStats')}
        </div>
      ) : (
        <div className="space-y-1">
          {visibleStatList.map((stat) => (
            <StatRow
              key={stat.property_id || stat.name}
              stat={stat}
              isRecommended={isHighlightProp(stat.property_id, agentId, highlightProps)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
