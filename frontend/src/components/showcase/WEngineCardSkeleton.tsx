import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface WEngineCardSkeletonProps {
  className?: string
}

export function WEngineCardSkeleton({ className }: WEngineCardSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative rounded-2xl border border-white/[0.2] bg-card/96 p-3 shadow-md backdrop-blur-sm',
        className,
      )}
    >
      {/* Header: Icon + Name & Level */}
      <div className="flex items-center gap-3 border-b border-white/[0.08] pb-2.5">
        <div className="relative size-16 shrink-0">
          <Skeleton className="size-full rounded-xl" />
          <Skeleton className="absolute -bottom-1 -right-1 size-6 rounded-full border border-black/80" />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-6 w-24 rounded-lg" />
        </div>
      </div>

      {/* Main & Secondary Stats */}
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between gap-2 rounded bg-white/[0.04] px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-3.5 rounded-full" />
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>
          <Skeleton className="h-3.5 w-12 rounded" />
        </div>
        <div className="flex items-center justify-between gap-2 rounded bg-white/[0.04] px-2.5 py-1.5">
          <div className="flex items-center gap-1.5">
            <Skeleton className="size-3.5 rounded-full" />
            <Skeleton className="h-3.5 w-20 rounded" />
          </div>
          <Skeleton className="h-3.5 w-10 rounded" />
        </div>
      </div>

      {/* Passive Ability description placeholder */}
      <div className="mt-2 rounded bg-white/[0.02] p-2 space-y-1.5 border border-white/[0.04]">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-3 w-full rounded" />
        <Skeleton className="h-3 w-4/5 rounded" />
      </div>
    </div>
  )
}
