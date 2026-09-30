import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface TeamSlotListSkeletonProps {
  className?: string
}

export function TeamSlotListSkeleton({ className }: TeamSlotListSkeletonProps) {
  return (
    <article
      aria-hidden="true"
      className={cn(
        'group relative flex flex-col justify-between space-y-3.5 rounded-2xl border p-4 sm:p-5',
        'border-white/15 bg-[#141922] shadow-[0_16px_40px_rgba(0,0,0,0.65)]',
        className,
      )}
    >
      {/* Top Header: Squad Tag, Title, and Slot counter */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <Skeleton className="h-5.5 w-14 rounded-md" />
          <Skeleton className="h-5.5 w-36 sm:w-48 rounded-md" />
        </div>

        <Skeleton className="h-6 w-20 rounded-lg shrink-0" />
      </div>

      {/* 3 Squad Member Slots */}
      <div className="flex flex-col gap-2 sm:gap-2.5">
        {[1, 2, 3].map((slotNumber) => (
          <div
            key={slotNumber}
            className="flex h-[60px] sm:h-[64px] w-full items-center justify-between gap-3 rounded-xl border border-white/[0.14] bg-[#161d28]/80 px-3.5 py-2.5 shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
          >
            {/* Left: Avatar + text details */}
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Skeleton className="size-11.5 sm:size-12 rounded-full shrink-0" />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-3.5 w-20 sm:w-24 rounded" />
                  <Skeleton className="size-3.5 rounded-full" />
                </div>
                <Skeleton className="h-4 w-16 sm:w-20 rounded-md" />
              </div>
            </div>

            {/* Right: Slot badge (1P / 2P / 3P) */}
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-8 rounded border border-white/15" />
            </div>
          </div>
        ))}
      </div>

      {/* Footer: Notes / description prompt preview */}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2.5">
        <Skeleton className="h-3.5 w-56 rounded" />
      </div>
    </article>
  )
}
