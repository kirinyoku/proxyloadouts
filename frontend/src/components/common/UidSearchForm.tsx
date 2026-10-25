import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export interface UidSearchFormProps {
  uidInput: string
  isUidValid?: boolean
  onUidInputChange: (value: string) => void
  onScan: (uid: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  searchButtonTitle?: string
  searchButtonAria?: string
}

export function UidSearchForm({
  uidInput,
  isUidValid,
  onUidInputChange,
  onScan,
  placeholder,
  className,
  inputClassName,
  searchButtonTitle,
  searchButtonAria,
}: UidSearchFormProps) {
  const { t } = useTranslation()
  const valid = isUidValid ?? (uidInput.trim().length >= 8)

  return (
    <form
      className={cn(
        'flex h-8 items-center gap-1.5 rounded-[10px_10px_0_10px] border-2 border-black bg-elevated pr-1 pl-2.5 shadow-[inset_0_0_0_1px_var(--border),0_2px_8px_-4px_rgba(0,0,0,0.5)] transition-shadow focus-within:shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--primary)_70%,transparent),0_0_14px_-4px_color-mix(in_oklch,var(--primary)_35%,transparent)]',
        className
      )}
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onScan(uidInput)
      }}
      noValidate
    >
      <input
        name="uid"
        inputMode="numeric"
        placeholder={placeholder ?? t('showcase.searchPlaceholder')}
        value={uidInput}
        onChange={(event) => onUidInputChange(event.target.value.replace(/\D/g, '').slice(0, 10))}
        autoComplete="off"
        aria-label={t('home.uidAria')}
        className={cn(
          'min-w-0 flex-1 bg-transparent font-mono text-xs tracking-wide text-foreground outline-none placeholder:text-muted-foreground/70',
          inputClassName
        )}
      />

      {uidInput.length > 0 && (
        <button
          type="button"
          onClick={() => onUidInputChange('')}
          title={t('common.clear')}
          aria-label={t('common.clear')}
          className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground active:scale-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <X className="size-3" />
        </button>
      )}

      <button
        type="submit"
        title={searchButtonTitle ?? t('showcase.searchTitle')}
        aria-label={searchButtonAria ?? t('showcase.searchAria')}
        disabled={!valid}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px_6px_0_6px] border border-black bg-primary text-primary-foreground shadow-[inset_0_0_0_1px_var(--primary),inset_0_0_0_2px_rgba(0,0,0,0.85)] transition-[filter,transform] hover:brightness-105 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background"
      >
        <Search className="size-3.5" />
      </button>
    </form>
  )
}
