import { useState } from 'react'
import { BadgeCheck, Check, Copy, ShieldCheck, Trash2, UserRound } from 'lucide-react'
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
import { Switch } from '@/components/ui/switch'
import { useDeleteAccount, useUpdateAccount } from '@/api/hooks'
import { formatDate } from '@/lib/format'
import { getRegionShortCode } from '@/lib/uid'
import { cn } from '@/lib/utils'
import { useAccountStore } from '@/store/useAccountStore'
import type { GameAccount } from '@/types'
import { VerifyUidDialog } from './VerifyUidDialog'

interface ProxyAccountRowProps {
  account: GameAccount
  isActive: boolean
}

/**
 * Account row:
 * - Upper bar: avatar + nickname + mono UID & region + active/verified badges + copy / active / delete actions
 * - Secondary section:
 *   - If verified: public roster, public teams & discord visibility toggles
 *   - If unverified: verify UID button opening verification modal
 */
export function ProxyAccountRow({ account, isActive }: ProxyAccountRowProps) {
  const { t } = useTranslation()
  const setActiveAccount = useAccountStore((state) => state.setActiveAccount)
  const deleteMutation = useDeleteAccount()
  const updateAccountMutation = useUpdateAccount()

  const [copied, setCopied] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)

  const regionCode = getRegionShortCode(account.region)
  const isVerified = Boolean(account.verified_at)
  const displayName = account.nickname || account.uid

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
        'group flex flex-col gap-2.5 px-4 py-3 transition-colors sm:px-5 sm:py-3',
        isActive ? 'bg-primary/[0.04]' : 'hover:bg-white/[0.02]',
      )}
    >
      {/* Upper bar: identity on the left, actions on the right */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: avatar, nickname, UID, region, badges */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {account.avatar_url ? (
              <img
                src={account.avatar_url}
                alt=""
                width={36}
                height={36}
                className="size-9 rounded-full border border-white/10 object-cover ring-1 ring-white/10"
              />
            ) : (
              <div className="flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-muted-foreground ring-1 ring-white/10">
                <UserRound className="size-4" />
              </div>
            )}
            <span
              aria-hidden="true"
              className={cn(
                'absolute -right-0.5 -bottom-0.5 size-2 rounded-full transition-colors',
                isActive
                  ? 'bg-primary shadow-[0_0_8px_color-mix(in_oklch,var(--primary)_70%,transparent)]'
                  : 'bg-white/20',
              )}
            />
          </div>

          <div className="flex flex-col min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <span className="truncate font-heading text-sm font-bold text-foreground">
                {displayName}
              </span>

              {isActive && (
                <Badge className="h-5 gap-1 border border-primary/30 bg-primary/15 px-2 text-[10px] font-medium text-primary uppercase">
                  {t('settings.activeBadge')}
                </Badge>
              )}

              {isVerified && (
                <Badge
                  variant="outline"
                  className="h-5 gap-1 border-emerald-500/40 bg-emerald-500/15 px-2 text-[10px] font-semibold text-emerald-400 uppercase shadow-xs"
                >
                  <BadgeCheck className="size-3 text-emerald-400 shrink-0" />
                  <span>{t('settings.verifiedBadge')}</span>
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground tabular-nums">
              <span>{account.uid}</span>
              {regionCode && (
                <span
                  title={account.region}
                  className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.2 font-mono text-[10px] font-medium text-muted-foreground uppercase"
                >
                  {regionCode}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: copy, make active, delete */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleCopyUid}
            title={copied ? t('settings.copied') : t('settings.copyUid')}
            aria-label={t('settings.copyUid')}
            className="size-8 rounded-lg text-muted-foreground hover:bg-white/[0.08] hover:text-foreground active:scale-95 transition-all"
          >
            {copied ? (
              <Check className="size-3.5 stroke-[2.5] text-primary" />
            ) : (
              <Copy className="size-3.5" />
            )}
          </Button>

          {!isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveAccount(account.id)}
              className="h-8 gap-1.5 rounded-lg border-white/10 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-[0.98] transition-all px-2.5"
            >
              <Check className="size-3.5 stroke-[2.5]" />
              {t('settings.makeActive')}
            </Button>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={deleteMutation.isPending}
                aria-label={t('settings.delete')}
                title={t('settings.delete')}
                className="size-8 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all"
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

      {/* Added date & Verification / Privacy options section */}
      <div className="flex flex-col gap-2 pt-1 border-t border-white/[0.04] sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-muted-foreground/70">
          {t('settings.addedAt', { date: formatDate(account.created_at) })}
        </p>

        {isVerified ? (
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {/* Toggle 1: Public roster */}
            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground select-none">
              <Switch
                checked={Boolean(account.is_public_roster ?? account.is_public_showcase)}
                disabled={updateAccountMutation.isPending}
                onCheckedChange={(checked) =>
                  updateAccountMutation.mutate({
                    id: account.id,
                    is_public_roster: checked,
                  })
                }
                aria-label={t('settings.publicRoster')}
              />
              <span className="text-[11.5px] font-medium">{t('settings.publicRoster')}</span>
            </label>

            {/* Toggle 2: Public teams */}
            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground select-none">
              <Switch
                checked={Boolean(account.is_public_teams ?? account.is_public_showcase)}
                disabled={updateAccountMutation.isPending}
                onCheckedChange={(checked) =>
                  updateAccountMutation.mutate({
                    id: account.id,
                    is_public_teams: checked,
                  })
                }
                aria-label={t('settings.publicTeams')}
              />
              <span className="text-[11.5px] font-medium">{t('settings.publicTeams')}</span>
            </label>

            {/* Toggle 3: Show Discord */}
            <label className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground select-none">
              <Switch
                checked={Boolean(account.show_discord)}
                disabled={updateAccountMutation.isPending}
                onCheckedChange={(checked) =>
                  updateAccountMutation.mutate({
                    id: account.id,
                    show_discord: checked,
                  })
                }
                aria-label={t('settings.showDiscord')}
              />
              <span className="text-[11.5px] font-medium">{t('settings.showDiscord')}</span>
            </label>
          </div>
        ) : (
          <div className="flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVerifyOpen(true)}
              className="h-7.5 gap-1.5 rounded-lg border-primary/40 bg-primary/5 text-xs font-semibold text-primary hover:bg-primary/15 hover:border-primary/60 transition-all"
            >
              <ShieldCheck className="size-3.5 text-primary" />
              <span>{t('settings.verifyUidButton')}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Verification Dialog modal */}
      <VerifyUidDialog
        account={account}
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
      />
    </div>
  )
}
