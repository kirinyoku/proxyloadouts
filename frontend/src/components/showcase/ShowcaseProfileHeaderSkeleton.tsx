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
        'relative rounded-2xl border border-white/[0.08] bg-card/96 p-2.5 sm:px-3.5 sm:py-2 shadow-lg backdrop-blur-sm',
        className,
      )}
    >
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3 lg:gap-4 sm:justify-start">
        {/* Identity: avatar with IL badge + name + meta line */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative shrink-0 pb-1">
            <Skeleton className="size-11 shrink-0 rounded-full bg-secondary/80 border-2 border-black ring-2 ring-primary/20" />
            <Skeleton className="absolute bottom-0 left-1/2 -translate-x-1/2 h-2.5 w-8 rounded-[3px_3px_0_3px]" />
          </div>

          <div className="flex min-w-0 flex-col justify-center gap-1">
            <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
              <Skeleton className="h-5 w-24 sm:w-32 rounded bg-secondary/70" />
              <Skeleton className="h-4 w-7 rounded bg-secondary/70" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0 flex-nowrap">
              <Skeleton className="h-6 w-24 rounded-md bg-secondary/50" />
            </div>
          </div>
        </div>

        {/* Action Row: Divider + Cache Status placeholder + Search placeholder pushed to right edge */}
        <div className="flex items-center gap-2 min-w-0 pt-2 border-t border-white/[0.06] sm:border-t-0 sm:pt-0 sm:ml-auto">
          {/* Vertical divider on tablet/desktop */}
          <div className="hidden sm:block h-7 w-px bg-white/[0.08] shrink-0 mr-1" aria-hidden="true" />
          <Skeleton className="h-8 w-12 shrink-0 rounded-[10px_10px_0_10px] border-2 border-black" />
          <Skeleton className="h-8 flex-1 min-w-0 sm:w-40 lg:w-44 sm:flex-none rounded-[10px_10px_0_10px] border-2 border-black" />
        </div>
      </div>
    </div>
  )
}
