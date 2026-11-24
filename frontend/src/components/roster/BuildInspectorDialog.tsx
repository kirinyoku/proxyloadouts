import { useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogClose,
  DialogContent,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { NoteButton } from '@/components/common/NoteButton'
import { toBuildNoteSubject } from '@/components/common/note-model'
import { BuildEquipmentCard } from '@/components/showcase/BuildEquipmentCard'
import { cn } from '@/lib/utils'
import type { Build } from '@/types'

type MobileInspectorSection = 'discs' | 'stats'

function MobileSectionTabs({
  activeSection,
  onChange,
}: {
  activeSection: MobileInspectorSection
  onChange: (section: MobileInspectorSection) => void
}) {
  const { t } = useTranslation()
  const tabs: ReadonlyArray<{ id: MobileInspectorSection; label: string }> = [
    { id: 'discs', label: t('showcase.mobileDiscs') },
    { id: 'stats', label: t('showcase.mobileStats') },
  ]

  return (
    <div className="sticky top-0 z-30 -mx-3.5 sm:-mx-5 border-b border-white/[0.06] bg-card/96 px-3.5 sm:px-5 py-1 backdrop-blur-md lg:hidden">
      <div
        role="tablist"
        aria-label={t('showcase.agentSectionsAria')}
        className="mx-auto grid max-w-sm grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/40 p-0.5"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeSection
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={cn(
                'h-7.5 rounded-[6px] px-2 text-xs font-semibold transition-all select-none cursor-pointer',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:bg-white/[0.05] hover:text-foreground font-medium',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface BuildInspectorDialogProps {
  build: Build | null
  open: boolean
  onOpenChange: (open: boolean) => void
  teamName?: string
  isPublicView?: boolean
  publicMode?: boolean
  showNoteCopy?: boolean
}

export function BuildInspectorDialog({
  build,
  open,
  onOpenChange,
  isPublicView,
  publicMode,
  showNoteCopy = false,
}: BuildInspectorDialogProps) {
  const isPublic = Boolean(publicMode ?? isPublicView)
  const { t } = useTranslation()
  const [mobileSection, setMobileSection] = useState<MobileInspectorSection>('discs')
  const [prevBuildId, setPrevBuildId] = useState(build?.id)

  if (build?.id !== prevBuildId) {
    setPrevBuildId(build?.id)
    setMobileSection('discs')
  }

  if (!build) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100vw-1.5rem)] sm:max-w-4xl lg:max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto overflow-x-hidden border border-white/[0.08] bg-card/96 p-3.5 sm:p-4 md:p-5 shadow-2xl backdrop-blur-2xl rounded-3xl"
      >
        <BuildEquipmentCard
          build={build}
          variant="dialog"
          mobileSection={mobileSection}
          tabs={<MobileSectionTabs activeSection={mobileSection} onChange={setMobileSection} />}
          controls={(
            <>
              <NoteButton
                subject={toBuildNoteSubject(build)}
                note={build.description}
                readOnly
                showCopy={showNoteCopy && !isPublic}
              />
              {!isPublic && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-2.5 sm:px-3 text-xs font-semibold text-foreground transition-all cursor-pointer shadow-xs active:scale-95 hover:border-primary/60 hover:bg-primary/15 hover:text-primary dark:border-white/15 dark:bg-white/[0.04] dark:text-foreground dark:hover:border-primary/60 dark:hover:bg-primary/15 dark:hover:text-primary"
                  asChild
                >
                  <Link
                    to={`/roster?build=${encodeURIComponent(build.id)}&from=teams`}
                    title={t('roster.openInRoster')}
                    aria-label={t('roster.openInRoster')}
                    className="inline-flex items-center gap-1.5"
                  >
                    <span className="hidden min-[380px]:inline sm:inline">{t('roster.openInRoster')}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                  </Link>
                </Button>
              )}

              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onOpenChange(false)}
                  className="size-8 rounded-xl text-muted-foreground hover:bg-white/10 hover:text-foreground dark:hover:bg-white/10 dark:hover:text-white transition-colors cursor-pointer active:scale-95"
                  aria-label={t('common.close', 'Close')}
                  title={t('common.close', 'Close')}
                >
                  <X className="size-4" />
                  <span className="sr-only">{t('common.close', 'Close')}</span>
                </Button>
              </DialogClose>
            </>
          )}
        />
      </DialogContent>
    </Dialog>
  )
}
