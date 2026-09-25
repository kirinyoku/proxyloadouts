import { Check, ChevronDown, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { changeLanguage, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

interface LanguageSwitcherProps {
  className?: string
  variant?: 'header' | 'select' | 'compact'
  align?: 'start' | 'end' | 'center'
}

export function LanguageSwitcher({
  className,
  variant = 'header',
  align = 'end',
}: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation()
  const currentLang = (i18n.language.slice(0, 2) as SupportedLanguage) === 'en' ? 'en' : 'ru'
  const currentOption =
    SUPPORTED_LANGUAGES.find((item) => item.code === currentLang) ??
    SUPPORTED_LANGUAGES[0] ?? {
      code: 'ru',
      label: 'Русский',
      short: 'RU',
    }

  function handleSelect(lang: SupportedLanguage) {
    if (lang !== currentLang) {
      void changeLanguage(lang)
    }
  }

  const isFull = variant === 'select'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('languageSwitcher.ariaWithCurrent', {
            label: currentOption.label,
            short: currentOption.short,
          })}
          className={cn(
            'group flex h-10 sm:h-9 cursor-pointer items-center justify-between gap-2.5 rounded-lg border border-white/10 bg-black/35 px-3 py-1 transition-all outline-none select-none active:bg-black/60',
            'hover:border-white/20 hover:bg-black/50 focus-visible:border-primary/80 focus-visible:ring-2 focus-visible:ring-primary/40',
            'data-[state=open]:border-primary/60 data-[state=open]:bg-black/50',
            isFull ? 'w-full sm:w-auto sm:min-w-44' : 'min-w-[76px]',
            className
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Globe className="size-3.5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            {isFull ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs font-medium text-foreground">
                  {currentOption.label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground uppercase">
                  ({currentOption.short})
                </span>
              </div>
            ) : (
              <span className="font-mono text-xs font-medium text-foreground uppercase">
                {currentOption.short}
              </span>
            )}
          </div>

          <ChevronDown className="size-3 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:text-foreground [[data-state=open]>&]:rotate-180" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        sideOffset={8}
        className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-44 sm:w-48 rounded-xl border border-white/10 bg-popover/95 p-1 backdrop-blur-md shadow-xl"
      >
        <DropdownMenuLabel className="px-2 py-1 text-[10px] font-medium text-muted-foreground">
          {t('settings.languageTitle')}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1 bg-white/[0.08]" />

        <DropdownMenuGroup>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = currentLang === lang.code
            return (
              <DropdownMenuItem
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={cn(
                  'flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 sm:px-2.5 sm:py-1.5 text-xs cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-white/[0.06] active:bg-white/[0.1]'
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      'flex h-5 w-6 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-semibold uppercase transition-colors',
                      isSelected
                        ? 'border-primary/40 bg-primary/20 text-primary'
                        : 'border-white/10 bg-white/[0.04] text-muted-foreground'
                    )}
                  >
                    {lang.short}
                  </span>
                  <span className="truncate text-xs font-medium">{lang.label}</span>
                </div>
                {isSelected && (
                  <Check className="size-3.5 shrink-0 text-primary stroke-[2.5]" />
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
