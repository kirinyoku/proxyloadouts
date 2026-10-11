import { Skeleton } from '@/components/ui/skeleton'

export function TeamCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3 sm:gap-3.5 rounded-(--radius-card) border-2 border-black bg-card p-3.5 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_32px_-16px_rgba(0,0,0,0.9)]"
    >
      {/* Top Meta Bar Skeleton */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-5 w-32 rounded-md sm:w-44" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-(--radius-input) sm:w-20" />
          <Skeleton className="size-8 rounded-(--radius-input)" />
        </div>
      </div>

      {/* 3 Member Slots */}
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {[1, 2, 3].map((slot) => (
          <div
            key={slot}
            className="flex min-h-[60px] sm:min-h-[68px] w-full items-center justify-between gap-3 rounded-(--radius-input-lg) border-2 border-black bg-subtle px-2.5 sm:px-3.5 py-2"
          >
            {/* Left: Avatar + text details */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Skeleton className="size-10 sm:size-11 rounded-full shrink-0" />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-3.5 w-20 sm:w-24 rounded" />
                  <Skeleton className="size-3.5 rounded-full" />
                </div>
                <Skeleton className="h-3 w-16 sm:w-20 rounded" />
              </div>
            </div>

            {/* Right: Gear strip */}
            <div className="flex items-center gap-2 border-l border-dashed border-white/10 pl-3">
              <Skeleton className="size-7.5 sm:size-8.5 rounded-md" />
              <Skeleton className="size-7 sm:size-8 rounded-full" />
              <Skeleton className="size-7 sm:size-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer Skeleton */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-dashed border-white/10 pt-2.5">
        <Skeleton className="h-3.5 w-28 rounded" />
        <Skeleton className="h-3.5 w-24 rounded" />
      </div>
    </div>
  )
}
