import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { FaeBadge, type FaeBadgeProps } from './FaeBadge'
import { cn } from '@/lib/utils'
import type { ShowcaseFaeResponse } from '@/types'

interface Props extends Pick<FaeBadgeProps, 'rating' | 'uid' | 'isLoading' | 'className'> {
  profile: ShowcaseFaeResponse | undefined
  pending: boolean
  failed: boolean
  onRefresh: () => void
}

export function FaeRefreshControl({ profile, pending, failed, onRefresh, rating, uid, isLoading, className }: Props) {
  const { t } = useTranslation()
  const deadline = profile?.refresh_available_at ? Date.parse(profile.refresh_available_at) : 0
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const delay = deadline - Date.now()
    if (deadline <= now) return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Math.min(delay + 50, 2_147_483_647)))
    return () => clearTimeout(timer)
  }, [deadline, now])
  const coolingDown = deadline > now
  const failure = failed || profile?.refresh_outcome === 'failed' || profile?.refresh_outcome === 'backoff'
  const atCapacity = profile?.refresh_outcome === 'capacity'
  const warning = failure || atCapacity
  const availableText = coolingDown
    ? t('fae.refreshAvailable', { date: new Date(deadline).toLocaleString() })
    : null
  const hasDetails = !rating?.observed_at || failure || atCapacity || Boolean(availableText)
  const details = hasDetails ? (
    <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
      {!rating?.observed_at && (
        <p>
          {profile?.fetched_at
            ? t('fae.observedAt', { date: new Date(profile.fetched_at).toLocaleString() })
            : t('fae.refreshMissing')}
        </p>
      )}
      {failure && <p role="alert" className="text-amber-700 dark:text-amber-300">{t('fae.refreshFailed')}</p>}
      {atCapacity && <p role="alert" className="text-amber-700 dark:text-amber-300">{t('fae.refreshCapacity')}</p>}
      {availableText && <p>{availableText}</p>}
    </div>
  ) : undefined
  return (
    <>
      <FaeBadge
        rating={rating}
        uid={uid}
        isLoading={isLoading}
        showUnassessed
        className={cn(className, warning && 'border-amber-500/60')}
        action={
          <button
            type="button"
            aria-label={t('fae.refreshRating')}
            aria-busy={pending}
            title={pending ? t('showcase.refreshing') : availableText ?? t('fae.refreshProfile')}
            onClick={onRefresh}
            disabled={pending || coolingDown || !profile}
            className={cn(
              'inline-flex w-8 shrink-0 cursor-pointer items-center justify-center rounded-r-[7px] border-l border-border text-[#444BC5] transition-colors hover:bg-[#636AF2]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#636AF2] disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#a5b4fc] motion-reduce:transition-none',
              warning && 'text-amber-700 dark:text-amber-300',
            )}
          >
            {warning && !pending
              ? <AlertCircle className="size-3.5" aria-hidden="true" />
              : <RefreshCw className={cn('size-3.5', pending && 'animate-spin motion-reduce:animate-none')} aria-hidden="true" />}
          </button>
        }
        details={details}
      />
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {pending && t('showcase.refreshing')}
        {failure && t('fae.refreshFailed')}
        {atCapacity && t('fae.refreshCapacity')}
        {availableText}
      </p>
    </>
  )
}
