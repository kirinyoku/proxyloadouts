import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { countNoteRunes, NOTE_MAX_RUNES } from './note-model'

type NoteDraftFieldProps = {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}

export function NoteDraftField({ id, label, placeholder, value, onChange }: NoteDraftFieldProps) {
  const { t } = useTranslation()
  const errorId = useId()
  const count = countNoteRunes(value.trim())
  const isOverLimit = count > NOTE_MAX_RUNES

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-semibold text-foreground">{label}</Label>
        <span className={cn('shrink-0 text-xs tabular-nums text-muted-foreground', isOverLimit && 'text-destructive')}>
          {count} / {NOTE_MAX_RUNES}
        </span>
      </div>
      <Textarea
        id={id}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        aria-invalid={isOverLimit || undefined}
        aria-describedby={isOverLimit ? errorId : undefined}
        className="min-h-20 max-h-40 resize-none max-sm:text-base"
      />
      {isOverLimit && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {t('notes.overLimitError', { max: NOTE_MAX_RUNES })}
        </p>
      )}
    </div>
  )
}
