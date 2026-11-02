import { useTranslation } from 'react-i18next'
import { ExternalLink, Clock, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  formatFaePercentile,
  formatFaeRank,
  getZfaeUrl,
  resolveFaeBadgeState,
} from '@/lib/fae'
import type { FaeRating } from '@/types'

export interface FaeBadgeProps {
  isLoading?: boolean
  rating?: FaeRating | null
  uid?: string
  showUnassessed?: boolean
  className?: string
}

export function FaeTooltipContent({
  rating,
  isOutdated,
  dateStr,
}: {
  rating: FaeRating
  isOutdated: boolean
  dateStr: string | null
}) {
  const { t } = useTranslation()

  return (
    <div data-testid="fae-tooltip-content" className="space-y-2">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-foreground">
            {rating.bracket_name || 'ZFAE Leaderboard'}
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider',
              isOutdated
                ? 'bg-amber-500/20 text-amber-300'
                : 'bg-emerald-500/20 text-emerald-300',
            )}
          >
            {isOutdated ? 'Snapshot' : 'Live'}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          {isOutdated
            ? t('fae.outdatedStatus', { date: dateStr ?? '' })
            : t('fae.liveStatus')}
        </p>
      </div>

      {rating.breakdown && (
        <div className="border-t border-white/10 pt-2 space-y-1 text-[11px]">
          {rating.breakdown.weapon_percent != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t('fae.weaponChoice')}</span>
              <span className="font-mono font-medium text-foreground">
                {`${rating.breakdown.weapon_percent}%`}
              </span>
            </div>
          )}
          {rating.breakdown.disc_set_percent != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t('fae.discSets')}</span>
              <span className="font-mono font-medium text-foreground">
                {`${rating.breakdown.disc_set_percent}%`}
              </span>
            </div>
          )}
          {rating.breakdown.mainstat_percent != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t('fae.mainstats')}</span>
              <span className="font-mono font-medium text-foreground">
                {`${rating.breakdown.mainstat_percent}%`}
              </span>
            </div>
          )}
          {rating.breakdown.substat_percent != null && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t('fae.substats')}</span>
              <span className="font-mono font-medium text-foreground">
                {`${rating.breakdown.substat_percent}%`}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="border-t border-white/10 pt-1.5 flex items-center justify-between text-[10px] text-muted-foreground/80">
        <span>{t('fae.openProfile')}</span>
        <ExternalLink className="size-2.5" />
      </div>
    </div>
  )
}

export function FaeBadge({
  isLoading,
  rating,
  uid,
  showUnassessed = false,
  className,
}: FaeBadgeProps) {
  const { t } = useTranslation()
  const state = resolveFaeBadgeState(isLoading, rating, uid, showUnassessed)

  switch (state.kind) {
    case 'loading': {
      return (
        <div
          data-testid="fae-badge-loading"
          className={cn(
            'inline-flex h-7 w-32 animate-pulse items-center rounded-md border border-white/10 bg-white/5 px-2.5 py-1',
            className,
          )}
        />
      )
    }

    case 'unassessed': {
      if (!state.showUnassessed) {
        return null
      }
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                data-testid="fae-badge-unassessed"
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-muted-foreground select-none',
                  className,
                )}
              >
                <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                <span>{t('fae.unassessed')}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{t('fae.unassessedHint')}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    case 'live':
    case 'snapshot_outdated': {
      const isOutdated = state.kind === 'snapshot_outdated'
      const r = state.rating
      const rankText = r.rank != null ? formatFaeRank(r.rank, r.rank_of) : null
      const percentileText =
        r.top_percentile != null ? formatFaePercentile(r.top_percentile) : null
      const scoreText = r.score != null ? r.score.toFixed(1) : null
      const url = getZfaeUrl(state.uid, r.slug)
      const dateStr = r.time_assessed
        ? new Date(r.time_assessed * 1000).toLocaleDateString()
        : null

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid={isOutdated ? 'fae-badge-outdated' : 'fae-badge-live'}
                className={cn(
                  'group inline-flex h-7 items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isOutdated
                    ? 'border-white/15 bg-white/[0.04] text-foreground/80 hover:border-amber-400/40 hover:bg-white/[0.07]'
                    : 'border-amber-400/40 bg-amber-400/10 text-amber-200 hover:border-amber-400/70 hover:bg-amber-400/15',
                  className,
                )}
              >
                {isOutdated ? (
                  <Clock className="size-3.5 shrink-0 text-amber-400/70" />
                ) : (
                  <Trophy className="size-3.5 shrink-0 text-amber-400" />
                )}

                {percentileText && (
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
                      isOutdated
                        ? 'bg-white/10 text-foreground/90'
                        : 'bg-amber-400/25 text-amber-300 font-semibold',
                    )}
                  >
                    {`${t('fae.topPrefix')} ${percentileText}`}
                  </span>
                )}

                {rankText && (
                  <span className="font-mono tabular-nums text-foreground/90">
                    {rankText}
                  </span>
                )}

                {scoreText && (
                  <span
                    className={cn(
                      'font-mono tabular-nums font-semibold',
                      isOutdated ? 'text-foreground/70' : 'text-amber-300',
                    )}
                  >
                    {scoreText}
                  </span>
                )}

                <ExternalLink className="size-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-100" />
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs space-y-2 p-3">
              <FaeTooltipContent
                rating={r}
                isOutdated={isOutdated}
                dateStr={dateStr}
              />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}
