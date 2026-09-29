import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

function DiscCardSkeleton({ slot }: { slot: number }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/[0.2] bg-card/90 p-2.5 shadow-md">
      <div>
        {/* Header: Slot + Set name & level on left, Disc art on right */}
        <div className="flex items-start justify-between gap-1.5 border-b border-white/[0.08] pb-1.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-muted-foreground/40">[{slot}]</span>
              <Skeleton className="h-3.5 w-24 rounded" />
            </div>
            <Skeleton className="h-4.5 w-12 rounded-full" />
          </div>

          <Skeleton className="size-10 shrink-0 rounded-full" />
        </div>

        {/* Main Stat */}
        <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-white/[0.06] px-2 py-1 border border-white/5">
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-3.5 rounded-full" />
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>
          <Skeleton className="h-3.5 w-10 rounded" />
        </div>

        {/* Sub Stats list (4 rows) */}
        <div className="my-1.5 h-px bg-white/[0.06]" />
        <div className="space-y-1">
          {[1, 2, 3, 4].map((subIndex) => (
            <div
              key={subIndex}
              className="flex items-center justify-between gap-2 rounded-md bg-white/[0.04] px-2.5 py-1 text-xs leading-tight"
            >
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-3.5 rounded-full" />
                <Skeleton className="h-3 w-14 rounded" />
              </div>
              <Skeleton className="h-3 w-8 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface DriveDiscGridSkeletonProps {
  className?: string
  showActions?: boolean
}

export function DriveDiscGridSkeleton({
  className,
  showActions = false,
}: DriveDiscGridSkeletonProps) {
  return (
    <div aria-hidden="true" className={cn('space-y-3', className)}>
      {/* Desktop Header Actions Skeleton */}
      {showActions && (
        <div className="hidden items-center justify-end lg:flex">
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
      )}

      {/* Unified 6-Disc Grid Skeleton: 1 col on mobile, 2 cols on tablet, 3 cols on desktop */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((slot) => (
          <DiscCardSkeleton key={slot} slot={slot} />
        ))}
      </div>

      {/* Aggregate Sub-Stats bar placeholder */}
      <div className="flex flex-wrap items-center justify-start gap-1.5 pt-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
