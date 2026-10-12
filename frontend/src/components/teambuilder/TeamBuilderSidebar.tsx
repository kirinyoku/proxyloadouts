import { useState } from 'react'
import { Eraser } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { Build, ConflictReport } from '@/types'

interface TeamBuilderSidebarProps {
  isEditing: boolean
  name: string
  defaultName?: string
  description: string
  selectedBuilds: readonly (Build | null)[]
  report: ConflictReport | null
  isValidating: boolean
  isSaving: boolean
  canSave: boolean
  saveHint: string | null
  onSetName: (name: string) => void
  onSetDescription: (desc: string) => void
  onSave: () => void
  onReset: () => void
}

export function TeamBuilderSidebar({
  isEditing,
  name,
  defaultName,
  description,
  selectedBuilds,
  isSaving,
  canSave,
  saveHint,
  onSetName,
  onSetDescription,
  onSave,
  onReset,
}: TeamBuilderSidebarProps) {
  const { t } = useTranslation()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const filledBuilds = selectedBuilds.filter((b): b is Build => b !== null)
  const isDirty = filledBuilds.length > 0 || name.trim() !== '' || description.trim() !== ''

  function handleResetClick() {
    if (isDirty) {
      setConfirmOpen(true)
    } else {
      onReset()
    }
  }

  function handleConfirmReset() {
    setConfirmOpen(false)
    onReset()
  }

  return (
    <aside className="space-y-3 lg:sticky lg:top-20">
      <div className="rounded-2xl border border-white/15 bg-[#141922] p-4 sm:p-5 shadow-[0_16px_40px_rgba(0,0,0,0.65)] space-y-3.5">
        <div className="space-y-3.5">
          {/* Team Name Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="team-name"
                className="text-xs font-semibold uppercase tracking-wider text-zinc-300"
              >
                {t('teamBuilder.teamNameLabel')}
              </Label>
              <span className="font-mono text-[10px] text-zinc-400">
                {name.length}/100
              </span>
            </div>
            <Input
              id="team-name"
              placeholder={defaultName || t('teamBuilder.teamNamePlaceholder')}
              value={name}
              onChange={(event) => onSetName(event.target.value)}
              maxLength={100}
              className="bg-[#0f141c] dark:bg-[#0f141c] border-white/20 text-sm text-foreground focus-visible:bg-[#131a24] focus-visible:border-primary/70 focus-visible:ring-1 focus-visible:ring-primary/40 shadow-xs transition-all"
            />
            <p className="text-[11px] text-zinc-400">
              {t('teamBuilder.nameAutoHint')}
            </p>
          </div>

          {/* Description Textarea */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label
                htmlFor="team-description"
                className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300"
              >
                {t('teamBuilder.teamDescLabel')}
              </Label>
              <span className="font-mono text-[10px] text-zinc-400">
                {description.length}/500
              </span>
            </div>
            <Textarea
              id="team-description"
              placeholder={t('teamBuilder.teamDescPlaceholder') || 'Some useful info...'}
              value={description}
              onChange={(event) => onSetDescription(event.target.value)}
              rows={2}
              maxLength={500}
              className="bg-[#0f141c] dark:bg-[#0f141c] border-white/20 text-xs text-foreground resize-none focus-visible:bg-[#131a24] focus-visible:border-primary/70 focus-visible:ring-1 focus-visible:ring-primary/40 shadow-xs transition-all"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        <Button
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="w-full"
          aria-describedby={saveHint ? 'team-save-hint' : undefined}
        >
          {isSaving
            ? isEditing
              ? t('teamBuilder.saving')
              : t('teamBuilder.creating')
            : isEditing
              ? t('teamBuilder.saveChanges')
              : t('teamBuilder.saveTeam')}
        </Button>

        {saveHint && (
          <p
            id="team-save-hint"
            aria-live="polite"
            className="text-center text-xs font-semibold text-destructive px-2"
          >
            {saveHint}
          </p>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetClick}
          disabled={isSaving}
          className="w-full text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1.5"
        >
          {!isEditing && <Eraser className="size-3.5" />}
          {isEditing ? t('teamBuilder.cancel') : t('teamBuilder.clearDraft')}
        </Button>
      </div>

      {/* Reset / Cancel Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isEditing ? t('teamBuilder.confirmResetTitleEdit') : t('teamBuilder.confirmResetTitleNew')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isEditing
                ? t('teamBuilder.confirmResetDescEdit')
                : t('teamBuilder.confirmResetDescNew')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('teamBuilder.continueEditing')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isEditing ? t('teamBuilder.exitWithoutSaving') : t('teamBuilder.resetDraftConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
}
