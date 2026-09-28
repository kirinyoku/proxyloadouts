import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface RosterBuildToolbarSkeletonProps {
  className?: string
}

/**
 * Placeholder for the RosterBuildToolbar row: mirrors its desktop zoning
 * (identity from lg up | build controls cluster | capacity, date and delete).
 */
export function RosterBuildToolbarSkeleton({ className }: RosterBuildToolbarSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex flex-wrap items-center gap-2.5 border-b border-white/[0.08] pb-2',
        className,
      )}
    >
      {/* Capacity indicator (1/5) before build list */}
      <Skeleton className="h-8 w-14 shrink-0 rounded-xl" />

      {/* Build controls cluster */}
      <div className="flex h-9 min-w-0 flex-1 items-center gap-0.5 rounded-xl border border-white/[0.09] bg-[#0e141c]/70 p-0.5">
        <Skeleton className="h-7.5 w-24 rounded-[10px] sm:w-32 md:w-40" />
        <Skeleton className="size-7.5 shrink-0 rounded-[10px]" />
        <div className="mx-0.5 h-5 w-px shrink-0 bg-white/[0.1]" />
        <Skeleton className="h-7.5 min-w-0 flex-1 rounded-[10px]" />
      </div>

      <div className="ml-auto h-6 w-px shrink-0 bg-white/[0.12]" />

      {/* Delete action */}
      <div className="flex shrink-0 items-center">
        <Skeleton className="h-8 w-20 rounded-[10px]" />
      </div>
    </div>
  )
}
