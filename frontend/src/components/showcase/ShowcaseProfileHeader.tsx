import { useEffect, useRef, useState } from 'react'
import { BadgeCheck, Check, Copy, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DiscordIcon } from '@/components/common/DiscordIcon'
import { formatNumber } from '@/lib/format'
import { getRegionShortCode } from '@/lib/uid'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import { UidSearchForm } from '@/components/common/UidSearchForm'
import type { PublicOwnerInfo } from '@/types/account'
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
    className: 'bg-sky-600',
  },
  europe: {
    code: 'EU',
    label: 'Europe',
    className: 'bg-sky-600',
  },
  EU: {
    code: 'EU',
    label: 'Europe',
    className: 'bg-sky-600',
  },
  America: {
    code: 'NA',
    label: 'America',
    className: 'bg-[#e05666]',
  },
  america: {
    code: 'NA',
    label: 'America',
    className: 'bg-[#e05666]',
  },
  USA: {
    code: 'NA',
    label: 'America',
    className: 'bg-[#e05666]',
  },
  NA: {
    code: 'NA',
    label: 'America',
    className: 'bg-[#e05666]',
  },
  Asia: {
    code: 'ASIA',
    label: 'Asia',
    className: 'bg-emerald-600',
  },
  asia: {
    code: 'ASIA',
    label: 'Asia',
    className: 'bg-emerald-600',
  },
  ASIA: {
    code: 'ASIA',
    label: 'Asia',
    className: 'bg-emerald-600',
  },
  'TW/HK/MO': {
    code: 'TW/HK',
    label: 'TW/HK/MO',
    className: 'bg-purple-600',
  },
  'TW/HK': {
    code: 'TW/HK',
    label: 'TW/HK/MO',
    className: 'bg-purple-600',
  },
  TW: {
    code: 'TW/HK',
    label: 'TW/HK/MO',
    className: 'bg-purple-600',
  },
  CHT: {
    code: 'CHT',
    label: 'TW/HK/MO',
    className: 'bg-purple-600',
  },
  cht: {
    code: 'CHT',
    label: 'TW/HK/MO',
    className: 'bg-purple-600',
  },
  China: {
    code: 'CN',
    label: 'China',
    className: 'bg-amber-600',
  },
  china: {
    code: 'CN',
    label: 'China',
    className: 'bg-amber-600',
  },
  CN: {
    code: 'CN',
    label: 'China',
    className: 'bg-amber-600',
  },
}

function getRegionConfig(region: string): RegionConfig {
  const trimmed = region?.trim() ?? ''
  const direct = REGION_CONFIGS[trimmed]
  if (direct) return direct
  const lower = trimmed.toLowerCase()
  const found = Object.entries(REGION_CONFIGS).find(([k]) => k.toLowerCase() === lower)
  if (found) return found[1]

  return {
    code: getRegionShortCode(trimmed) || '??',
    label: trimmed || 'Unknown',
    className: 'bg-zinc-600',
  }
}

