import { AlertTriangle, Disc } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  formatConflictMessage,
  getConflictLabel,
  getConflictingDiscMeta,
  resolveConflictingBuildNames,
} from '@/lib/conflicts'
import type { Build, ConflictReport } from '@/types'

export interface TeamConflictBannerProps {
  report: ConflictReport | null
  isValidating: boolean
  slots: readonly (Build | null)[]
}

/**
 * Alert banner displaying equipment collision details and conflicted agents/discs.
 */
export function TeamConflictBanner({ report, slots }: TeamConflictBannerProps) {
  const { t } = useTranslation()

  // Minimalist principle: do not render anything if team is valid or empty
  if (!report || report.is_valid) {
    return null
  }

  return (
    <div className="space-y-2 rounded-2xl border border-destructive/60 bg-destructive/10 p-3.5 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-destructive text-white">
          <AlertTriangle className="size-3.5" />
        </span>
        <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-destructive">
          {t('teamBuilder.conflictMatrixTitle')}
        </h3>
      </div>

      <div className="space-y-2 pt-1">
        {report.errors.map((error, index) => {
          const involved = resolveConflictingBuildNames(
            error.conflicting_builds ?? [],
            slots,
          )
          const discMeta = getConflictingDiscMeta(error, slots)

          return (
            <div
              key={`${error.code}-${index}`}
              className="rounded-xl border border-destructive/40 bg-black/50 p-2.5 text-xs space-y-1.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-destructive/30 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
                  {getConflictLabel(error.code)}
                </span>
                {discMeta?.slot && (
                  <span className="inline-flex items-center gap-1 rounded border border-destructive/40 bg-destructive/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-destructive">
                    <Disc className="size-3" />
                    {t('conflicts.discSlotPill', { slot: discMeta.slot })}
                  </span>
                )}
                {discMeta?.setName && (
                  <span className="inline-flex items-center gap-1 rounded bg-white/5 px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                    {discMeta.iconUrl && (
                      <img
                        src={discMeta.iconUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-3.5 object-contain"
                      />
                    )}
                    <span>{discMeta.setName}</span>
                  </span>
                )}
                {involved.length > 0 && (
                  <span className="font-semibold text-foreground">
                    {involved.join(' ⇄ ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {formatConflictMessage(error, slots, t)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
