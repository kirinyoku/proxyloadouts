import { Search } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface TeamFilterBarSkeletonProps {
  className?: string
}

export function TeamFilterBarSkeleton({ className }: TeamFilterBarSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {/* Search Input placeholder */}
      <div className="relative w-full sm:max-w-xs md:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
        <Skeleton className="h-9 w-full rounded-[10px_10px_0_10px] border border-border/60" />
      </div>

      {/* Sort Select & Create Button placeholder */}
      <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
        <Skeleton className="h-9 flex-1 sm:w-[160px] sm:flex-none rounded-lg" />
        <Skeleton className="h-9 w-28 sm:w-32 shrink-0 rounded-lg" />
      </div>
    </div>
  )
}