export function RegionBadge({ region, className }: { region: string; className?: string }) {
  const config = getRegionConfig(region)
  return (
    <span
      title={`Server: ${config.label}`}
      className={cn(
        'inline-flex items-center rounded-[3px_3px_0_3px] border border-black/70 px-1.5 py-0.5 font-mono text-[9.5px] leading-none font-bold tracking-wider uppercase text-white select-none shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
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

interface CacheStatusPillProps {
  ttlSeconds: number
  isRefetching: boolean
  onRefresh: () => void
  className?: string
}

function CacheStatusPill({
  ttlSeconds,
  isRefetching,
  onRefresh,
  className,
}: CacheStatusPillProps) {
  const { t, i18n } = useTranslation()
  const [timeLeft, setTimeLeft] = useState(ttlSeconds)

  useEffect(() => {
    if (ttlSeconds <= 0) return

    const expiresAt = Date.now() + ttlSeconds * 1000
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining <= 0) {
        window.clearInterval(interval)
      }
    }, 500)

    return () => window.clearInterval(interval)
  }, [ttlSeconds])

  const isCooldown = timeLeft > 0
  const isReady = !isRefetching && !isCooldown
  const unit = i18n.language.startsWith('en') ? 's' : 'с'

  const tooltipTitle = isRefetching
    ? t('showcase.refreshing')
    : isCooldown
      ? t('showcase.cooldownTooltip', { seconds: formatNumber(timeLeft) })
      : t('showcase.readyToRefreshTooltip')

  return (
    <button
      type="button"
      onClick={isReady ? onRefresh : undefined}
      disabled={!isReady}
      title={tooltipTitle}
      aria-label={t('showcase.refreshAria')}
      aria-busy={isRefetching}
      className={cn(
        'group inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 font-mono text-[11px] transition-all select-none shadow-xs shrink-0',
        isRefetching &&
          'border-white/[0.08] bg-white/[0.03] text-muted-foreground opacity-80 cursor-wait',
        !isRefetching &&
          isCooldown &&
          'border-white/[0.08] bg-white/[0.03] text-muted-foreground opacity-85 cursor-not-allowed',
        isReady &&
          'border-primary/40 bg-primary/10 text-primary hover:border-primary/70 hover:bg-primary/20 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        className
      )}
    >
      {isRefetching ? (
        <>
          <Spinner size="xs" color="primary" className="size-3.5 shrink-0" />
          <span className="font-medium whitespace-nowrap text-[11px]">
            {t('showcase.refreshing')}
          </span>
        </>
      ) : isCooldown ? (
        <>
          <RefreshCw className="size-3.5 shrink-0 opacity-50" />
          <span className="font-medium whitespace-nowrap text-[11px]">
            <span className="text-muted-foreground/80 mr-1">{t('showcase.cacheLabel')}</span>
            <span className="tabular-nums font-semibold text-foreground/80">
              {`${formatNumber(timeLeft)}${unit}`}
            </span>
          </span>
        </>
      ) : (
        <>
          <RefreshCw className="size-3.5 shrink-0 text-primary transition-transform group-hover:rotate-45" />
          <span className="font-semibold whitespace-nowrap text-[11px] text-primary">
            {t('showcase.refreshNow')}
          </span>
        </>
      )}
    </button>
  )
}


interface ShowcaseProfileHeaderProps {
  showcase: ShowcaseResponse
  verifiedOwner?: PublicOwnerInfo | null
  uidInput: string
  isUidValid: boolean
  isRefetching: boolean
  onScan: (uid: string) => void
  onUidInputChange: (value: string) => void
  onRefresh: () => void
}

/**
 * Top profile header for showcase page:
 * Displays user identity (avatar, IL, nickname, region, UID), cache freshness status, and search input.
 * Layout:
 * - Upper section: Profile identity (Avatar with IL badge, Nickname + Region, UID chip).
 * - Action controls: Cache status API pill + Search input form placed side-by-side on the same row.
 */
export function ShowcaseProfileHeader({
  showcase,
  verifiedOwner,
  uidInput,
  isUidValid,
  isRefetching,
  onScan,
  onUidInputChange,
  onRefresh,
}: ShowcaseProfileHeaderProps) {
  const { t } = useTranslation()
  const owner = verifiedOwner ?? showcase.verified_owner

  return (
    <div className="relative rounded-2xl border border-white/[0.08] bg-card/96 p-3 sm:px-4 sm:py-2 shadow-lg backdrop-blur-sm">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Profile Identity: avatar, IL level, nickname, server badge, UID copy */}
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
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span className="truncate font-heading text-[15px] leading-tight font-bold tracking-wide text-foreground uppercase">
                {showcase.nickname}
              </span>
              <RegionBadge region={showcase.region} />
              {owner?.is_verified && (
                <span
                  title={t('sharing.verifiedOwner')}
                  className="inline-flex items-center gap-1 rounded-[3px_3px_0_3px] border border-emerald-500/50 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-wider text-emerald-400 select-none shadow-[0_1px_2px_rgba(0,0,0,0.35)] shrink-0"
                >
                  <BadgeCheck className="size-3 text-emerald-400 shrink-0" />
                  <span>{t('sharing.verifiedOwner')}</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] leading-none text-muted-foreground">
              <UidCopyChip uid={showcase.uid} />
              {owner?.discord_username && (
                <div
                  className="inline-flex h-6 min-h-[24px] items-center gap-1.5 rounded-md border border-[#5865F2]/40 bg-[#5865F2]/10 px-2 py-0.5 text-[#8891f2] select-none"
                  title={`Discord: ${owner.discord_username}`}
                >
                  {owner.discord_avatar_url ? (
                    <img
                      src={owner.discord_avatar_url}
                      alt=""
                      className="size-3.5 rounded-full object-cover"
                    />
                  ) : (
                    <DiscordIcon className="size-3" />
                  )}
                  <span className="font-sans font-medium text-xs text-foreground/90">
                    {owner.discord_username}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Row: Cache Status API + Search input sharing the row */}
        <div className="flex items-center gap-2 min-w-0 pt-2 border-t border-white/[0.06] sm:border-t-0 sm:pt-0 sm:ml-auto">
          <CacheStatusPill
            key={showcase.fetched_at || `${showcase.source}-${showcase.ttl_seconds}`}
            ttlSeconds={showcase.ttl_seconds}
            isRefetching={isRefetching}
            onRefresh={onRefresh}
          />
          <UidSearchForm
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
