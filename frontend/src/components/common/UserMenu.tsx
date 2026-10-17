import { Check, ChevronDown, Globe, LogOut, Settings, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLogout, useMe } from '@/api/hooks'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { changeLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n'
import { useActiveAccount } from '@/hooks/useActiveAccount'
import { useAccountStore } from '@/store/useAccountStore'
import { cn } from '@/lib/utils'
import { getRegionShortCode } from '@/lib/uid'
import { MAX_ACCOUNTS, type GameAccount } from '@/types'

export function UserMenu() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: me } = useMe()
  const { activeAccount, accounts } = useActiveAccount()
  const setActiveAccount = useAccountStore((state) => state.setActiveAccount)
  const logoutMutation = useLogout()
  const currentLang = (i18n.language.slice(0, 2) as SupportedLanguage) === 'en' ? 'en' : 'ru'

  function handleSelectAccount(account: GameAccount) {
    setActiveAccount(account.id)
    if (location.pathname === '/showcase') {
      navigate(`/showcase?uid=${account.uid}`)
    }
  }

  if (!me) return null

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSuccess: () => navigate('/login', { replace: true }),
    })
  }

  const user = me.user

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex h-9.5 cursor-pointer items-center gap-2 rounded-[10px_10px_0_10px] border-2 border-black bg-card px-2 py-1 transition-all outline-none select-none',
            'hover:border-white/30 hover:bg-elevated focus-visible:border-primary/80 focus-visible:ring-2 focus-visible:ring-primary/40',
            'data-[state=open]:border-primary/80 data-[state=open]:bg-elevated'
          )}
        >
          {/* Avatar with ZZZ-style border */}
          <div className="relative shrink-0">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                width={26}
                height={26}
                loading="eager"
                decoding="async"
                className="size-6.5 rounded-full border-1.5 border-black object-cover ring-1 ring-white/10"
              />
            ) : (
              <span className="flex size-6.5 items-center justify-center rounded-full border-1.5 border-black bg-elevated text-muted-foreground ring-1 ring-white/10">
                <UserRound className="size-3.5" />
              </span>
            )}
            <span className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full border border-black bg-primary" />
          </div>

          {/* User info snippet */}
          <div className="flex min-w-0 flex-col text-left">
            <span className="max-w-28 truncate font-heading text-xs font-bold leading-tight tracking-wide text-foreground sm:max-w-32">
              {user.username}
            </span>
            <span className="max-w-28 truncate font-mono text-[10px] leading-tight text-muted-foreground sm:max-w-32">
              {activeAccount ? (
                <>
                  <span className="font-semibold text-primary/90">{activeAccount.uid}</span>
                  <span className="text-muted-foreground/90 uppercase"> · {getRegionShortCode(activeAccount.region)}</span>
                </>
              ) : (
                t('userMenu.noUid')
              )}
            </span>
          </div>

          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground [[data-state=open]>&]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        {/* User Identity Header */}
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-heading text-xs font-bold tracking-wide text-foreground">
              {user.username}
            </span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {accounts.length > 0
                ? t('userMenu.accountsCount', { count: accounts.length })
                : t('userMenu.noAccounts')}
            </span>
          </div>
          <span className="font-mono text-[9px] font-semibold tracking-wider text-primary/70 uppercase">
            // PROXY
          </span>
        </div>

        <DropdownMenuSeparator />

        {/* Game Accounts Selector */}
        <DropdownMenuLabel className="flex items-center justify-between text-[10px] text-muted-foreground/80">
          <span>{t('userMenu.accounts')}</span>
          {accounts.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground/60">
              {`${accounts.length} / ${MAX_ACCOUNTS}`}
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuGroup>
          {accounts.length === 0 ? (
            <div className="px-2.5 py-2 text-center font-mono text-xs text-muted-foreground">
              {t('userMenu.noAccounts')}
            </div>
          ) : (
            accounts.map((account) => {
              const isActive = account.id === activeAccount?.id
              return (
                <DropdownMenuItem
                  key={account.id}
                  onClick={() => handleSelectAccount(account)}
                  className={cn(
                    'justify-between font-mono cursor-pointer',
                    isActive && 'bg-white/[0.08] text-foreground font-bold'
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2 truncate">
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        isActive
                          ? 'bg-primary shadow-[0_0_6px_color-mix(in_oklch,var(--primary)_80%,transparent)]'
                          : 'bg-muted-foreground/30'
                      )}
                    />
                    <span className="truncate">{account.uid}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">
                      · {getRegionShortCode(account.region)}
                    </span>
                  </div>
                  {isActive && <Check className="size-3.5 text-primary stroke-[2.5]" />}
                </DropdownMenuItem>
              )
            })
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* Navigation & Preferences */}
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/settings" className="flex items-center gap-2 cursor-pointer">
              <Settings className="size-3.5" />
              <span>{t('userMenu.settings')}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <div className="flex items-center gap-2">
                <Globe className="size-3.5" />
                <span>{t('userMenu.language')}</span>
              </div>
              <span className="ml-auto mr-1 font-mono text-[10px] font-bold text-muted-foreground/80 uppercase">
                {currentLang}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-44">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = currentLang === lang.code
                return (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => void changeLanguage(lang.code)}
                    className={cn(
                      'justify-between font-mono cursor-pointer',
                      isSelected && 'bg-white/[0.08] text-foreground font-bold'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex h-4.5 w-6 shrink-0 items-center justify-center rounded-[5px_5px_0_5px] border text-[9px] font-bold uppercase transition-colors',
                          isSelected
                            ? 'border-primary/60 bg-primary/20 text-primary shadow-[0_0_6px_color-mix(in_oklch,var(--primary)_20%,transparent)]'
                            : 'border-white/10 bg-white/5 text-muted-foreground'
                        )}
                      >
                        {lang.short}
                      </span>
                      <span className="truncate font-sans text-xs">{lang.label}</span>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary stroke-[2.5]" />}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        {/* System Actions */}
        <DropdownMenuGroup>
          <DropdownMenuItem
            variant="destructive"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="flex items-center gap-2 cursor-pointer"
          >
            <LogOut className="size-3.5" />
            <span>{t('userMenu.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
