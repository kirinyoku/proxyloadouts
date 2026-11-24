import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, Copy, Lock, LockOpen, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogClose, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { NOTE_MAX_RUNES, countNoteRunes, parseNoteBlocks } from './note-model'
import type { NoteModalAction, NoteModalState, NoteSubject } from './note-model'

type NoteSubjectHeaderProps = {
  subject: NoteSubject
  isSaving: boolean
}

function NoteAvatar({ src, name, className }: { src: string; name: string; className?: string }) {
  const [imgError, setImgError] = useState(false)

  return (
    <div aria-hidden="true" className={cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground', className)}>
      {(name || '?').charAt(0).toUpperCase()}
      {src && !imgError && (
        <img src={src} alt="" onError={() => setImgError(true)} className="absolute inset-0 size-full object-cover" />
      )}
    </div>
  )
}

export function NoteSubjectHeader({ subject, isSaving }: NoteSubjectHeaderProps) {
  const { t } = useTranslation()
  const subjectName = subject.name || (subject.kind === 'build' ? subject.agentName : '')
  const subtitle = subject.kind === 'build' && subject.agentName && subject.agentName !== subjectName
    ? `${subjectName} · ${subject.agentName}`
    : subjectName

  return (
    <DialogHeader className="shrink-0 flex-row items-center gap-2 sm:gap-2.5">
      {subject.kind === 'build' ? (
        <NoteAvatar
          key={subject.avatarUrl}
          src={subject.avatarUrl}
          name={subject.agentName || subjectName}
          className="size-8 border border-border/70"
        />
      ) : subject.members.length > 0 ? (
        <div className="flex shrink-0 items-center">
          {subject.members.slice(0, 3).map((member, index) => (
            <NoteAvatar
              key={`${index}-${member.avatarUrl}`}
              src={member.avatarUrl}
              name={member.agentName}
              className="-ml-2 size-8 border border-border/70 ring-2 ring-popover first:ml-0"
            />
          ))}
        </div>
      ) : null}
      <div className="grid min-w-0 flex-1">
        <DialogTitle className="truncate text-sm leading-[18px] sm:text-base">
          {t(subject.kind === 'build' ? 'notes.buildTitle' : 'notes.teamTitle')}
        </DialogTitle>
        <DialogDescription className="truncate text-xs leading-[14px]">{subtitle}</DialogDescription>
      </div>
      <DialogClose asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={isSaving}
          aria-label={t('notes.close')}
          className="text-muted-foreground max-sm:size-10"
        >
          <X />
        </Button>
      </DialogClose>
    </DialogHeader>
  )
}

type NoteEditorViewProps = {
  editor: Extract<NoteModalState, { kind: 'editing' }>
  dispatch: (action: NoteModalAction) => void
  onSubmit: () => void
  isSaving: boolean
}

export function NoteEditorView({ editor, dispatch, onSubmit, isSaving }: NoteEditorViewProps) {
  const { t } = useTranslation()
  const { draft, draftIsPublic, savePhase, saveFailed } = editor
  const textareaId = useId()
  const counterId = useId()
  const errorId = useId()
  const discardWarnId = useId()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const keepEditingRef = useRef<HTMLButtonElement>(null)
  const wasConfirmingRef = useRef(false)
  const lastCompositionEndRef = useRef<number | null>(null)
  const runes = countNoteRunes(draft.trim())
  const isOverLimit = runes > NOTE_MAX_RUNES
  const isConfirmDiscard = savePhase === 'confirm_discard'
  const isBlocked = isSaving || savePhase === 'saving' || isConfirmDiscard
  const VisibilityIcon = draftIsPublic ? LockOpen : Lock

  useEffect(() => {
    if (isConfirmDiscard) keepEditingRef.current?.focus()
    else if (wasConfirmingRef.current) textareaRef.current?.focus()
    wasConfirmingRef.current = isConfirmDiscard
  }, [isConfirmDiscard])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((!event.ctrlKey && !event.metaKey) || event.key !== 'Enter' || event.nativeEvent.isComposing) return
    if (lastCompositionEndRef.current !== null && event.timeStamp - lastCompositionEndRef.current < 50) return
    event.preventDefault()
    if (!isBlocked) onSubmit()
  }

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!isBlocked) onSubmit()
  }

  const noticeText = isOverLimit
    ? t('notes.overLimitError', { max: NOTE_MAX_RUNES })
    : saveFailed ? t('notes.saveError') : null

  return (
    <form className="flex min-h-0 flex-1 flex-col gap-3" onSubmit={handleFormSubmit}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <label htmlFor={textareaId} className="sr-only">{t('notes.editorLabel')}</label>
        <div className={cn(
          'overflow-hidden rounded-[10px_10px_0_10px] border bg-black/40 transition-colors',
          isOverLimit ? 'border-destructive' : 'border-white/10 focus-within:border-white/30',
        )}>
          <Textarea
            ref={textareaRef}
            data-note-input
            id={textareaId}
            value={draft}
            disabled={isSaving || savePhase === 'saving'}
            readOnly={isBlocked}
            onChange={(event) => dispatch({ type: 'set_draft', draft: event.target.value })}
            onCompositionEnd={(event) => { lastCompositionEndRef.current = event.timeStamp }}
            onKeyDown={handleKeyDown}
            placeholder={t('notes.placeholder')}
            aria-invalid={isOverLimit || undefined}
            aria-describedby={noticeText ? `${counterId} ${errorId}` : counterId}
            className="min-h-14 max-h-34 resize-none overflow-y-auto overscroll-contain rounded-none border-0 bg-transparent text-base leading-5 md:text-sm"
          />
          <span
            id={counterId}
            className={cn('block px-3 pb-2 text-right font-mono text-[11px] leading-4 tabular-nums text-muted-foreground', isOverLimit && 'font-medium text-destructive')}
          >
            {runes} / {NOTE_MAX_RUNES}
          </span>
        </div>
        {noticeText && <div id={errorId} role="alert" className="mt-3 flex items-start gap-2 text-xs leading-5 text-destructive"><AlertCircle className="mt-0.5 size-4 shrink-0" /><span>{noticeText}</span></div>}
      </div>
      <DialogFooter className="mb-0 shrink-0 flex-row items-center py-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {isConfirmDiscard ? (
          <div key="discard" className="flex w-full flex-wrap items-center justify-end gap-x-2 gap-y-1">
            <p id={discardWarnId} className="mr-auto basis-full text-xs leading-5 text-muted-foreground">{t('notes.unsavedWarning')}</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => dispatch({ type: 'confirm_discard' })} className="text-destructive hover:text-destructive max-sm:min-h-10">{t('notes.discard')}</Button>
            <Button ref={keepEditingRef} type="button" variant="outline" size="sm" onClick={() => dispatch({ type: 'cancel_discard' })} aria-describedby={discardWarnId} className="max-sm:min-h-10">{t('notes.keepEditing')}</Button>
          </div>
        ) : (
          <div key="actions" className="flex w-full items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={isBlocked}
              title={t(draftIsPublic ? 'notes.makePrivate' : 'notes.showToVisitors')}
              onClick={() => dispatch({ type: 'set_visibility', isPublic: !draftIsPublic })}
              className="max-sm:min-h-10"
            >
              <VisibilityIcon aria-hidden="true" className="size-4 shrink-0" />
              {t(draftIsPublic ? 'notes.pageVisitors' : 'notes.onlyMe')}
            </Button>
            <Button type="submit" size="sm" disabled={isBlocked} loading={isSaving} aria-label={t('notes.save')} aria-keyshortcuts="Control+Enter Meta+Enter" className="min-w-20 max-sm:min-h-10">
              {isSaving ? t('notes.saving') : t('notes.save')}
            </Button>
          </div>
        )}
      </DialogFooter>
    </form>
  )
}

