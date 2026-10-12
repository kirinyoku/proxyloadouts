import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface ShowcaseProfileHeaderSkeletonProps {
  className?: string
}

export function ShowcaseProfileHeaderSkeleton({
  className,
}: ShowcaseProfileHeaderSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative rounded-2xl border border-white/[0.08] bg-[#111620]/96 p-3 sm:px-4 sm:py-2 shadow-lg backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        {/* Identity: avatar with IL badge + name + meta line */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative shrink-0 pb-1">
            <Skeleton className="size-10 rounded-full border-2 border-black" />
            <Skeleton className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2.5 w-8 rounded-[3px_3px_0_3px]" />
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <Skeleton className="h-4 w-28 rounded" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-24 rounded-md" />
            </div>
          </div>
        </div>

        {/* Action Row: Cache Status placeholder + Search placeholder side by side */}
        <div className="flex items-center gap-2 min-w-0 pt-2 border-t border-white/[0.06] sm:border-t-0 sm:pt-0 sm:ml-auto">
          <Skeleton className="h-8 w-24 shrink-0 rounded-lg" />
          <Skeleton className="h-8 flex-1 min-w-0 sm:w-44 lg:w-48 sm:flex-none rounded-[10px_10px_0_10px] border-2 border-black" />
        </div>
      </div>
    </div>
  )
}
