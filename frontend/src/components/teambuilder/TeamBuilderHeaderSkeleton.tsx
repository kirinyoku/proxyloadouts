import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface TeamBuilderHeaderSkeletonProps {
  className?: string
}

export function TeamBuilderHeaderSkeleton({ className }: TeamBuilderHeaderSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('flex items-center gap-2.5', className)}
    >
      <Skeleton className="size-8 rounded-lg" />
      <Skeleton className="h-7 w-48 rounded-md sm:h-8 sm:w-60" />
    </div>
  )
}
