import { useCallback, useReducer, useRef } from 'react'
import { NotebookText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { StatusIconButton } from './StatusIconButton'
import {
  isNoteDirty,
  noteModalReducer,
  planNoteCommit,
} from './note-model'
import type { NotePatch, NoteSubject } from './note-model'
import {
  NoteEditorView,
  NoteReadOnlyView,
  NoteSubjectHeader,
} from './NoteViews'

export type NoteButtonProps = {
  subject: NoteSubject
  note: string | null | undefined
  className?: string
} & (
  | { readOnly: true; showCopy?: boolean }
  | {
      readOnly?: false
      isNotePublic: boolean
      onSave: (changes: NotePatch) => Promise<unknown>
      isSaving?: boolean
    }
)

export function NoteButton(props: NoteButtonProps) {
  const { subject, note, className } = props
  const { t } = useTranslation()
  const trimmedNote = note?.trim() ?? ''
  const isReadOnly = props.readOnly === true

  const [state, dispatch] = useReducer(noteModalReducer, { kind: 'closed' })
  const dialogRef = useRef<HTMLDivElement>(null)
  const saveInFlight = useRef(false)

  const isOpen = state.kind !== 'closed'

  const trackViewport = useCallback((node: HTMLDivElement | null) => {
    dialogRef.current = node
    const viewport = window.visualViewport
    if (!node || !viewport) return

    const updateViewport = () => {
      const bottomInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      node.style.setProperty('--note-viewport-height', `${viewport.height}px`)
      node.style.setProperty('--note-viewport-bottom', `${bottomInset}px`)
    }

    updateViewport()
    viewport.addEventListener('resize', updateViewport)
    viewport.addEventListener('scroll', updateViewport)
    window.addEventListener('resize', updateViewport)
    return () => {
      dialogRef.current = null
      viewport.removeEventListener('resize', updateViewport)
      viewport.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
    }
  }, [])

  if (isReadOnly && !trimmedNote) {
    return null
  }

  const handleOpen = () => {
    if (isReadOnly) {
      dispatch({ type: 'open_view' })
    } else {
      dispatch({
        type: 'open_edit',
        baselineNote: note,
        baselineIsPublic: props.isNotePublic,
      })
    }
  }

  const handleRequestClose = () => {
    if (state.kind === 'closed' || saveInFlight.current) return
    if (state.kind === 'viewing') {
      dispatch({ type: 'request_close', dirty: false })
      return
    }

    const dirty = isNoteDirty({
      draft: state.draft,
      baselineNote: note,
      draftIsPublic: state.draftIsPublic,
      baselineIsPublic: !isReadOnly ? props.isNotePublic : false,
    })
    dispatch({ type: 'request_close', dirty })
  }

  const handleSubmit = async () => {
    if (
      isReadOnly || state.kind !== 'editing' || state.savePhase !== 'idle' ||
      props.isSaving || saveInFlight.current
    ) {
      return
    }
    const plan = planNoteCommit({
      draft: state.draft,
      baselineNote: note,
      draftIsPublic: state.draftIsPublic,
      baselineIsPublic: props.isNotePublic,
    })

    if (plan.kind === 'noop') {
      dispatch({ type: 'reset_closed' })
      return
    }

    if (plan.kind === 'over_limit') return

    saveInFlight.current = true
    dispatch({ type: 'submit_start' })
    try {
      await props.onSave(plan.patch)
      dispatch({ type: 'submit_succeeded' })
    } catch {
      dispatch({ type: 'submit_failed' })
    } finally {
      saveInFlight.current = false
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) handleOpen()
        else handleRequestClose()
      }}
    >
      <DialogTrigger asChild>
        <StatusIconButton
          type="button"
          indicator={Boolean(trimmedNote)}
          aria-label={t('notes.open')}
          title={trimmedNote || t('notes.add')}
          className={cn('motion-reduce:transition-none', className)}
        >
          <NotebookText aria-hidden="true" className="size-3.5" />
        </StatusIconButton>
      </DialogTrigger>

      <DialogContent
        ref={trackViewport}
        tabIndex={-1}
        showCloseButton={false}
        onEscapeKeyDown={(event) => {
          event.preventDefault()
          handleRequestClose()
        }}
        onPointerDownOutside={(event) => {
          event.preventDefault()
          handleRequestClose()
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          const dialog = dialogRef.current
          const shouldFocusEditor = !isReadOnly && window.matchMedia('(min-width: 640px) and (pointer: fine)').matches
          const input = shouldFocusEditor ? dialog?.querySelector('textarea[data-note-input]:not(:disabled)') : null
          if (input instanceof HTMLTextAreaElement) input.focus({ preventScroll: true })
          else dialog?.focus({ preventScroll: true })
        }}
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-hidden overscroll-contain rounded-2xl border border-white/[0.12] pb-0 backdrop-blur-xl data-closed:animate-none motion-reduce:animate-none sm:max-w-md max-sm:inset-x-0 max-sm:top-auto max-sm:bottom-[var(--note-viewport-bottom,0px)] max-sm:max-h-[var(--note-viewport-height,100dvh)] max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:border-x-0 max-sm:border-b-0"
      >
        <NoteSubjectHeader
          subject={subject}
          isSaving={state.kind === 'editing' && state.savePhase === 'saving'}
        />

        {state.kind === 'editing' && !isReadOnly ? (
          <NoteEditorView
            editor={state}
            dispatch={dispatch}
            onSubmit={handleSubmit}
            isSaving={Boolean(props.isSaving || state.savePhase === 'saving')}
          />
        ) : state.kind === 'viewing' ? (
          <NoteReadOnlyView note={trimmedNote} showCopy={isReadOnly && props.showCopy === true} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
