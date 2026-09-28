import { useState } from 'react'
import {
  LogIn,
  MonitorCog,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useCornerStyle } from '@/hooks/useCornerStyle'
import { useBgAnimation } from '@/hooks/useBgAnimation'
import { useCreateAccount, useDeleteMe, useMe } from '@/api/hooks'
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
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher'
import { LinkUidForm } from '@/components/settings/LinkUidForm'
import { ProxyAccountRow } from '@/components/settings/ProxyAccountRow'
import { ProxyAccountRowSkeleton } from '@/components/settings/ProxyAccountRowSkeleton'
import {
  SegmentedControl,
  type SegmentedOption,
} from '@/components/settings/SegmentedControl'
import { SettingsRow } from '@/components/settings/SettingsRow'
import { SettingsSection } from '@/components/settings/SettingsSection'
import { Switch } from '@/components/ui/switch'
import { useActiveAccount } from '@/hooks/useActiveAccount'
import { cn } from '@/lib/utils'
import { UID_PATTERN } from '@/lib/uid'
import { MAX_ACCOUNTS } from '@/types'

type CornerStyleValue = 'rounded' | 'sharp'

/** Miniature of the real container shape, so the choice is self-explanatory. */
function CornerGlyph({ sharp }: { sharp: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-keep-rounded="true"
      className={cn(
        'size-3.5 shrink-0 border border-current transition-colors',
        sharp ? 'rounded-none' : 'rounded-[5px_5px_0_5px]'
      )}
    />
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const isAuthed = Boolean(me)
  const { activeAccount, accounts, isPending } = useActiveAccount({ enabled: isAuthed })
  const { isSharp, setCornerStyle } = useCornerStyle()
  const { isEnabled: isBgAnimEnabled, setBgAnimationMode } = useBgAnimation()
  const createMutation = useCreateAccount()
  const deleteMeMutation = useDeleteMe()

  const [uid, setUid] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const isMaxAccounts = accounts.length >= MAX_ACCOUNTS
  const uidIsValid = UID_PATTERN.test(uid)
  const errorMessage = submitted && !uidIsValid ? t('settings.uidError') : null

  const cornerOptions: readonly SegmentedOption<CornerStyleValue>[] = [
    {
      value: 'rounded',
      label: t('settings.cornerStyleRounded'),
      glyph: <CornerGlyph sharp={false} />,
    },
    {
      value: 'sharp',
      label: t('settings.cornerStyleSharp'),
      glyph: <CornerGlyph sharp />,
    },
  ]

  function handleUidChange(value: string) {
    setUid(value)
    if (submitted) setSubmitted(false)
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    if (!uidIsValid || isMaxAccounts) return
    createMutation.mutate(
      { uid: uid.trim() },
      {
        onSuccess: () => {
          setUid('')
          setSubmitted(false)
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-1 border-b border-white/[0.08] pb-4">
        <h1 className="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {t('settings.title')}
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          {t('settings.subtitle')}
        </p>
      </div>

      {/* 01 — Interface: language, corner geometry, background animation */}
      <SettingsSection
        index="01"
        title={t('settings.interfaceTitle')}
        icon={MonitorCog}
      >
        <div className="divide-y divide-white/[0.05]">
          <SettingsRow
            label={t('settings.languageTitle')}
            control={
              <LanguageSwitcher variant="select" align="end" className="w-full sm:w-auto" />
            }
          />

          <SettingsRow
            label={t('settings.cornerStyleTitle')}
            control={
              <SegmentedControl
                options={cornerOptions}
                value={isSharp ? 'sharp' : 'rounded'}
                onValueChange={setCornerStyle}
                ariaLabel={t('settings.cornerStyleTitle')}
              />
            }
          />

          <SettingsRow
            label={t('settings.bgAnimationTitle')}
            inline
            control={
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'font-mono text-xs font-medium transition-colors',
                    isBgAnimEnabled ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {isBgAnimEnabled
                    ? t('settings.bgAnimationEnabled')
                    : t('settings.bgAnimationDisabled')}
                </span>
                <Switch
                  checked={isBgAnimEnabled}
                  onCheckedChange={(checked) =>
                    setBgAnimationMode(checked ? 'enabled' : 'disabled')
                  }
                  aria-label={t('settings.bgAnimationTitle')}
                />
              </div>
            }
          />
        </div>
      </SettingsSection>

      {!isAuthed ? (
        <SettingsSection
          index="02"
          title={t('settings.accountsTitle')}
          icon={UsersRound}
        >
          <div className="flex flex-col items-center gap-3.5 py-8 text-center">
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-foreground"
            >
              <UsersRound className="size-5" />
            </span>
            <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
              {t('settings.guestAccountsNote')}
            </p>
            <Button asChild size="default" className="h-10 sm:h-9 w-full sm:w-auto gap-2">
              <Link to="/login">
                <LogIn className="size-4" />
                {t('settings.guestLoginButton')}
              </Link>
            </Button>
          </div>
        </SettingsSection>
      ) : (
        <SettingsSection
          index="02"
          title={t('settings.accountsTitle')}
          icon={UsersRound}
          action={
            <span
              className={cn(
                'inline-flex h-6 items-center gap-1 rounded-full border px-2.5 font-mono text-[11px] font-medium tabular-nums transition-colors',
                isMaxAccounts
                  ? 'border-warning/30 bg-warning/10 text-warning'
                  : 'border-white/10 bg-white/[0.04] text-muted-foreground'
              )}
            >
              {`${accounts.length} / ${MAX_ACCOUNTS}`}
            </span>
          }
          footer={
            <LinkUidForm
              uid={uid}
              onUidChange={handleUidChange}
              onSubmit={handleSubmit}
              errorMessage={errorMessage}
              isPending={createMutation.isPending}
              isMaxReached={isMaxAccounts}
            />
          }
        >
          {isPending ? (
            <div className="divide-y divide-white/[0.05]" aria-busy="true">
              <ProxyAccountRowSkeleton />
              <ProxyAccountRowSkeleton />
            </div>
          ) : accounts.length === 0 ? (
            <p className="py-6 text-center text-xs leading-relaxed text-muted-foreground">
              {t('settings.noAccounts')}
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.05]">
              {accounts.map((account) => (
                <li key={account.id}>
                  <ProxyAccountRow
                    account={account}
                    isActive={account.id === activeAccount?.id}
                  />
                </li>
              ))}
            </ul>
          )}
        </SettingsSection>
      )}

      {isAuthed && (
        <section aria-label={t('settings.deleteAccountTitle')}>
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3.5 sm:px-5 sm:py-4 transition-colors">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div className="min-w-0 space-y-0.5">
                <span className="block text-sm font-semibold text-destructive tracking-tight">
                  {t('settings.deleteAccountTitle')}
                </span>
                <p className="max-w-md text-xs leading-relaxed text-muted-foreground/90">
                  {t('settings.deleteAccountDesc')}
                </p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={deleteMeMutation.isPending}
                    className="h-9 sm:h-8 w-full sm:w-auto shrink-0 gap-1.5"
                  >
                    <Trash2 className="size-4" />
                    {deleteMeMutation.isPending
                      ? t('settings.deletingAccount')
                      : t('settings.deleteAccountButton')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[calc(100vw-32px)] max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('settings.deleteAccountDialogTitle')}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('settings.deleteAccountDialogDesc')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-col-reverse gap-2 sm:flex-row">
                    <AlertDialogCancel className="w-full sm:w-auto">
                      {t('settings.deleteAccountCancel')}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        deleteMeMutation.mutate(undefined, {
                          onSuccess: () => {
                            navigate('/', { replace: true })
                          },
                        })
                      }}
                    >
                      {t('settings.deleteAccountConfirm')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
