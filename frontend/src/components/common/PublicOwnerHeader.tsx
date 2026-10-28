import { useRef, useState } from 'react'
import { BadgeCheck, Check, Copy, ExternalLink, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RegionBadge } from '@/components/showcase/ShowcaseProfileHeader'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import type { PublicOwnerInfo } from '@/types'

export interface PublicOwnerHeaderProps {
  owner: PublicOwnerInfo
  shareUrl?: string
  className?: string
}

export function PublicOwnerHeader({ owner, shareUrl, className }: PublicOwnerHeaderProps) {
  const { t } = useTranslation()
  const [uidCopied, setUidCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const linkTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  const displayName = owner.nickname || `UID ${owner.uid}`

  async function handleCopyUid() {
    try {
      await navigator.clipboard.writeText(owner.uid)
      setUidCopied(true)
      clearTimeout(timerRef.current ?? undefined)
      timerRef.current = setTimeout(() => setUidCopied(false), 1500)
      toast.success(t('sharing.uidCopied'))
    } catch {
      // ignore
    }
  }

  async function handleShare() {
    const url = shareUrl || window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setLinkCopied(true)
      clearTimeout(linkTimerRef.current ?? undefined)
      linkTimerRef.current = setTimeout(() => setLinkCopied(false), 1500)
      toast.success(t('sharing.linkCopied'))
    } catch {
      // ignore
    }
  }

  return (
    <div
      className={cn(
        'relative rounded-2xl border border-white/[0.08] bg-card/96 p-3 sm:px-4 sm:py-3 shadow-lg backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Profile info: avatar, nickname, region, UID, verified, discord */}
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            {owner.avatar_url ? (
              <img
                src={owner.avatar_url}
                alt=""
                width={44}
                height={44}
                loading="eager"
                decoding="async"
                fetchPriority="high"
                className="block size-11 rounded-full border-2 border-black bg-secondary object-cover ring-2 ring-primary/55"
              />
            ) : (
              <div className="flex size-11 items-center justify-center rounded-full border-2 border-black bg-secondary font-heading text-sm font-bold text-primary ring-2 ring-primary/55">
                {displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="truncate font-heading text-base font-bold tracking-wide text-foreground uppercase">
                {displayName}
              </span>
              <RegionBadge region={owner.region} />

              {owner.is_verified && (
                <span
                  title={t('sharing.verifiedOwner')}
                  className="inline-flex items-center gap-1 rounded-[3px_3px_0_3px] border border-emerald-500/50 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[9.5px] font-bold tracking-wider text-emerald-400 select-none shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                >
                  <BadgeCheck className="size-3 text-emerald-400 shrink-0" />
                  <span>{t('sharing.verifiedOwner')}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <button
                type="button"
                onClick={handleCopyUid}
                title={t('sharing.copyUid')}
                aria-label={t('sharing.copyUid')}
                className="inline-flex h-6 min-h-[24px] cursor-pointer items-center gap-1 rounded-md border border-border bg-white/[0.03] px-2 py-0.5 text-foreground transition-all hover:border-primary/50 hover:bg-primary/[0.06] active:scale-95 select-none"
              >
                <span>{`UID ${owner.uid}`}</span>
                {uidCopied ? (
                  <Check className="size-3 text-primary" />
                ) : (
                  <Copy className="size-3 opacity-60" />
                )}
              </button>

              {owner.discord_username && (
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
                    <span className="font-bold text-xs">#</span>
                  )}
                  <span className="font-sans font-medium text-xs text-foreground/90">
                    {owner.discord_username}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Showcase link + Share button */}
        <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t border-white/[0.06] sm:border-t-0 sm:ml-auto shrink-0">
          <Button
            variant="secondary"
            size="sm"
            className="h-8 gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.09] text-xs font-semibold text-foreground transition-all cursor-pointer shadow-xs"
            asChild
          >
            <Link
              to={`/showcase?uid=${owner.uid}`}
              title={t('sharing.viewShowcaseTitle', { uid: owner.uid })}
            >
              <ExternalLink className="size-3.5" />
              <span>{t('sharing.viewShowcase')}</span>
            </Link>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleShare}
            className="h-8 gap-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary transition-all cursor-pointer shadow-xs"
            title={t('sharing.copyLink')}
          >
            {linkCopied ? (
              <>
                <Check className="size-3.5" />
                <span>{t('sharing.linkCopied')}</span>
              </>
            ) : (
              <>
                <Share2 className="size-3.5" />
                <span>{t('sharing.share')}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
