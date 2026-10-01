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
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {/* Search Input placeholder */}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
        <Skeleton className="h-9 w-full rounded-[10px_10px_0_10px] border border-border/60" />
      </div>

      {/* Sort Select placeholder */}
      <div className="w-full sm:w-[170px] shrink-0">
        <Skeleton className="h-8.5 w-full rounded-[10px_10px_0_10px]" />
      </div>
    </div>
  )
}
