import { AlertCircle, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { previewRegionFromUID } from '@/lib/uid'
import { cn } from '@/lib/utils'

interface LinkUidFormProps {
  uid: string
  onUidChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  errorMessage: string | null
  isPending: boolean
  isMaxReached: boolean
}

const UID_MAX_LENGTH = 10

/**
 * Inline "link a Proxy UID" form.
 *
 * Integrated composite input field with auto-detected server region chip
 * and live 10-digit counter, maintaining clean hierarchy and strict accessibility.
 */
export function LinkUidForm({
  uid,
  onUidChange,
  onSubmit,
  errorMessage,
  isPending,
  isMaxReached,
}: LinkUidFormProps) {
  const { t } = useTranslation()
  const detectedRegion = previewRegionFromUID(uid)
  const showCounter = uid.length > 0 && !detectedRegion

  if (isMaxReached) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/5 px-3.5 py-3 text-xs leading-relaxed text-warning">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{t('settings.limitReachedAlert')}</span>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2.5">
      <Label
        htmlFor="uid"
        className="flex items-center gap-1.5 text-xs font-semibold text-foreground"
      >
        <Plus className="size-3.5 text-primary" />
        {t('settings.addAccountTitle')}
      </Label>

      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Input
            id="uid"
            name="uid"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={UID_MAX_LENGTH}
            placeholder={t('settings.uidPlaceholder')}
            value={uid}
            onChange={(event) => onUidChange(event.target.value.replace(/\D/g, ''))}
            aria-invalid={Boolean(errorMessage)}
            aria-describedby={errorMessage ? 'uid-hint' : undefined}
            autoComplete="off"
            className={cn(
              'h-10 sm:h-9.5 rounded-lg border-white/10 bg-black/30 pr-3 font-mono text-base sm:text-sm tabular-nums transition-colors focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/40',
              (detectedRegion || showCounter) && 'pr-24'
            )}
          />

          {detectedRegion && (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-primary/30 bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-primary uppercase">
              {detectedRegion}
            </span>
          )}

          {showCounter && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] tabular-nums text-muted-foreground/70">
              {`${uid.length} / ${UID_MAX_LENGTH}`}
            </span>
          )}
        </div>

        <Button
          type="submit"
          disabled={isPending}
          loading={isPending}
          className="h-10 sm:h-9.5 w-full shrink-0 rounded-lg px-4 text-xs font-medium sm:w-auto"
        >
          {isPending ? t('settings.adding') : t('settings.addAccountButton')}
        </Button>
      </div>

      {errorMessage && (
        <p id="uid-hint" role="alert" className="text-xs font-medium text-destructive">
          {errorMessage}
        </p>
      )}
    </form>
  )
}
