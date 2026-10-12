import { useTranslation } from 'react-i18next'
import { formatStatName, formatStatValue } from '@/lib/format'
import { resolveStatIconUrl, SPECIALTY_ICONS } from '@/lib/design-tokens'
import { RarityBadge } from '@/components/ui/rarity-badge'
import { cn } from '@/lib/utils'
import type { StatValue, WEngine } from '@/types'

function StatIcon({ stat, className }: { stat: StatValue; className?: string }) {
  const iconUrl = resolveStatIconUrl(stat)
  if (iconUrl) {
    return <img src={iconUrl} alt="" className={cn('shrink-0 opacity-90 select-none pointer-events-none', className)} />
  }
  return <span className={cn('size-1.5 shrink-0 rounded-full bg-muted-foreground/60', className)} />
}

interface WEngineCardProps {
  wEngine: WEngine | null
  className?: string
  /**
   * Heading depth for the W-Engine name. The card is reused under different
   * parents, so the level cannot be hardcoded: Showcase renders it under the
   * agent name (h2 -> h3) while the roster renders it under the page title
   * (h1 -> h2), and a skipped level fails the `heading-order` audit.
   */
  headingLevel?: 2 | 3
}

export function WEngineCard({ wEngine, className, headingLevel = 3 }: WEngineCardProps) {
  const { t } = useTranslation()

  if (!wEngine) {
    return (
      <div
        className={cn(
          'flex min-h-[90px] items-center justify-center rounded-2xl border-2 border-dashed border-border/40 bg-card/60 p-3 text-center text-muted-foreground shadow-sm',
          className,
        )}
      >
        <span className="font-heading text-xs font-bold uppercase tracking-wider text-muted-foreground/60">
          {t('gear.wEngineNotEquipped')}
        </span>
      </div>
    )
  }

  const modificationRank = wEngine.modification || 1

  const HeadingTag = headingLevel === 2 ? 'h2' : 'h3'

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/[0.2] bg-[#111722]/96 p-3 shadow-md backdrop-blur-sm transition-all',
        className,
      )}
    >
      {/* Header: Large Frameless Icon with Specialty Badge + Name, Level & Awakening, Rarity */}
      <div className="flex items-center gap-3 border-b border-white/[0.08] pb-2.5">
        {/* Large Frameless W-Engine Icon */}
        <div className="relative size-14 sm:size-16 shrink-0 flex items-center justify-center">
          {wEngine.icon_url ? (
            <img
              src={wEngine.icon_url}
              alt={wEngine.name}
              width={64}
              height={64}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              draggable={false}
              className="size-full object-contain select-none pointer-events-none drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
            />
          ) : (
            <div className="flex size-full items-center justify-center font-heading text-lg font-bold text-primary">
              W
            </div>
          )}
          {/* Specialty Badge over the W-Engine icon */}
          {wEngine.specialty && SPECIALTY_ICONS[wEngine.specialty] ? (
            <div
              className="absolute -bottom-1 -right-1 flex size-5 sm:size-6 items-center justify-center rounded-full bg-black/85 p-0.5 border border-white/20 shadow-md drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              title={t('gear.specialtyLabel', { name: wEngine.specialty_name || wEngine.specialty })}
            >
              <img
                src={SPECIALTY_ICONS[wEngine.specialty]}
                alt={wEngine.specialty_name || wEngine.specialty}
                loading="lazy"
                decoding="async"
                className="size-3.5 sm:size-4.5 object-contain select-none pointer-events-none drop-shadow-xs"
              />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <HeadingTag className="font-heading text-sm font-bold leading-tight text-foreground break-words" title={wEngine.name}>
            {wEngine.name}
          </HeadingTag>

          <div className="mt-1.5 flex items-center">
            <div
              className="inline-flex h-6 shrink-0 items-center gap-1.5 overflow-hidden rounded-lg border border-black bg-[#232b36] pr-2 shadow-xs"
              title={t('gear.wEngineStatsTooltip', {
                rarity: wEngine.rarity,
                level: wEngine.level,
                rank: modificationRank,
              })}
            >
              <RarityBadge rarity={wEngine.rarity} className="size-6 shrink-0" />
              <span className="font-heading text-xs font-black tracking-wide text-foreground">
                {t('gear.level', { level: wEngine.level })}
              </span>
              <span className="font-mono text-xs font-bold text-muted-foreground/60">·</span>
              <span className="font-heading text-xs font-black text-foreground">
                P{modificationRank}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats (side-by-side on mobile, stacked on desktop sidebar) */}
      <div className="mt-2 grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-1 gap-1.5">
        {wEngine.main_stat && (
          <div className="flex items-center justify-between gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs leading-tight">
            <span className="flex min-w-0 items-center gap-1.5 font-semibold text-foreground">
              <StatIcon stat={wEngine.main_stat} className="size-3.5 shrink-0" />
              <span className="truncate">{formatStatName(wEngine.main_stat.name, wEngine.main_stat.property_id)}</span>
            </span>
            <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-foreground">
              {formatStatValue(wEngine.main_stat)}
            </span>
          </div>
        )}

        {wEngine.secondary_stat && (
          <div className="flex items-center justify-between gap-1.5 rounded-lg bg-white/[0.04] px-2.5 py-1 text-xs leading-tight">
            <span className="flex min-w-0 items-center gap-1.5 font-medium text-foreground/90">
              <StatIcon stat={wEngine.secondary_stat} className="size-3.5 shrink-0" />
              <span className="truncate">{formatStatName(wEngine.secondary_stat.name, wEngine.secondary_stat.property_id)}</span>
            </span>
            <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-foreground">
              {formatStatValue(wEngine.secondary_stat)}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
