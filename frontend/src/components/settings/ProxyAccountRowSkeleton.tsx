import { Skeleton } from '@/components/ui/skeleton'

/**
 * Mirrors the card layout of `ProxyAccountRow` so the list does not reflow when the
 * accounts query resolves.
 */
export function ProxyAccountRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.015] p-3.5 sm:p-4"
    >
      {/* 1. Identity bar: avatar + name/uid on left, actions on right */}
      <div className="flex items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <Skeleton className="size-9.5 shrink-0 rounded-full" />
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-3.5 w-6 rounded-[3px]" />
              <Skeleton className="size-4 rounded-full" />
            </div>
            <div className="flex items-center">
              <Skeleton className="h-6 w-28 rounded-md" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <Skeleton className="h-7 w-20 rounded-lg" />
          <Skeleton className="size-7 rounded-lg" />
        </div>
      </div>

      {/* 2. Privacy toggles 3-cardlet grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5 border-t border-white/[0.04]">
        <div className="flex items-center justify-between gap-2.5 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-4.5 w-8 rounded-full" />
        </div>
        <div className="flex items-center justify-between gap-2.5 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-4.5 w-8 rounded-full" />
        </div>
        <div className="flex items-center justify-between gap-2.5 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
          <Skeleton className="h-3 w-20 rounded" />
          <Skeleton className="h-4.5 w-8 rounded-full" />
        </div>
      </div>

      {/* 3. Footer row: date */}
      <div className="flex items-center justify-between pt-0.5">
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>
  )
}
