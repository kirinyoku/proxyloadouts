import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/format'
import { getRegionShortCode } from '@/lib/uid'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import type { ShowcaseResponse } from '@/types/showcase'

interface RegionConfig {
  code: string
  label: string
  className: string
}

const REGION_CONFIGS: Record<string, RegionConfig> = {
  Europe: {
    code: 'EU',
    label: 'Europe',
    className: 'border-sky-500/40 bg-sky-500/15 text-sky-400 dark:text-sky-300 shadow-[0_0_8px_-2px_rgba(56,189,248,0.25)]',
  },
  europe: {
    code: 'EU',
    label: 'Europe',
    className: 'border-sky-500/40 bg-sky-500/15 text-sky-400 dark:text-sky-300 shadow-[0_0_8px_-2px_rgba(56,189,248,0.25)]',
  },
  EU: {
    code: 'EU',
    label: 'Europe',
    className: 'border-sky-500/40 bg-sky-500/15 text-sky-400 dark:text-sky-300 shadow-[0_0_8px_-2px_rgba(56,189,248,0.25)]',
  },
  America: {
    code: 'NA',
    label: 'America',
    className: 'border-rose-500/40 bg-rose-500/15 text-rose-400 dark:text-rose-300 shadow-[0_0_8px_-2px_rgba(244,63,94,0.25)]',
  },
  america: {
    code: 'NA',
    label: 'America',
    className: 'border-rose-500/40 bg-rose-500/15 text-rose-400 dark:text-rose-300 shadow-[0_0_8px_-2px_rgba(244,63,94,0.25)]',
  },
  USA: {
    code: 'NA',
    label: 'America',
    className: 'border-rose-500/40 bg-rose-500/15 text-rose-400 dark:text-rose-300 shadow-[0_0_8px_-2px_rgba(244,63,94,0.25)]',
  },
  NA: {
    code: 'NA',
    label: 'America',
    className: 'border-rose-500/40 bg-rose-500/15 text-rose-400 dark:text-rose-300 shadow-[0_0_8px_-2px_rgba(244,63,94,0.25)]',
  },
  Asia: {
    code: 'ASIA',
    label: 'Asia',
    className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 dark:text-emerald-300 shadow-[0_0_8px_-2px_rgba(16,185,129,0.25)]',
  },
  asia: {
    code: 'ASIA',
    label: 'Asia',
    className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 dark:text-emerald-300 shadow-[0_0_8px_-2px_rgba(16,185,129,0.25)]',
  },
  ASIA: {
    code: 'ASIA',
    label: 'Asia',
    className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400 dark:text-emerald-300 shadow-[0_0_8px_-2px_rgba(16,185,129,0.25)]',
  },
  'TW/HK/MO': {
    code: 'TW/HK',
    label: 'TW/HK/MO',
    className: 'border-purple-500/40 bg-purple-500/15 text-purple-400 dark:text-purple-300 shadow-[0_0_8px_-2px_rgba(168,85,247,0.25)]',
  },
  TW: {
    code: 'TW/HK',
    label: 'TW/HK/MO',
    className: 'border-purple-500/40 bg-purple-500/15 text-purple-400 dark:text-purple-300 shadow-[0_0_8px_-2px_rgba(168,85,247,0.25)]',
  },
  China: {
    code: 'CN',
    label: 'China',
    className: 'border-amber-500/40 bg-amber-500/15 text-amber-400 dark:text-amber-300 shadow-[0_0_8px_-2px_rgba(245,158,11,0.25)]',
  },
  china: {
    code: 'CN',
    label: 'China',
    className: 'border-amber-500/40 bg-amber-500/15 text-amber-400 dark:text-amber-300 shadow-[0_0_8px_-2px_rgba(245,158,11,0.25)]',
  },
  CN: {
    code: 'CN',
    label: 'China',
    className: 'border-amber-500/40 bg-amber-500/15 text-amber-400 dark:text-amber-300 shadow-[0_0_8px_-2px_rgba(245,158,11,0.25)]',
  },
}

function getRegionConfig(region: string): RegionConfig {
  const trimmed = region?.trim() ?? ''
  return (
    REGION_CONFIGS[trimmed] ?? {
      code: getRegionShortCode(trimmed) || '??',
      label: trimmed || 'Unknown',
      className: 'border-zinc-500/40 bg-zinc-500/15 text-zinc-400 dark:text-zinc-300',
    }
  )
}

export function RegionBadge({ region, className }: { region: string; className?: string }) {
  const config = getRegionConfig(region)
  return (
    <span
      title={`Server: ${config.label}`}
      className={cn(
        'inline-flex items-center rounded-[3px_3px_0_3px] border px-1.5 py-0.5 font-heading text-[9px] leading-none font-bold tracking-wider uppercase select-none shadow-xs',
        config.className,
        className
      )}
    >
      {config.code}
    </span>
  )
}

