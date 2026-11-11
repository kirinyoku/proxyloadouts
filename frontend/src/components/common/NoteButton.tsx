import { useState } from 'react'
import { NotebookText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type NoteButtonProps = {
  note: string | null | undefined
  title: string
  subtitle?: string
  className?: string
} & (
  | { readOnly: true }
  | { readOnly?: false; onSave: (next: string | null) => Promise<unknown>; isSaving: boolean }
)

export type NoteSavePlan = { kind: 'unchanged' } | { kind: 'save'; value: string | null }

// oxlint-disable-next-line react/only-export-components
export function planNoteSave(draft: string, note: string | null | undefined): NoteSavePlan {
  const trimmedDraft = draft.trim()
  const trimmedNote = (note ?? '').trim()
  if (trimmedDraft === trimmedNote) {
    return { kind: 'unchanged' }
  }
  return { kind: 'save', value: trimmedDraft || null }
}

export function NoteButton(props: NoteButtonProps) {
  const { note, title, subtitle, className } = props
  const { t } = useTranslation()
  const trimmedNote = note?.trim() ?? ''

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(note ?? '')

  if (props.readOnly && !trimmedNote) {
    return null
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setDraft(note ?? '')
    }
  }

  const handleSave = async () => {
    if (props.readOnly) return
    const plan = planNoteSave(draft, note)
    if (plan.kind === 'unchanged') {
      setOpen(false)
      return
    }
    try {
      await props.onSave(plan.value)
      setOpen(false)
    } catch {
      // Keep dialog open on rejection
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t('notes.open')}
          title={trimmedNote || t('notes.add')}
          className={cn(
            'relative inline-flex size-9 sm:size-8 items-center justify-center rounded-full border border-white/[0.12] bg-card text-neutral-300 transition-colors hover:border-primary/50 hover:text-primary active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/60 outline-none cursor-pointer shrink-0',
            className,
          )}
        >
          <NotebookText className="size-4" />
          {trimmedNote && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-card"
            />
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="flex flex-col sm:max-w-lg sm:rounded-[22px_22px_0_22px] max-sm:top-auto max-sm:bottom-0 max-sm:left-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-w-none max-sm:w-full max-sm:rounded-[22px_22px_0_0] max-sm:max-h-[85dvh] max-sm:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <DialogHeader className="gap-1 text-left">
          <DialogTitle className="font-heading text-base truncate">
            {title}
          </DialogTitle>
          {subtitle ? (
            <DialogDescription className="truncate text-muted-foreground text-xs">
              {subtitle}
            </DialogDescription>
          ) : (
            <DialogDescription className="sr-only">
              {title}
            </DialogDescription>
          )}
        </DialogHeader>

        {props.readOnly ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-200 pl-3 border-l-2 border-primary/60 max-h-[60dvh] overflow-y-auto">
            {trimmedNote}
          </p>
        ) : (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault()
                  void handleSave()
                }
              }}
              placeholder={t('notes.placeholder')}
              maxLength={500}
              autoFocus
              className="border-y-0 border-r-0 border-l-2 border-white/15 focus:border-primary bg-transparent font-sans text-sm leading-relaxed min-h-40 sm:min-h-48 resize-none pl-3 outline-none transition-colors max-sm:flex-1 text-foreground placeholder:text-muted-foreground/50"
            />
            <div className="flex items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">{draft.length}/500</span>
                <span className="hidden sm:inline text-muted-foreground/60">
                  {t('notes.saveHint')}
                </span>
              </div>
              <Button
                type="button"
                onClick={handleSave}
                disabled={props.isSaving}
                className="h-8 px-4 text-xs font-semibold rounded-xl bg-primary text-black hover:bg-primary/90 cursor-pointer"
              >
                {t('notes.save')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
