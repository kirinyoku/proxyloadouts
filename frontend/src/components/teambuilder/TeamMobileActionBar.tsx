import { AlertCircle, CheckCircle2, Plus, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { ConflictReport } from '@/types'

interface TeamMobileActionBarProps {
  isEditing: boolean
  teamName?: string
  selectedCount: number
  report: ConflictReport | null
  isValidating: boolean
  canSave: boolean
  isSaving: boolean
  saveHint: string | null
  onSave: () => void
}

export function TeamMobileActionBar({
  isEditing,
  teamName,
  selectedCount,
  report,
  canSave,
  isSaving,
  onSave,
}: TeamMobileActionBarProps) {
  const { t } = useTranslation()
  const hasConflicts = report && !report.is_valid

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 block border-t border-white/15 bg-background/95 p-3 pb-safe shadow-2xl backdrop-blur-md lg:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        {/* Left Status Indicator */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="font-bold text-foreground">{t('teamBuilder.deckSlotCounter', { count: selectedCount })}</span>
            {hasConflicts ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-destructive/20 px-1.5 py-0.5 text-[10px] font-bold text-destructive">
                <AlertCircle className="size-3" />
                {t('teamBuilder.mobileCollision')}
              </span>
            ) : selectedCount > 0 && report?.is_valid ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                <CheckCircle2 className="size-3" />
                {t('teamBuilder.mobileReady')}
              </span>
            ) : null}
          </div>
          <span className="truncate block text-[11px] text-muted-foreground">
            {teamName || (isEditing ? t('teamBuilder.editTitle') : t('teamBuilder.newTitle'))}
          </span>
        </div>

        {/* Save CTA */}
        <Button
          onClick={onSave}
          disabled={!canSave || isSaving}
          className="shrink-0 gap-1.5"
        >
          {isEditing ? <Save className="size-3.5" /> : <Plus className="size-3.5" />}
          {isSaving ? t('teamBuilder.saving') : isEditing ? t('teamBuilder.mobileSave') : t('teamBuilder.mobileCreate')}
        </Button>
      </div>
    </div>
  )
}
