import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ExternalLink, ChevronRight, RefreshCw } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
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
  action?: ReactNode
  details?: ReactNode
}

export function FaeTooltipContent({
  rating,
  dateStr,
  uid,
}: {
  rating: FaeRating
  dateStr: string | null
  uid?: string
}) {
  const { t } = useTranslation()
  const isOutdated = rating.status === 'snapshot_outdated' || rating.outdated

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
      <div className="mt-4 rounded-lg border border-[#636af2]/20 bg-[#636af2]/[0.05] p-3">
        <p className={cn('text-xs font-medium text-foreground', isOutdated && 'text-violet-700 dark:text-violet-300')}>
          {t(isOutdated ? 'fae.outdatedRatingTitle' : 'fae.ratingInfoTitle')}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {t(isOutdated ? 'fae.outdatedRatingDescription' : 'fae.ratingInfoDescription')}
        </p>
        {isOutdated && (
          <details className="group mt-3">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-xs font-medium text-violet-700 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#636AF2] focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:text-violet-300 dark:hover:text-violet-200 [&::-webkit-details-marker]:hidden">
              <ChevronRight className="size-3 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
              {t('fae.howToUpdate')}
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground marker:font-medium">
              <li className="pl-1">{t('fae.updateGuideEquip')}</li>
              <li className="pl-1">
                {t('fae.updateGuideRefreshBefore')}{' '}
                <span role="img" aria-label={t('fae.refreshRating')} className="inline-flex align-middle text-violet-700 dark:text-violet-300">
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                </span>{' '}
                {t('fae.updateGuideRefreshAfter')}
              </li>
            </ol>
            <a
              href={uid ? `/showcase?uid=${encodeURIComponent(uid)}` : '/showcase'}
              className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-md border border-[#636AF2]/30 bg-[#636AF2]/10 px-2.5 py-1.5 text-xs font-medium text-violet-700 hover:bg-[#636AF2]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#636AF2] focus-visible:ring-offset-2 focus-visible:ring-offset-card dark:text-violet-300"
            >
              {t('fae.updateGuideOpenShowcase')}
              <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
            </a>
          </details>
        )}
        <p className="mt-3 border-t border-border pt-2.5 text-[11px] text-muted-foreground">
          {dateStr ? t('fae.observedAt', { date: dateStr }) : t('fae.observedUnknown')}
        </p>
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
  action,
  details,
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
        <Dialog>
          <div data-testid={action ? 'fae-refresh-control' : undefined} className={cn('inline-flex h-8 min-w-0 max-w-full items-stretch rounded-lg border border-border bg-card text-foreground', className)}>
            <DialogTrigger asChild>
              <button
                type="button"
                data-testid="fae-badge-unassessed"
                className="inline-flex min-w-0 flex-1 cursor-pointer items-center overflow-hidden rounded-[7px] pr-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#636AF2] focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
              >
                <span className="flex shrink-0 self-stretch items-center rounded-l-[7px] bg-linear-to-r from-[#24208C] via-[#363ED9] to-[#636AF2] px-2 text-white">
                  <FaeLogo className="w-13" />
                </span>
                <span className="ml-2 min-w-0 truncate text-xs font-medium text-muted-foreground">{t('fae.unassessed')}</span>
              </button>
            </DialogTrigger>
            {action}
          </div>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground sm:max-w-[420px] sm:p-6">
            <DialogTitle className="pr-8 text-lg font-semibold">{t('fae.guideTitle')}</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed">{t('fae.guideDescription')}</DialogDescription>
            <ol className="mt-5 list-decimal space-y-3 pl-5 text-sm leading-relaxed marker:font-semibold marker:text-muted-foreground">
              <li className="pl-1">{t('fae.guideEquip')}</li>
              <li className="pl-1">
                <Link
                  to={uid ? `/showcase?uid=${encodeURIComponent(uid)}` : '/showcase'}
                  className="inline-flex items-center gap-1 rounded-sm font-medium text-violet-700 underline underline-offset-4 hover:text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-violet-300 dark:hover:text-violet-200"
                >
                  {t('fae.openShowcase')}
                  <ChevronRight className="size-3 shrink-0" aria-hidden="true" />
                </Link>
                <p className="mt-1">{t('fae.guideUpdate')}</p>
              </li>
              <li className="pl-1">{t('fae.guideReload')}</li>
            </ol>
            {details}
            <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">{t('fae.guideDelay')}</p>
          </DialogContent>
        </Dialog>
      )
    }

    case 'snapshot':
    case 'snapshot_outdated': {
      const isOutdated = state.kind === 'snapshot_outdated'
      const r = state.rating
      const rankParts = r.rank != null ? formatFaeRankParts(r.rank, r.rank_of) : null
      const percentileText =
        r.top_percentile != null ? formatFaePercentile(r.top_percentile) : null
      const url = getZfaeUrl(state.uid, r.slug)
      const dateStr = r.observed_at
        ? new Date(r.observed_at).toLocaleString()
        : null

      return (
        <Dialog>
          <div data-testid={action ? 'fae-refresh-control' : undefined} className={cn('inline-flex h-8 min-w-0 max-w-full items-stretch rounded-lg border border-border bg-card text-foreground', className)}>
            <DialogTrigger asChild>
              <button
                type="button"
                data-testid={isOutdated ? 'fae-badge-outdated' : 'fae-badge-snapshot'}
                className="inline-flex min-w-0 flex-1 cursor-pointer items-center overflow-hidden rounded-[7px] pr-2 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#636AF2] focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
              >
                <span className="flex shrink-0 self-stretch items-center rounded-l-[7px] bg-linear-to-r from-[#24208C] via-[#363ED9] to-[#636AF2] px-2 text-white">
                  <FaeLogo className="w-13" />
                </span>
                <span className={cn(isOutdated ? 'contents sm:ml-1.5 sm:flex sm:min-w-0 sm:-translate-y-[0.5px] sm:flex-col' : 'ml-1.5 flex min-w-0 flex-col')}>
                  <span className={cn('truncate font-tech tabular-nums', isOutdated ? 'ml-1.5 text-[14px] font-bold sm:ml-0' : 'text-[15px] font-semibold', 'leading-none')}>{rankParts?.rank}</span>
                  {isOutdated && <span className="order-1 ml-auto shrink-0 whitespace-nowrap pl-3 font-sans text-[9px] font-medium leading-[10px] text-[#a6a7bb] sm:order-none sm:ml-0 sm:pl-0">{t('fae.outdatedRating')}</span>}
                </span>
                {percentileText && <span className="ml-2 shrink-0 text-[11px] leading-none text-muted-foreground">{`${t('fae.topPrefix')} ${percentileText}`}</span>}
              </button>
            </DialogTrigger>
            {action}
          </div>
          <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-card-foreground sm:max-w-[420px] sm:p-6">
            <DialogTitle className="sr-only">FAE</DialogTitle>
            <DialogDescription className="sr-only">{r.bracket_name || 'FAE Leaderboard'}</DialogDescription>
            <FaeTooltipContent rating={r} dateStr={dateStr} uid={state.uid} />
            {details}
            {!isOutdated && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-[#636AF2]/50 bg-[#636AF2]/15 px-3 py-2.5 text-sm font-medium transition-colors hover:border-[#636AF2]/80 hover:bg-[#636AF2]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#636AF2] focus-visible:ring-offset-2 focus-visible:ring-offset-card motion-reduce:transition-none"
              >
                {t('fae.openBuild')} <ExternalLink className="size-4 shrink-0 text-[#636AF2] dark:text-[#a5b4fc]" aria-hidden="true" />
              </a>
            )}
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