export function NoteReadOnlyView({ note, showCopy }: { note: string; showCopy: boolean }) {
  const { t } = useTranslation()
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blocks = parseNoteBlocks(note)

  useEffect(() => () => {
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
  }, [])

  const handleCopy = async () => {
    if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current)
    try {
      await navigator.clipboard.writeText(note)
      setCopyStatus('copied')
      copyTimerRef.current = setTimeout(() => setCopyStatus('idle'), 2000)
    } catch {
      setCopyStatus('failed')
    }
  }

  return (
    <div className={cn(
      'flex min-h-0 flex-1 flex-col gap-3',
      !showCopy && 'pb-4 max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]',
    )}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-3 text-sm leading-6 [overflow-wrap:anywhere]">
          {blocks.map((block, index) => {
            switch (block.kind) {
              case 'rotation_chain':
                return (
                  <ol key={index} className="flex flex-wrap items-center gap-x-2 gap-y-1" aria-label={t('notes.rotation')}>
                    {block.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex min-w-0 items-center gap-2">
                        {stepIndex > 0 && <span aria-hidden="true" className="text-muted-foreground">→</span>}
                        <span className="min-w-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium leading-6">{step}</span>
                      </li>
                    ))}
                  </ol>
                )
              case 'advisory':
                return (
                  <div key={index} className="rounded-lg bg-muted/65 px-3 py-2.5">
                    <span className="text-xs font-semibold">[{block.tag}]</span>
                    <p className="mt-0.5">{block.text}</p>
                  </div>
                )
              case 'ordered_list':
                return (
                  <ol key={index} className="list-outside list-decimal space-y-1 pl-5 marker:text-muted-foreground">
                    {block.items.map((item, itemIndex) => <li key={itemIndex} className="pl-1">{item}</li>)}
                  </ol>
                )
              case 'bullet_list':
                return (
                  <ul key={index} className="list-outside list-disc space-y-1 pl-5 marker:text-muted-foreground">
                    {block.items.map((item, itemIndex) => <li key={itemIndex} className="pl-1">{item}</li>)}
                  </ul>
                )
              case 'paragraph':
                return <p key={index} className="whitespace-pre-wrap">{block.text}</p>
            }
          })}
        </div>
      </div>
      {showCopy && (
        <DialogFooter className="mb-0 shrink-0 flex-row items-center justify-end py-3 max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {copyStatus === 'failed' && <p role="status" className="mr-auto text-xs text-destructive">{t('notes.copyError')}</p>}
          <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="max-sm:min-h-10">
            {copyStatus === 'copied' ? <Check className="size-4" /> : <Copy className="size-4" />}
            <span aria-live="polite">{t(copyStatus === 'copied' ? 'notes.copied' : 'notes.copy')}</span>
          </Button>
        </DialogFooter>
      )}
    </div>
  )
}
