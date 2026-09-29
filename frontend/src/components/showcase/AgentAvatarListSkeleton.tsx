import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface AgentAvatarListSkeletonProps {
  count?: number
  className?: string
}

export function AgentAvatarListSkeleton({
  count = 6,
  className,
}: AgentAvatarListSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'rounded-3xl border border-border/80 bg-gradient-to-b from-card to-background/90 p-2 sm:p-2.5 shadow-xl flex md:flex-col items-center gap-2 w-full md:w-auto shrink-0 overflow-x-auto md:overflow-y-auto md:max-h-[calc(100vh-8rem)] scrollbar-thin',
        className,
      )}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="relative shrink-0 p-0.5">
          <Skeleton className="size-11 sm:size-12 rounded-full border-2 border-white/10" />
        </div>
      ))}
    </div>
  )
}
