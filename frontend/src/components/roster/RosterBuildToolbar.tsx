import { useState } from 'react'
import type { ReactNode } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { formatDateTime } from '@/lib/format'
import { useDeleteBuild, useRenameBuild } from '@/api/hooks'
import type { Build } from '@/types'

interface RosterBuildToolbarProps {
  agentName: string
  builds: Build[]
  selectedBuildId: string
  onSelectBuildId: (id: string) => void
  /** Saved-builds capacity chip merged into the toolbar. */
  meta?: ReactNode
}

/**
 * Build management toolbar for an active agent:
 * - Desktop (sm+): single row with capacity indicator (1/5), build controls cluster
 *   (build selector, rename, expandable note) and delete action with "Delete" text
 * - Mobile (<sm): balanced 2-row layout (row 1: capacity indicator + build selector + rename + icon-only delete; row 2: note)
 */
export function RosterBuildToolbar({
  agentName,
  builds,
  selectedBuildId,
  onSelectBuildId,
  meta,
}: RosterBuildToolbarProps) {
  const { t } = useTranslation()
  const currentBuild = builds.find((b) => b.id === selectedBuildId) ?? builds[0]
  const renameMutation = useRenameBuild()
  const deleteMutation = useDeleteBuild()

  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [editingNote, setEditingNote] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  if (!currentBuild) return null

  const isPending = renameMutation.isPending || deleteMutation.isPending
  const hasDescription = Boolean(currentBuild.description && currentBuild.description.trim() !== '')

  function handleStartRename() {
    if (!currentBuild) return
    setNameDraft(currentBuild.name)
    setEditingName(true)
  }

  function handleSaveName() {
    if (!currentBuild) return
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === currentBuild.name) {
      setEditingName(false)
      return
    }
    renameMutation.mutate(
      {
        id: currentBuild.id,
        gameAccountId: currentBuild.game_account_id,
        name: trimmed,
        description: currentBuild.description,
      },
      {
        onSuccess: () => setEditingName(false),
      },
    )
  }

  function handleStartNoteEdit() {
    setNoteDraft(currentBuild?.description ?? '')
    setEditingNote(true)
  }

  function handleSaveNote() {
    if (!currentBuild) return
    const trimmed = noteDraft.trim()
    renameMutation.mutate(
      {
        id: currentBuild.id,
        gameAccountId: currentBuild.game_account_id,
        name: currentBuild.name,
        description: trimmed || null,
      },
      {
        onSuccess: () => setEditingNote(false),
      },
    )
  }

  function handleDelete() {
    if (!currentBuild) return
    deleteMutation.mutate({
      id: currentBuild.id,
      gameAccountId: currentBuild.game_account_id,
    })
  }

  return (
    <div className="border-b border-white/[0.08] pb-2">
      {/* 1. Desktop & Tablet layout (sm+): one row —
          capacity indicator | build controls cluster (hugs content, expands up to line max) | delete action */}
      <div className="hidden sm:flex items-center gap-2.5">
        {/* Builds capacity indicator (1/5) — placed before the build list */}
        {meta && (
          <div className="shrink-0 flex items-center">{meta}</div>
        )}

        {/* Zone 2: build controls cluster — compact surface wrapping build picker and note */}
        <div className="flex h-9 min-w-0 w-fit max-w-full items-center gap-0.5 rounded-xl border border-white/[0.09] bg-subtle/70 p-0.5 shadow-inner">
          {editingName ? (
            <div className="flex h-full min-w-0 w-48 sm:w-60 max-w-full items-center gap-1 px-0.5">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={t('roster.renameInputPlaceholder')}
                className="h-7.5 min-w-[100px] flex-1 rounded-[calc(var(--radius-xl)-2px)] border-0 bg-black/60 px-2.5 font-mono text-xs text-foreground outline-none ring-1 ring-primary/60 transition-shadow placeholder:text-muted-foreground/50 focus:ring-2"
                autoFocus
                maxLength={60}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') setEditingName(false)
                }}
              />
              <Button
                size="sm"
                onClick={handleSaveName}
                disabled={isPending || !nameDraft.trim()}
                className="h-7.5 w-7.5 shrink-0 rounded-[calc(var(--radius-xl)-2px)] bg-primary p-0 text-black shadow-sm hover:bg-primary/90 cursor-pointer"
                title={t('roster.renameSave')}
              >
                <Check className="size-3.5 stroke-[2.5]" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingName(false)}
                className="h-7.5 w-7.5 shrink-0 rounded-[calc(var(--radius-xl)-2px)] p-0 text-muted-foreground hover:bg-white/10 cursor-pointer"
                title={t('roster.renameCancel')}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <Select
                value={currentBuild.id}
                onValueChange={onSelectBuildId}
                disabled={isPending}
              >
                <SelectTrigger
                  size="sm"
                  className="h-7.5 w-auto max-w-[180px] shrink justify-start gap-1.5 rounded-[calc(var(--radius-xl)-2px)] border-0 bg-white/[0.05] text-xs font-mono text-foreground shadow-none hover:border-0 hover:bg-white/[0.1] md:max-w-[240px]"
                  title={`${currentBuild.name} (${formatDateTime(currentBuild.updated_at || currentBuild.created_at)})`}
                >
                  <SelectValue placeholder={t('roster.buildSelectPlaceholder')}>
                    {currentBuild.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start" className="max-w-[90vw] sm:max-w-md">
                  {builds.map((build) => (
                    <SelectItem key={build.id} value={build.id} title={build.name}>
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="truncate">{build.name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/90">
                          {formatDateTime(build.updated_at || build.created_at)}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                type="button"
                onClick={handleStartRename}
                disabled={isPending}
                className="flex size-7.5 shrink-0 items-center justify-center rounded-[calc(var(--radius-xl)-2px)] text-neutral-300 transition-colors hover:bg-white/[0.07] hover:text-primary active:scale-95 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
                title={t('roster.renameBuild')}
              >
                <Pencil className="size-3" />
              </button>
            </>
          )}

          {/* Segment separator between the build picker and the note field */}
          <div className="mx-0.5 h-5 w-px shrink-0 bg-white/[0.1]" aria-hidden="true" />

          {/* Note segment — compact w-fit when short, stretches up to maximum row length, truncates with ellipsis */}

          {editingNote ? (
            <div className="flex h-full min-w-0 w-56 sm:w-80 md:w-96 max-w-full items-center gap-1 px-0.5">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder={t('roster.noteInputPlaceholder')}
                className="h-7.5 min-w-0 flex-1 rounded-[calc(var(--radius-xl)-2px)] border-0 bg-black/60 px-2.5 text-xs text-foreground outline-none ring-1 ring-primary/50 transition-shadow placeholder:text-muted-foreground/50 focus:ring-2"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNote()
                  if (e.key === 'Escape') setEditingNote(false)
                }}
                maxLength={250}
              />
              <Button
                size="sm"
                onClick={handleSaveNote}
                disabled={isPending}
                className="h-7.5 w-7.5 shrink-0 rounded-[calc(var(--radius-xl)-2px)] bg-primary p-0 text-black hover:bg-primary/90 cursor-pointer"
                title={t('roster.renameSave')}
              >
                <Check className="size-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingNote(false)}
                className="h-7.5 w-7.5 shrink-0 rounded-[calc(var(--radius-xl)-2px)] p-0 text-muted-foreground hover:bg-white/10 cursor-pointer"
                title={t('roster.renameCancel')}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : hasDescription ? (
            <div
              role="button"
              tabIndex={0}
              onClick={handleStartNoteEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleStartNoteEdit()
                }
              }}
              className="group/note flex h-full min-w-0 w-fit max-w-full shrink cursor-pointer select-none items-center gap-1.5 rounded-[calc(var(--radius-xl)-2px)] pl-2 pr-2.5 text-xs transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
              title={t('roster.noteEditTitle', { desc: currentBuild.description ?? '' })}
            >
              <span className="inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary select-none shrink-0">
                {t('roster.addNote')}
              </span>
              <span className="min-w-0 truncate text-neutral-200 transition-colors group-hover/note:text-white">
                {currentBuild.description}
              </span>
              <Pencil className="ml-0.5 size-2.5 shrink-0 text-neutral-400 opacity-50 transition-all group-hover/note:opacity-100 group-hover/note:text-primary group-hover/note:scale-110" />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartNoteEdit}
              className="flex h-full min-w-0 w-fit shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-[calc(var(--radius-xl)-2px)] pl-2 pr-2.5 text-xs text-neutral-400 transition-colors hover:bg-white/[0.07] hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60"
              title={t('roster.addNoteTitle')}
            >
              <Plus className="size-3 shrink-0" />
              <span className="truncate">{t('roster.addNote')}</span>
            </button>
          )}
        </div>

        {/* Zone separator between the build cluster and the destructive action */}
        <div className="ml-auto hidden h-6 w-px shrink-0 bg-white/[0.12] sm:block" aria-hidden="true" />

        {/* Zone 3: destructive action with "Delete" text */}
        <div className="flex shrink-0 items-center">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={isPending}
                className="h-8 px-3 text-xs font-semibold cursor-pointer"
                title={t('roster.deleteBuildTitle')}
                aria-label={t('roster.deleteBuildTitle')}
              >
                <span>{t('roster.deleteBuildButton')}</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-popover border border-white/[0.12] rounded-2xl shadow-2xl backdrop-blur-xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading text-lg break-words">
                  {t('roster.deleteDialogTitle', { name: currentBuild.name })}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground text-sm">
                  {t('roster.deleteDialogDesc', { agent: agentName })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-bold rounded-xl border-white/10 hover:bg-white/5">
                  {t('roster.deleteDialogCancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold rounded-xl shadow-lg"
                >
                  {t('roster.deleteDialogConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* 2. Mobile layout (< sm): Balanced 2-row layout */}
      <div className="sm:hidden space-y-2">
        {/* Row 1: Capacity indicator (if provided) + Select build (flex-1) + Rename + Delete (icon only) */}
        <div className="flex items-center gap-1.5">
          {meta && <div className="shrink-0 flex items-center">{meta}</div>}
          {editingName ? (
            <div className="flex items-center gap-1 shrink-0 flex-1 max-w-full min-w-0">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder={t('roster.renameInputPlaceholder')}
                className="h-8 flex-1 min-w-[120px] rounded-[10px_10px_0_10px] border border-primary/70 bg-black/80 px-2.5 font-mono text-xs text-foreground outline-none focus:ring-1 focus:ring-primary/50 shadow-inner"
                autoFocus
                maxLength={60}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName()
                  if (e.key === 'Escape') setEditingName(false)
                }}
              />
              <Button
                size="sm"
                onClick={handleSaveName}
                disabled={isPending || !nameDraft.trim()}
                className="h-8 px-2 text-xs font-semibold rounded-[6px_6px_0_6px] bg-primary text-black hover:bg-primary/90 cursor-pointer shadow-sm shrink-0"
                title={t('roster.renameSave')}
              >
                <Check className="size-3.5 stroke-[2.5]" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingName(false)}
                className="h-8 px-2 text-xs rounded-xl hover:bg-white/10 text-muted-foreground cursor-pointer shrink-0"
                title={t('roster.renameCancel')}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <Select
                value={currentBuild.id}
                onValueChange={onSelectBuildId}
                disabled={isPending}
              >
                <SelectTrigger
                  size="sm"
                  className="h-8 flex-1 min-w-0 text-xs font-mono border-white/15 bg-card hover:border-white/30 text-foreground"
                  title={`${currentBuild.name} (${formatDateTime(currentBuild.updated_at || currentBuild.created_at)})`}
                >
                  <SelectValue placeholder={t('roster.buildSelectPlaceholder')}>
                    {currentBuild.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent align="start" className="max-w-[90vw]">
                  {builds.map((build) => (
                    <SelectItem
                      key={build.id}
                      value={build.id}
                      title={`${build.name} (${formatDateTime(build.updated_at || build.created_at)})`}
                    >
                      <span className="truncate">{build.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <button
                type="button"
                onClick={handleStartRename}
                disabled={isPending}
                className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.12] bg-card text-neutral-300 shadow-xs transition-all hover:border-primary/50 hover:bg-elevated hover:text-primary active:scale-95 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
                title={t('roster.renameBuild')}
              >
                <Pencil className="size-3" />
              </button>
            </div>
          )}

          {/* Delete button on mobile with icon only */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                disabled={isPending}
                className="size-8 shrink-0 cursor-pointer"
                title={t('roster.deleteBuildTitle')}
                aria-label={t('roster.deleteBuildTitle')}
              >
                <Trash2 className="size-3.5 shrink-0" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-popover border border-white/[0.12] rounded-2xl shadow-2xl backdrop-blur-xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-heading text-lg break-words">
                  {t('roster.deleteDialogTitle', { name: currentBuild.name })}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-muted-foreground text-sm">
                  {t('roster.deleteDialogDesc', { agent: agentName })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="font-bold rounded-xl border-white/10 hover:bg-white/5">
                  {t('roster.deleteDialogCancel')}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold rounded-xl shadow-lg"
                >
                  {t('roster.deleteDialogConfirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Row 2: Note */}
        <div className="flex items-center gap-1.5">
          {editingNote ? (
            <div className="flex items-center gap-1.5 flex-1 min-w-0 max-w-full">
              <input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder={t('roster.noteInputPlaceholder')}
                className="h-7.5 text-xs bg-black/60 border border-white/20 focus:border-primary/60 focus:ring-0 text-foreground placeholder:text-muted-foreground/50 rounded-[8px_8px_0_8px] px-2.5 outline-none flex-1 transition-colors"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNote()
                  if (e.key === 'Escape') setEditingNote(false)
                }}
                maxLength={250}
              />
              <Button
                size="sm"
                onClick={handleSaveNote}
                disabled={isPending}
                className="h-7.5 px-2 text-xs font-semibold rounded-[6px_6px_0_6px] bg-primary text-black hover:bg-primary/90 cursor-pointer shrink-0 transition-all"
                title={t('roster.renameSave')}
              >
                <Check className="size-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingNote(false)}
                className="h-7.5 px-1.5 text-xs rounded-[6px_6px_0_6px] hover:bg-white/10 text-muted-foreground cursor-pointer shrink-0"
                title={t('roster.renameCancel')}
              >
                <X className="size-3" />
              </Button>
            </div>
          ) : hasDescription ? (
            <div
              role="button"
              tabIndex={0}
              onClick={handleStartNoteEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleStartNoteEdit()
                }
              }}
              className="group/note flex h-7.5 flex-1 min-w-0 items-center justify-between gap-1.5 rounded-xl border border-white/[0.1] bg-card/80 px-2.5 text-xs transition-all hover:border-white/25 hover:bg-elevated active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 cursor-pointer select-none shadow-xs"
              title={t('roster.noteEditTitle', { desc: currentBuild.description ?? '' })}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span className="inline-flex items-center rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary select-none shrink-0">
                  {t('roster.addNote')}
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-200 transition-colors group-hover/note:text-white">
                  {currentBuild.description}
                </span>
              </div>
              <Pencil className="ml-1 size-2.5 shrink-0 text-neutral-400 opacity-60 transition-all group-hover/note:opacity-100 group-hover/note:text-primary" />
            </div>
          ) : (
            <button
              type="button"
              onClick={handleStartNoteEdit}
              className="inline-flex h-7.5 flex-1 items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/[0.2] bg-white/[0.03] hover:border-primary/50 hover:bg-white/[0.08] hover:text-primary px-2.5 text-xs text-neutral-300 transition-all active:scale-[0.99] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 cursor-pointer select-none min-w-0"
              title={t('roster.addNoteTitle')}
            >
              <Plus className="size-3 shrink-0" />
              <span className="truncate">{t('roster.addNote')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
