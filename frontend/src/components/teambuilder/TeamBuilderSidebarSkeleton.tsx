import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface TeamBuilderSidebarSkeletonProps {
  className?: string
}

export function TeamBuilderSidebarSkeleton({ className }: TeamBuilderSidebarSkeletonProps) {
  return (
    <aside aria-hidden="true" className={cn('space-y-3 lg:sticky lg:top-20', className)}>
      <div className="rounded-2xl border border-white/[0.12] bg-[#131922]/80 p-4 sm:p-5 backdrop-blur-md shadow-lg space-y-3.5">
        <div className="space-y-3.5">
          {/* Team Name Input Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
            <Skeleton className="h-9 w-full rounded-md" />
          </div>

          {/* Description Textarea Field */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-3 w-8 rounded" />
            </div>
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2">
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </aside>
  )
}
