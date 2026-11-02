import { useTranslation } from 'react-i18next'
import { ExternalLink, Clock, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  formatFaePercentile,
  formatFaeRankParts,
  getZfaeUrl,
  resolveFaeBadgeState,
} from '@/lib/fae'
import type { FaeRating } from '@/types'

function FaeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 3.8 103.4 20.6" role="img" aria-label="FAE" className={cn('shrink-0 fill-current', className)}>
      <path d="M86.9177029 15.4248221h15.2103891l.0052-.0603707c.017975-.2111536.076396-.9187835.076396-1.1967328 0-5.43950894-4.4254117-9.86600274-9.864574-9.86600274-5.4393278 0-9.86474 4.4255669-9.86474 9.86600274 0 5.4403366 4.4005856 9.7631504 9.86474 9.7631504 2.4066696 0 4.3722464-.7809445 5.8864482-1.9039175 1.9235703-1.4265717 3.1187138-3.4051075 3.5643508-5.0357901h-4.6364378l-2.0236474 2.0777019c-.7224693.4402313-1.6483699.7750539-2.7935275.7750539-2.5617671 0-4.8381947-1.8562758-5.4245974-4.4190951m5.4274111-7.03795865c2.4563371 0 4.5886053 1.62230069 5.3190018 4.04017655H87.0259466c.7275829-2.41787586 2.8610096-4.04017655 5.3191674-4.04017655M61.1429281 14.1677186c0-5.38354757 4.4254122-9.86600274 9.8645745-9.86600274 5.4393278 0 9.86474 4.59992276 9.86474 9.81369934v9.3265158h-3.8299064v-3.1125517l-.2788848-.0734896c-.6744541 1.6535172-3.1178814 3.6749793-5.9155007 3.6749793-5.4383347 0-9.7050226-4.3795862-9.7050226-9.7631504m9.8645745-5.78085515c-3.0718696 0-5.5722325 2.57935448-5.5722325 5.75056555 0 3.171211 2.4993698 5.7074813 5.5722325 5.7074813 3.0730282 0 5.572398-2.5601213 5.572398-5.7074813 0-3.14734348-2.4993698-5.75056555-5.572398-5.75056555M47.0664837 23.441931V4.57296552h12.91701v3.41920851h-8.9912521V12.779066h7.7248785v3.4192085h-7.7248785v7.2436565zM19.9992752 4.44230605c10.49301 0 18.9992753 8.50640155 18.9992753 18.99957685h-5.0745874c-.0007378-1.1899047-.1552096-2.3992958-.4778071-3.6032461-.6793836-2.5354939-2.0165949-4.7190544-3.7788057-6.416258L28.436818 8.8273285l-4.5971724 1.23117379c-2.3502156-.67681886-4.9088899-.74279909-7.4434512-.06366543-2.5345613.67913367-4.7174481 2.01561134-6.41438516 3.77686154l-4.59678679 1.2324764 1.23178475 4.5945784c-.35581854 1.2346595-.54304895 2.5268806-.54221973 3.8429378L1 23.4418829C1 12.9487076 9.50626526 4.44230605 19.9992752 4.44230605m-2.5736291 9.39449675c5.3046479-1.4213762 10.7571678 1.7266377 12.1785439 7.0312856.2304447.8600312.3407809 1.7239492.3412909 2.5739449l-2.985588-.0003157c0-3.844243-3.1163747-6.960754-6.9606177-6.960754s-6.9606176 3.116511-6.9606176 6.960754l-2.98558987-.0003157c-.00263397-4.3927533 2.92796147-8.4136676 7.37257837-9.6045991" />
    </svg>
  )
}

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

  const rankParts = rating.rank != null ? formatFaeRankParts(rating.rank, rating.rank_of) : null
  const percentileText =
    rating.top_percentile != null ? formatFaePercentile(rating.top_percentile) : null
  const scoreText = rating.score != null ? rating.score.toFixed(1) : null
  const breakdownRows = [
    { label: t('fae.weaponChoice'), value: rating.breakdown?.weapon_percent },
    { label: t('fae.discSets'), value: rating.breakdown?.disc_set_percent },
    { label: t('fae.mainstats'), value: rating.breakdown?.mainstat_percent },
    { label: t('fae.substats'), value: rating.breakdown?.substat_percent },
  ].filter((row) => row.value != null)

  return (
    <div data-testid="fae-tooltip-content" className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 pr-8">
        <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-linear-to-r from-[#24208C] via-[#363ED9] to-[#636AF2] px-2.5 py-1.5 text-white">
          <FaeLogo className="w-20" />
          <span className="inline-flex h-5 items-center rounded-full border border-white/65 px-1.5 font-tech text-[13px] font-bold leading-none tracking-wide">V1</span>
        </span>
        {isOutdated && (
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
            <Clock className="size-3 shrink-0" aria-hidden="true" />
            {t('fae.savedRating')}
          </span>
        )}
      </div>

      <dl className={cn(
        'mt-5 grid min-w-0 gap-x-4',
        scoreText != null && 'grid-cols-[minmax(0,1fr)_auto]',
      )}>
        <div className="min-w-0">
          <dt className="text-xs text-muted-foreground">{t('fae.rankLabel')}</dt>
          <dd className="mt-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 tabular-nums">
              <span className="break-all font-tech text-[28px] font-semibold leading-tight tracking-tight">
                {rankParts?.rank ?? '—'}
              </span>
              {rankParts?.total && (
                <span className="break-all font-tech text-sm text-muted-foreground">
                  / {rankParts.total}
                </span>
              )}
            </div>
          </dd>
        </div>
        {scoreText != null && (
          <div className="min-w-0 text-right">
            <dt className="text-xs text-muted-foreground">{t('fae.scoreLabel')}</dt>
            <dd className="mt-1 break-all font-tech text-[28px] font-medium leading-tight tracking-tight tabular-nums">{scoreText}</dd>
          </div>
        )}
      </dl>
      {percentileText && (
        <div className="mt-2">
          <span className="rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-violet-800 dark:text-violet-300">
            {`${t('fae.topPrefix')} ${percentileText}`}
          </span>
        </div>
      )}

      {breakdownRows.length > 0 && (
        <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
          {breakdownRows.map((row) => (
            <div key={row.label}>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="min-w-0 break-words text-muted-foreground">{row.label}</dt>
                <dd className="shrink-0 font-medium tabular-nums">{`${row.value}%`}</dd>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-violet-500/10" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-violet-500/70 dark:bg-violet-400/80"
                  style={{ width: `${Math.min(100, Math.max(0, row.value ?? 0))}%` }}
                />
              </div>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        {isOutdated
          ? dateStr ? t('fae.outdatedStatus', { date: dateStr }) : t('fae.outdatedStatusNoDate')
          : t('fae.liveStatus')}
      </p>
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
            'inline-flex h-7.5 w-32 animate-pulse sm:h-8 items-center rounded-lg border border-border bg-muted/40 px-3 py-1',
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
                  'inline-flex h-7.5 items-center gap-1.5 rounded-lg sm:h-8 border border-border bg-muted/30 px-3 py-1 text-xs text-muted-foreground select-none',
                  className,
                )}
              >
                <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                <span className="font-heading text-[10px] font-bold uppercase tracking-wider text-muted-foreground/75">
                  FAE
                </span>
                <span className="h-3.5 w-px shrink-0 bg-border" aria-hidden="true" />
                <span className="text-[11px]">{t('fae.unassessed')}</span>
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
      const rankParts = r.rank != null ? formatFaeRankParts(r.rank, r.rank_of) : null
      const percentileText =
        r.top_percentile != null ? formatFaePercentile(r.top_percentile) : null
      const url = getZfaeUrl(state.uid, r.slug)
      const dateStr = r.time_assessed
        ? new Date(r.time_assessed * 1000).toLocaleDateString()
        : null

      return (
        <Dialog>
          <DialogTrigger asChild>
            <button
              type="button"
              data-testid={isOutdated ? 'fae-badge-outdated' : 'fae-badge-live'}
              className={cn(
                'inline-flex h-8 min-w-0 max-w-full cursor-pointer items-center overflow-hidden rounded-lg border border-border bg-card pr-2 text-left text-foreground transition-colors hover:border-[#636AF2] hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#636AF2] focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
                className,
              )}
            >
              <span className="flex shrink-0 self-stretch items-center rounded-l-[7px] bg-linear-to-r from-[#24208C] via-[#363ED9] to-[#636AF2] px-2 text-white">
                <FaeLogo className="w-13" />
              </span>
              <span className="ml-1.5 min-w-0 truncate font-tech text-[15px] font-semibold leading-none tabular-nums">{rankParts?.rank}</span>
              {percentileText && <span className="ml-2 shrink-0 text-[11px] leading-none text-muted-foreground">{`${t('fae.topPrefix')} ${percentileText}`}</span>}
              {isOutdated ? (
                <Clock className="ml-auto box-content size-3 shrink-0 pl-2 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              ) : (
                <ChevronRight className="ml-auto box-content size-3 shrink-0 pl-2 text-muted-foreground" aria-hidden="true" />
              )}
            </button>
          </DialogTrigger>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground sm:max-w-[420px] sm:p-6">
            <DialogTitle className="sr-only">FAE</DialogTitle>
            <DialogDescription className="sr-only">{r.bracket_name || 'ZFAE Leaderboard'}</DialogDescription>
            <FaeTooltipContent rating={r} isOutdated={isOutdated} dateStr={dateStr} />
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              {t('fae.openProfile')} <ExternalLink className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          </DialogContent>
        </Dialog>
      )
    }

    default: {
      const _exhaustive: never = state
      return _exhaustive
    }
  }
}
