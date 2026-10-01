import { Skeleton } from '@/components/ui/skeleton'

export function TeamCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col justify-between space-y-3.5 rounded-2xl border border-border/60 bg-card/80 p-4 sm:p-5 shadow-[0_16px_40px_rgba(0,0,0,0.65)]"
    >
      {/* Top Meta Bar Skeleton */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-5.5 w-10 rounded-md" />
          <Skeleton className="h-5.5 w-32 rounded-md sm:w-44" />
        </div>
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-7.5 w-8 rounded-lg sm:w-20 bg-[#161d28]/80" />
          <Skeleton className="size-7.5 rounded-lg bg-[#161d28]/80" />
        </div>
      </div>

      {/* 3 Member Slots */}
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {[1, 2, 3].map((slot) => (
          <div
            key={slot}
            className="flex h-[60px] sm:h-[64px] w-full items-center justify-between gap-3 rounded-xl border border-white/[0.14] bg-[#161d28]/80 px-3.5 py-2.5"
          >
            {/* Left: Avatar + text details */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Skeleton className="size-11.5 sm:size-12 rounded-full shrink-0" />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-3.5 w-20 sm:w-24 rounded" />
                  <Skeleton className="size-3.5 rounded-full" />
                </div>
                <Skeleton className="h-4 w-16 sm:w-20 rounded" />
              </div>
            </div>

            {/* Right: Gear strip */}
            <div className="flex items-center gap-2.5 border-l border-white/12 pl-3">
              <Skeleton className="size-8.5 sm:size-9 rounded-md" />
              <Skeleton className="size-8 sm:size-8.5 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer Skeleton */}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2.5">
        <Skeleton className="h-3.5 w-28 rounded" />
        <Skeleton className="h-3.5 w-24 rounded" />
      </div>
    </div>
  )
}
