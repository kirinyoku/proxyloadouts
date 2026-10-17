import { useState } from 'react'
import { Check, Copy, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useDeleteAccount } from '@/api/hooks'
import { formatDate } from '@/lib/format'
import { getRegionShortCode } from '@/lib/uid'
import { cn } from '@/lib/utils'
import { useAccountStore } from '@/store/useAccountStore'
import type { GameAccount } from '@/types'

interface ProxyAccountRowProps {
  account: GameAccount
  isActive: boolean
}

/**
 * Compact account row: status dot + mono UID + region chip on the left,
 * copy / set-active / delete on the right. Destructive action is icon-only so
 * it stops competing with the primary "set as active" action for attention.
 */
export function ProxyAccountRow({ account, isActive }: ProxyAccountRowProps) {
  const { t } = useTranslation()
  const setActiveAccount = useAccountStore((state) => state.setActiveAccount)
  const deleteMutation = useDeleteAccount()
  const [copied, setCopied] = useState(false)

  const regionCode = getRegionShortCode(account.region)

  function handleCopyUid() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(account.uid)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      data-slot="proxy-account-row"
      data-active={isActive}
      className={cn(
        'group grid grid-cols-[1fr_auto_auto] items-center gap-x-1.5 gap-y-2 px-4 py-3 transition-colors sm:flex sm:gap-2 sm:px-5 sm:py-2.5',
        isActive ? 'bg-primary/[0.04]' : 'hover:bg-white/[0.02]'
      )}
    >
      {/* 1. Identity: status dot + UID + region + active badge */}
      <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 sm:shrink-0 sm:gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'size-2 shrink-0 rounded-full transition-colors',
            isActive
              ? 'bg-primary shadow-[0_0_8px_color-mix(in_oklch,var(--primary)_70%,transparent)]'
              : 'bg-white/20'
          )}
        />

        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="font-mono text-sm font-semibold tracking-wide text-foreground tabular-nums">
            {account.uid}
          </span>

          {regionCode && (
            <span
              title={account.region}
              className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground uppercase"
            >
              {regionCode}
            </span>
          )}

          {isActive && (
            <Badge className="h-5 gap-1 border border-primary/30 bg-primary/15 px-2 text-[10px] font-medium text-primary uppercase">
              {t('settings.activeBadge')}
            </Badge>
          )}
        </div>
      </div>

      {/* 2. Added date: full width on mobile (no truncation), inline on desktop */}
      <p className="col-span-full row-start-2 pl-4 text-[11px] text-muted-foreground/70 sm:pl-0 sm:ml-2 sm:mr-auto sm:truncate">
        {t('settings.addedAt', { date: formatDate(account.created_at) })}
      </p>

      {/* 3. Copy button: top right on mobile, inline on desktop */}
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleCopyUid}
        title={copied ? t('settings.copied') : t('settings.copyUid')}
        aria-label={t('settings.copyUid')}
        className="col-start-2 row-start-1 size-8.5 rounded-lg text-muted-foreground hover:bg-white/[0.08] hover:text-foreground active:scale-95 transition-all sm:shrink-0"
      >
        {copied ? (
          <Check className="size-3.5 stroke-[2.5] text-primary" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>

      {/* 4. Make Active button: full-width on mobile row 3, inline on desktop */}
      {!isActive && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setActiveAccount(account.id)}
          className="col-span-full row-start-3 h-8.5 w-full gap-1.5 rounded-lg border-white/10 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-[0.98] transition-all sm:w-auto sm:px-2.5 sm:shrink-0"
        >
          <Check className="size-3.5 stroke-[2.5]" />
          {t('settings.makeActive')}
        </Button>
      )}

      {/* 5. Delete dialog: top right on mobile, inline on desktop */}
      <div className="col-start-3 row-start-1 sm:shrink-0">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={deleteMutation.isPending}
              aria-label={t('settings.delete')}
              title={t('settings.delete')}
              className="size-8.5 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[calc(100vw-32px)] max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t('settings.deleteDialogTitle', { uid: account.uid })}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t('settings.deleteDialogDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
              <AlertDialogCancel className="w-full sm:w-auto">
                {t('settings.deleteCancel')}
              </AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => deleteMutation.mutate(account.id)}
              >
                {t('settings.deleteConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
