import { useState } from 'react'
import { BadgeCheck, Check, ShieldCheck, Trash2, UserRound } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { RegionBadge, UidCopyChip } from '@/components/showcase/ShowcaseProfileHeader'
import { useDeleteAccount, useUpdateAccount } from '@/api/hooks'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAccountStore } from '@/store/useAccountStore'
import type { GameAccount } from '@/types'
import { VerifyUidDialog } from './VerifyUidDialog'

interface ProxyAccountRowProps {
  account: GameAccount
  isActive: boolean
}

/**
 * Account row card:
 * - Upper bar: avatar with active indicator + nickname & server badge & verified check + mono UID copy chip on left; active indicator / make active button + delete action on right
 * - Lower section:
 *   - If verified: 3-column responsive cardlet grid with compact visibility switches (roster, squads, discord)
 *   - If unverified: callout box with explanation and verify UID button opening verification modal
 *   - Footer: date added
 */
export function ProxyAccountRow({ account, isActive }: ProxyAccountRowProps) {
  const { t } = useTranslation()
  const setActiveAccount = useAccountStore((state) => state.setActiveAccount)
  const deleteMutation = useDeleteAccount()
  const updateAccountMutation = useUpdateAccount()

  const [verifyOpen, setVerifyOpen] = useState(false)

  const isVerified = Boolean(account.verified_at)
  const displayName = account.nickname || account.uid

  return (
    <div
      data-slot="proxy-account-row"
      data-active={isActive}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border p-3.5 sm:p-4 transition-all',
        isActive
          ? 'border-primary/45 bg-primary/[0.035] shadow-[0_0_20px_-4px_color-mix(in_oklch,var(--primary)_20%,transparent)] ring-1 ring-primary/30'
          : 'border-white/[0.08] bg-white/[0.015] hover:border-white/15 hover:bg-white/[0.03]'
      )}
    >
      {/* Upper bar: identity on the left, actions on the right */}
      <div className="flex items-start sm:items-center justify-between gap-2.5">
        {/* Left: avatar, nickname, verified indicator, UID, region, copy button */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {account.avatar_url ? (
              <img
                src={account.avatar_url}
                alt=""
                width={38}
                height={38}
                className={cn(
                  'size-9.5 rounded-full object-cover transition-all',
                  isActive
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    : 'border border-white/10 ring-1 ring-white/10'
                )}
              />
            ) : (
              <div
                className={cn(
                  'flex size-9.5 items-center justify-center rounded-full text-muted-foreground transition-all',
                  isActive
                    ? 'border border-primary/40 bg-primary/10 text-primary ring-2 ring-primary/40 ring-offset-2 ring-offset-background'
                    : 'border border-white/10 bg-white/[0.05] ring-1 ring-white/10'
                )}
              >
                <UserRound className="size-4.5" />
              </div>
            )}
            <span
              aria-hidden="true"
              className={cn(
                'absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full transition-colors ring-2 ring-background',
                isActive
                  ? 'bg-primary shadow-[0_0_8px_color-mix(in_oklch,var(--primary)_90%,transparent)]'
                  : 'bg-white/20'
              )}
            />
          </div>

          <div className="flex flex-col min-w-0 gap-1">
            <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
              <span className="truncate font-heading font-semibold text-sm text-foreground tracking-tight">
                {displayName}
              </span>

              {account.region && (
                <RegionBadge region={account.region} className="shrink-0" />
              )}

              {isVerified && (
                <span
                  title={t('settings.verifiedBadge')}
                  aria-label={t('settings.verifiedBadge')}
                  className="inline-flex items-center text-emerald-400 shrink-0"
                >
                  <BadgeCheck className="size-4 shrink-0 fill-emerald-500/20 text-emerald-400 inline-flex items-center" />
                  <span className="sr-only">{t('settings.verifiedBadge')}</span>
                </span>
              )}
            </div>

            <div className="flex items-center min-w-0">
              <UidCopyChip
                uid={account.uid}
                title={t('settings.copyUid')}
                ariaLabel={t('settings.copyUid')}
              />
            </div>
          </div>
        </div>

        {/* Right: active indicator or make active, delete */}
        <div className="shrink-0 flex items-center gap-1.5 ml-auto">
          {isActive ? (
            <span className="sr-only">{t('settings.activeBadge')}</span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveAccount(account.id)}
              className="h-7 gap-1 rounded-lg border-white/10 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-[0.98] transition-all px-2"
            >
              <Check className="size-3 stroke-[2.5]" />
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
                className="size-7 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all"
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

      {/* Lower section: Visibility & Privacy or Verification callout */}
      {isVerified ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5 border-t border-white/[0.04]">
          {/* Toggle 1: Public roster */}
          <label className="flex items-center justify-between gap-2.5 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 cursor-pointer hover:border-white/12 hover:bg-black/35 transition-colors select-none">
            <span className="text-[11.5px] font-medium text-muted-foreground">
              {t('settings.publicRoster')}
            </span>
            <Switch
              size="sm"
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
          </label>

          {/* Toggle 2: Public teams */}
          <label className="flex items-center justify-between gap-2.5 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 cursor-pointer hover:border-white/12 hover:bg-black/35 transition-colors select-none">
            <span className="text-[11.5px] font-medium text-muted-foreground">
              {t('settings.publicTeams')}
            </span>
            <Switch
              size="sm"
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
          </label>

          {/* Toggle 3: Show Discord */}
          <label className="flex items-center justify-between gap-2.5 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-1.5 cursor-pointer hover:border-white/12 hover:bg-black/35 transition-colors select-none">
            <span className="text-[11.5px] font-medium text-muted-foreground">
              {t('settings.showDiscord')}
            </span>
            <Switch
              size="sm"
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
          </label>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 border-t border-white/[0.04] mt-0.5">
          <div className="flex items-start gap-2.5 min-w-0">
            <ShieldCheck className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-foreground">
                {t('settings.verifyDialogTitle')}
              </span>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {t('settings.verifyDialogDesc')}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVerifyOpen(true)}
            className="h-8 shrink-0 gap-1.5 rounded-lg border-primary/40 bg-primary/10 text-xs font-semibold text-primary hover:bg-primary/20 hover:border-primary/60 transition-all self-start sm:self-center"
          >
            <ShieldCheck className="size-3.5 text-primary" />
            <span>{t('settings.verifyUidButton')}</span>
          </Button>
        </div>
      )}

      {/* Footer row: Date added */}
      <div className="flex items-center justify-between pt-0.5 text-[11px] text-muted-foreground/60">
        <span>{t('settings.addedAt', { date: formatDate(account.created_at) })}</span>
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