function UidCopyChip({ uid }: { uid: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useEffect(() => () => clearTimeout(timerRef.current ?? undefined), [])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(uid)
      setCopied(true)
      clearTimeout(timerRef.current ?? undefined)
      timerRef.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={t('showcase.copyUidTitle')}
      aria-label={t('showcase.copyUidAria')}
      className="inline-flex h-6 min-h-[24px] cursor-pointer items-center gap-1 rounded-md border border-border bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-foreground transition-all hover:border-primary/50 hover:bg-primary/[0.06] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background select-none"
    >
      {uid}
      {copied ? (
        <Check className="size-3 text-primary" />
      ) : (
        <Copy className="size-3 opacity-60" />
      )}
    </button>
  )
}

function StatusPulse({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={cn('size-1.5 shrink-0 animate-pulse rounded-full shadow-sm', className)}
    />
  )
}

interface CacheStatusPillProps {
  isFresh: boolean
  ttlSeconds: number
  isRefetching: boolean
  onRefresh: () => void
  className?: string
}

function CacheStatusPill({
  isFresh,
  ttlSeconds,
  isRefetching,
  onRefresh,
  className,
}: CacheStatusPillProps) {
  const { t, i18n } = useTranslation()
  const [timeLeft, setTimeLeft] = useState(ttlSeconds)

  useEffect(() => {
    if (timeLeft <= 0) return

    const timer = window.setTimeout(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1))
    }, 1000)

    return () => window.clearTimeout(timer)
  }, [timeLeft])

  if (isFresh) {
    return (
      <div
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 font-mono text-[11px] font-semibold text-emerald-400 shadow-xs select-none shrink-0',
          className
        )}
        title={t('showcase.liveDataTooltip')}
      >
        <StatusPulse className="bg-emerald-400 shadow-emerald-400/60" />
        <span>LIVE</span>
      </div>
    )
  }

  const isExpired = timeLeft <= 0
  const unit = i18n.language.startsWith('en') ? 's' : 'с'

  return (
    <div
      className={cn(
        'inline-flex h-8 items-center rounded-lg border px-1.5 pl-2 font-mono text-[11px] transition-colors select-none shadow-xs shrink-0',
        isExpired
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
          : 'border-white/[0.08] bg-white/[0.03] text-muted-foreground',
        className
      )}
      title={
        isExpired
          ? t('showcase.refreshNow')
          : `${t('showcase.cachedDataTooltip')} (${formatNumber(timeLeft)}${unit})`
      }
    >
      <StatusPulse
        className={cn(
          'mr-1.5',
          isExpired
            ? 'bg-amber-400 shadow-amber-400/60'
            : 'bg-muted-foreground/60'
        )}
      />
      <span className="font-medium whitespace-nowrap text-[11px]">
        {isExpired ? (
          <span className="text-amber-400 font-semibold">{t('showcase.cacheReady')}</span>
        ) : (
          <span>
            {t('showcase.cacheLabel')}{' '}
            <span className="tabular-nums font-semibold text-foreground/80">
              {formatNumber(timeLeft)}{unit}
            </span>
          </span>
        )}
      </span>

      <span aria-hidden className="mx-1 h-3.5 w-px bg-white/10" />

      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefetching}
        title={t('showcase.refreshNow')}
        aria-label={t('showcase.refreshAria')}
        className={cn(
          'flex size-5.5 cursor-pointer items-center justify-center rounded transition-all active:scale-90',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
          isExpired
            ? 'text-amber-400 hover:bg-amber-400/20 hover:text-amber-300'
            : 'text-muted-foreground hover:bg-white/10 hover:text-foreground',
          'disabled:pointer-events-none disabled:opacity-50'
        )}
      >
        {isRefetching ? (
          <Spinner size="xs" color="primary" />
        ) : (
          <RefreshCw className="size-3.5" />
        )}
      </button>
    </div>
  )
}

interface SearchFormProps {
  uidInput: string
  isUidValid: boolean
  onUidInputChange: (value: string) => void
  onScan: (uid: string) => void
  className?: string
}

