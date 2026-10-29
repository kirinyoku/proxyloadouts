import { useState } from 'react'
import { Check, Globe, Lock, Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { cn } from '@/lib/utils'
import type { GameAccount } from '@/types'

interface TeamsHeaderProps {
  totalCount?: number
  activeAccount?: GameAccount | null
  isPublicTeams?: boolean
  onTogglePublicTeams?: () => void
  isUpdatingVisibility?: boolean
}

export function TeamsHeader({
  totalCount = 0,
  activeAccount,
  isPublicTeams,
  onTogglePublicTeams,
  isUpdatingVisibility,
}: TeamsHeaderProps) {
  const { t } = useTranslation()
  const formattedCount = String(totalCount).padStart(2, '0')
  const [teamsLinkCopied, setTeamsLinkCopied] = useState(false)

  async function handleCopyTeamsLink() {
    if (!activeAccount?.uid) return
    const url = `${window.location.origin}/showcase?uid=${encodeURIComponent(activeAccount.uid)}&tab=squads`
    try {
      await navigator.clipboard.writeText(url)
      setTeamsLinkCopied(true)
      setTimeout(() => setTeamsLinkCopied(false), 2000)
      toast.success(t('sharing.linkCopied'))
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2.5">
      <h1 className="flex items-center font-heading text-lg font-bold tracking-wide text-white sm:text-xl md:text-2xl">
        {t('teams.title')}
        {totalCount > 0 && (
          <span
            className="ml-2 sm:ml-2.5 font-heading"
            aria-label={t('teams.totalAria', { count: totalCount })}
            title={t('teams.totalAria', { count: totalCount })}
          >
            <span className="text-primary select-none">//</span>{' '}
            <span className="text-muted-foreground">{formattedCount}</span>
          </span>
        )}
      </h1>

      {activeAccount && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onTogglePublicTeams}
            disabled={isUpdatingVisibility}
            title={isPublicTeams ? t('sharing.publicTooltip') : t('sharing.privateTooltip')}
            className={cn(
              'h-7.5 px-2 text-xs font-semibold gap-1.5 rounded-xl border transition-all cursor-pointer',
              isPublicTeams
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                : 'border-white/10 bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground',
            )}
          >
            {isPublicTeams ? (
              <Globe className="size-3.5" />
            ) : (
              <Lock className="size-3.5" />
            )}
            <span className="hidden min-[480px]:inline text-[11px] font-sans">
              {isPublicTeams ? t('teams.statusPublic') : t('teams.statusPrivate')}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopyTeamsLink}
            title={t('teams.copyPublicLink')}
            aria-label={t('teams.copyPublicLink')}
            className="size-7.5 rounded-xl border border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] cursor-pointer"
          >
            {teamsLinkCopied ? (
              <Check className="size-3.5 text-primary stroke-[2.5]" />
            ) : (
              <Share2 className="size-3.5" />
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

