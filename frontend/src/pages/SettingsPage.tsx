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
import { useColorPalette } from '@/hooks/useColorPalette'
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
import type { ColorPalette } from '@/lib/color-palette'
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

const PALETTE_SWATCH_CONFIG: Record<
  ColorPalette,
  {
    primaryHex: string
    secondaryHex: string
    activeRingClass: string
  }
> = {
  acid: {
    primaryHex: '#c9f24b',
    secondaryHex: '#1b2430',
    activeRingClass: 'border-[#c9f24b]/60 bg-white/[0.08] ring-1 ring-[#c9f24b]/50 shadow-xs',
  },
  champagne: {
    primaryHex: '#eab308',
    secondaryHex: '#5c4028',
    activeRingClass: 'border-[#eab308]/60 bg-white/[0.08] ring-1 ring-[#eab308]/50 shadow-xs',
  },
}

/**
 * Rectangular dual-tone swatch wells housed in a control track matching
 * SegmentedControl height (`h-9 sm:h-8` inside `p-1`). Corners adapt
 * automatically to `[data-corners="sharp"]`.
 */
function PaletteSwatchWells({
  options,
  value,
  onValueChange,
  ariaLabel,
}: {
  options: readonly { value: ColorPalette; label: string }[]
  value: ColorPalette
  onValueChange: (value: ColorPalette) => void
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-slot="palette-wells"
      className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-black/35 p-1"
    >
      {options.map((option) => {
        const isSelected = option.value === value
        const config = PALETTE_SWATCH_CONFIG[option.value]

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            title={option.label}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'group relative flex h-9 w-14 sm:h-8 sm:w-12 shrink-0 items-center justify-center rounded-md border p-1.5 transition-all duration-150 outline-none select-none active:scale-[0.97]',
              'focus-visible:ring-2 focus-visible:ring-primary/60',
              isSelected
                ? config.activeRingClass
                : 'border-transparent opacity-55 hover:border-white/10 hover:bg-white/[0.04] hover:opacity-100'
            )}
          >
            <span
              aria-hidden="true"
              data-palette-swatch={option.value}
              className="flex h-full w-full overflow-hidden rounded-[4px] ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_1px_2px_rgba(0,0,0,0.5)] [forced-color-adjust:none]"
            >
              <span
                className="h-full w-1/2"
                style={{ backgroundColor: config.primaryHex }}
              />
              <span
                className="h-full w-1/2"
                style={{ backgroundColor: config.secondaryHex }}
              />
            </span>
            <span className="sr-only">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function SettingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const isAuthed = Boolean(me)
  const { activeAccount, accounts, isPending } = useActiveAccount({ enabled: isAuthed })
  const { colorPalette, setColorPalette } = useColorPalette()
  const { isSharp, setCornerStyle } = useCornerStyle()
  const { isEnabled: isBgAnimEnabled, setBgAnimationMode } = useBgAnimation()
  const createMutation = useCreateAccount()
  const deleteMeMutation = useDeleteMe()

  const [uid, setUid] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const isMaxAccounts = accounts.length >= MAX_ACCOUNTS
  const uidIsValid = UID_PATTERN.test(uid)
  const errorMessage = submitted && !uidIsValid ? t('settings.uidError') : null

  const paletteOptions: readonly { value: ColorPalette; label: string }[] = [
    {
      value: 'acid',
      label: t('settings.colorPaletteAcid'),
    },
    {
      value: 'champagne',
      label: t('settings.colorPaletteChampagne'),
    },
  ]

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

      {/* 01 — Interface: language, color palette, corner geometry, background animation */}
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
            label={t('settings.colorPaletteTitle')}
            inline
            control={
              <PaletteSwatchWells
                options={paletteOptions}
                value={colorPalette}
                onValueChange={setColorPalette}
                ariaLabel={t('settings.colorPaletteTitle')}
              />
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
                'inline-flex h-6 items-center gap-1 rounded-4xl border px-2.5 font-mono text-[11px] font-medium tabular-nums transition-colors',
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
          <div className="relative overflow-hidden rounded-2xl border border-destructive/40 bg-card px-4 py-3.5 sm:px-5 sm:py-4 transition-colors">
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-destructive/10" />
            <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
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
