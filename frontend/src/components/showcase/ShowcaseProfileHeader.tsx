import { useEffect, useRef, useState } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
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
        'inline-flex shrink-0 items-center rounded-[3px_3px_0_3px] border border-black/70 px-1.5 py-0.5 font-mono text-[9.5px] leading-none font-bold tracking-wider uppercase text-white select-none shadow-[0_1px_2px_rgba(0,0,0,0.35)]',
        config.className,
        className
      )}
    >
      {config.code}
    </span>
  )
}

export function UidCopyChip({
  uid,
  title,
  ariaLabel,
  className,
}: {
  uid: string
  title?: string
  ariaLabel?: string
  className?: string
}) {
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
      title={title ?? t('showcase.copyUidTitle')}
      aria-label={ariaLabel ?? t('showcase.copyUidAria')}
      className={cn(
        'inline-flex h-6 min-h-[24px] shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-foreground transition-all hover:border-white/20 hover:bg-white/[0.08] active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
        className
      )}
    >
      <span className="tabular-nums">{uid}</span>
      {copied ? (
        <Check className="size-3 shrink-0 text-primary" />
      ) : (
        <Copy className="size-3 shrink-0 opacity-60" />
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
        'group inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px_10px_0_10px] border-2 border-black font-mono text-[11px] transition-all select-none shrink-0 px-2 min-w-8',
        'shadow-[inset_0_0_0_1px_var(--border),0_2px_8px_-4px_rgba(0,0,0,0.5)]',
        isRefetching &&
          'bg-elevated text-muted-foreground opacity-80 cursor-wait',
        !isRefetching &&
          isCooldown &&
          'bg-elevated text-muted-foreground opacity-90 cursor-not-allowed',
        isReady &&
          'bg-primary/10 text-primary shadow-[inset_0_0_0_1px_var(--primary),0_2px_8px_-4px_rgba(0,0,0,0.5)] hover:brightness-105 active:scale-95 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background',
        className
      )}
    >
      {isRefetching ? (
        <>
          <Spinner size="xs" color="primary" className="size-3.5 shrink-0" />
          <span className="sr-only">{t('showcase.refreshing')}</span>
        </>
      ) : isCooldown ? (
        <>
          <RefreshCw className="size-3.5 shrink-0 opacity-50" />
          <span className="tabular-nums font-semibold text-foreground/80">
            {`${formatNumber(timeLeft)}${unit}`}
          </span>
        </>
      ) : (
        <>
          <RefreshCw className="size-3.5 shrink-0 text-primary transition-transform group-hover:rotate-45" />
          <span className="sr-only">{t('showcase.refreshNow')}</span>
        </>
      )}
    </button>
  )
}

export function ShowcaseProfileIdentity({ profile, owner }: {
  profile: Pick<ShowcaseResponse, 'uid' | 'nickname' | 'region' | 'avatar_url' | 'interknot_level'>
  owner?: PublicOwnerInfo | null
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="relative shrink-0 pb-1">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            width={44}
            height={44}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="block size-11 rounded-full border-2 border-black bg-secondary object-cover ring-2 ring-primary/55"
          />
        ) : (
          <div className="flex size-11 items-center justify-center rounded-full border-2 border-black bg-secondary font-heading text-xs font-bold text-primary ring-2 ring-primary/55">
            {profile.nickname.slice(0, 2).toUpperCase()}
          </div>
        )}
        {Boolean(profile.interknot_level && profile.interknot_level > 0) && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 rounded-[3px_3px_0_3px] border border-black bg-primary px-1 font-heading text-[8px] leading-[1.2] font-black whitespace-nowrap text-primary-foreground shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            IL {profile.interknot_level}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
          <span
            title={profile.nickname}
            className="font-heading text-base leading-tight font-bold tracking-wide text-foreground uppercase truncate max-w-[130px] sm:max-w-[180px] md:max-w-[220px] lg:max-w-[200px] xl:max-w-[260px]"
          >
            {profile.nickname}
          </span>
          <RegionBadge region={profile.region} className="shrink-0" />
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[11px] min-w-0 flex-nowrap">
          <UidCopyChip uid={profile.uid} />
          {owner?.discord_username && (
            <div
              className="inline-flex h-6 min-h-[24px] max-w-[130px] sm:max-w-[160px] shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-[#5865F2]/10 px-2 py-0.5 text-foreground/90 select-none"
              title={`Discord: ${owner.discord_username}`}
            >
              {owner.discord_avatar_url ? (
                <img
                  src={owner.discord_avatar_url}
                  alt=""
                  className="size-3.5 shrink-0 rounded-full object-cover"
                />
              ) : (
                <DiscordIcon className="size-3 shrink-0 text-[#8891f2]" />
              )}
              <span className="font-sans font-medium text-xs truncate">
                {owner.discord_username}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
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
  className?: string
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
  className,
}: ShowcaseProfileHeaderProps) {
  const owner = verifiedOwner ?? showcase.verified_owner

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/[0.08] bg-card/96 p-2.5 sm:px-3.5 sm:py-2 shadow-lg backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3 lg:gap-4 sm:justify-start">
        <ShowcaseProfileIdentity profile={showcase} owner={owner} />

        {/* Action Row: Divider + Cache Status API + Search input pushed to right edge */}
        <div className="flex items-center gap-2 min-w-0 pt-2 border-t border-white/[0.06] sm:border-t-0 sm:pt-0 sm:ml-auto">
          {/* Vertical divider on tablet/desktop */}
          <div className="hidden sm:block h-7 w-px bg-white/[0.08] shrink-0 mr-1" aria-hidden="true" />
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
            className="flex-1 min-w-0 sm:w-40 lg:w-44 sm:flex-none"
          />
        </div>
      </div>
    </div>
  )
}