function SearchForm({
  uidInput,
  isUidValid,
  onUidInputChange,
  onScan,
  className,
}: SearchFormProps) {
  const { t } = useTranslation()

  return (
    <form
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-[10px_10px_0_10px] border-2 border-black bg-elevated pr-1 pl-2.5 shadow-[inset_0_0_0_1px_var(--border),0_2px_8px_-4px_rgba(0,0,0,0.5)] transition-shadow focus-within:shadow-[inset_0_0_0_1.5px_rgba(201,242,75,0.7),0_0_14px_-4px_rgba(201,242,75,0.35)]',
        className
      )}
      onSubmit={(event) => {
        event.preventDefault()
        if (isUidValid) onScan(uidInput)
      }}
      noValidate
    >
      <input
        name="uid"
        inputMode="numeric"
        placeholder={t('showcase.searchPlaceholder')}
        value={uidInput}
        onChange={(event) => onUidInputChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
        autoComplete="off"
        aria-label={t('home.uidAria')}
        className="min-w-0 flex-1 bg-transparent font-mono text-xs tracking-wide text-foreground outline-none placeholder:text-muted-foreground/70"
      />

      {uidInput.length > 0 && (
        <button
          type="button"
          onClick={() => onUidInputChange('')}
          title={t('common.clear')}
          aria-label={t('common.clear')}
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground active:scale-90"
        >
          <X className="size-3" />
        </button>
      )}

      <button
        type="submit"
        title={t('showcase.searchTitle')}
        aria-label={t('showcase.searchAria')}
        disabled={!isUidValid}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px_6px_0_6px] border border-black bg-primary text-primary-foreground shadow-[inset_0_0_0_1px_var(--primary),inset_0_0_0_2px_rgba(0,0,0,0.85)] transition-[filter,transform] hover:brightness-105 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <Search className="size-3.5" />
      </button>
    </form>
  )
}

interface ShowcaseProfileHeaderProps {
  showcase: ShowcaseResponse
  uidInput: string
  isUidValid: boolean
  isRefetching: boolean
  isAuthed?: boolean
  isOwnedUid?: boolean
  onScan: (uid: string) => void
  onUidInputChange: (value: string) => void
  onRefresh: () => void
}

/**
 * Top profile header for showcase page:
 * Displays user identity (avatar, IL, nickname, region, UID), cache freshness status, and search input.
 * Layout:
 * - Upper section: Profile identity (Avatar with IL badge, Nickname + Region, UID chip + Link button).
 * - Action controls: Cache status API pill + Search input form placed side-by-side on the same row.
 */
export function ShowcaseProfileHeader({
  showcase,
  uidInput,
  isUidValid,
  isRefetching,
  isAuthed = false,
  isOwnedUid = true,
  onScan,
  onUidInputChange,
  onRefresh,
}: ShowcaseProfileHeaderProps) {
  const { t } = useTranslation()
  const isFresh = showcase.source === 'fresh'

  return (
    <div className="card-zzz relative p-3 sm:px-4 sm:py-2">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Profile Identity: avatar, IL level, nickname, server badge, UID copy, link */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative shrink-0 pb-1">
            {showcase.avatar_url ? (
              <img
                src={showcase.avatar_url}
                alt=""
                width={40}
                height={40}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="block size-10 rounded-full border-2 border-black bg-secondary object-cover ring-2 ring-primary/55"
              />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-full border-2 border-black bg-secondary font-heading text-xs font-bold text-primary ring-2 ring-primary/55">
                {showcase.nickname.slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[3px_3px_0_3px] border border-black bg-primary px-1 font-heading text-[8px] leading-[1.2] font-black whitespace-nowrap text-primary-foreground shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
              IL {showcase.interknot_level}
            </span>
          </div>

          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="truncate font-heading text-[15px] leading-tight font-bold tracking-wide text-foreground uppercase">
                {showcase.nickname}
              </span>
              <RegionBadge region={showcase.region} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] leading-none text-muted-foreground">
              <UidCopyChip uid={showcase.uid} />
              {isAuthed && !isOwnedUid && (
                <>
                  <span aria-hidden className="size-[3px] rounded-full bg-muted-foreground/60 hidden sm:inline-block" />
                  <Link
                    to="/settings"
                    title={t('showcase.unlinkedBanner', { uid: showcase.uid })}
                    className="inline-flex h-6 min-h-[24px] cursor-pointer items-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300 transition-all hover:border-amber-400/70 hover:bg-amber-400/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 select-none"
                  >
                    <Plus className="size-3 shrink-0 text-amber-400" />
                    <span>{t('showcase.linkUid')}</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Row: Cache Status API + Search input sharing the row */}
        <div className="flex items-center gap-2 min-w-0 pt-2 border-t border-white/[0.06] sm:border-t-0 sm:pt-0 sm:ml-auto">
          <CacheStatusPill
            key={`${showcase.source}-${showcase.ttl_seconds}`}
            isFresh={isFresh}
            ttlSeconds={showcase.ttl_seconds}
            isRefetching={isRefetching}
            onRefresh={onRefresh}
          />
          <SearchForm
            uidInput={uidInput}
            isUidValid={isUidValid}
            onUidInputChange={onUidInputChange}
            onScan={onScan}
            className="flex-1 min-w-0 sm:w-44 lg:w-48 sm:flex-none"
          />
        </div>
      </div>
    </div>
  )
}
