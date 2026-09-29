import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const STAT_PLACEHOLDERS = [
  { labelWidth: 'w-12', valueWidth: 'w-14' }, // HP
  { labelWidth: 'w-14', valueWidth: 'w-12' }, // ATK
  { labelWidth: 'w-12', valueWidth: 'w-10' }, // DEF
  { labelWidth: 'w-16', valueWidth: 'w-8' },  // Impact
  { labelWidth: 'w-20', valueWidth: 'w-12' }, // Crit Rate
  { labelWidth: 'w-20', valueWidth: 'w-14' }, // Crit DMG
  { labelWidth: 'w-28', valueWidth: 'w-8' },  // Anomaly Mastery
  { labelWidth: 'w-28', valueWidth: 'w-10' }, // Anomaly Proficiency
  { labelWidth: 'w-20', valueWidth: 'w-12' }, // PEN Ratio
]

interface AgentStatsPanelSkeletonProps {
  compact?: boolean
  className?: string
}

export function AgentStatsPanelSkeleton({ compact = false, className }: AgentStatsPanelSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-2xl border border-white/[0.2] bg-card/90 p-3 shadow-md backdrop-blur-md',
        className,
      )}
    >
      <div className="mb-2 border-b border-white/[0.08] pb-1.5">
        <Skeleton className="h-3 w-16 rounded" />
      </div>

      <div className="space-y-1">
        {(compact ? STAT_PLACEHOLDERS.slice(0, 4) : STAT_PLACEHOLDERS).map((stat, i) => (
          <div
            key={i}
            className="flex min-w-0 items-center justify-between gap-2 rounded bg-white/[0.04] px-2.5 py-1 text-xs leading-tight"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <Skeleton className="size-3.5 shrink-0 rounded-full" />
              <Skeleton className={cn('h-3.5 rounded', stat.labelWidth)} />
            </div>
            <Skeleton className={cn('h-3.5 shrink-0 rounded', stat.valueWidth)} />
          </div>
        ))}
      </div>
    </div>
  )
}
