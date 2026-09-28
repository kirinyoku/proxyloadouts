import { Skeleton } from '@/components/ui/skeleton'

/**
 * Mirrors the layout of `ProxyAccountRow` so the list does not reflow when the
 * accounts query resolves.
 */
export function ProxyAccountRowSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-[1fr_auto_auto] items-center gap-x-1.5 gap-y-2 px-4 py-3 sm:flex sm:gap-2 sm:px-5 sm:py-2.5"
    >
      {/* 1. Identity */}
      <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2 sm:shrink-0 sm:gap-2.5">
        <Skeleton className="size-2 shrink-0 rounded-full" />
        <div className="flex items-center gap-1.5 min-w-0">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-8 rounded" />
        </div>
      </div>

      {/* 2. Added date */}
      <div className="col-span-full row-start-2 pl-4 sm:pl-0 sm:ml-2 sm:mr-auto">
        <Skeleton className="h-3 w-24 rounded" />
      </div>

      {/* 3. Copy button skeleton */}
      <Skeleton className="col-start-2 row-start-1 size-8.5 rounded-lg sm:shrink-0" />

      {/* 4. Make Active skeleton */}
      <Skeleton className="col-span-full row-start-3 h-8.5 w-full rounded-lg sm:w-28 sm:shrink-0" />

      {/* 5. Delete button skeleton */}
      <Skeleton className="col-start-3 row-start-1 size-8.5 rounded-lg sm:shrink-0" />
    </div>
  )
}
