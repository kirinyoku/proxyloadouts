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
    <div className={cn('w-full md:w-[70px] md:self-stretch md:shrink-0 relative', className)}>
      <div
        aria-hidden="true"
        className="flex w-full shrink-0 snap-x snap-mandatory items-center gap-2 overflow-x-auto rounded-3xl border border-white/[0.08] bg-[#111620]/90 p-2 sm:p-2.5 shadow-xl backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:absolute md:inset-x-0 md:top-0 md:w-full md:max-h-full md:flex-col md:overflow-y-auto md:overflow-x-hidden md:snap-none"
      >
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="relative shrink-0 p-0.5">
            <Skeleton className="size-11 sm:size-12 rounded-full border-2 border-white/10" />
          </div>
        ))}
      </div>
    </div>
  )
}
