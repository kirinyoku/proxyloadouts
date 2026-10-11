import { AgentAvatarListSkeleton } from '@/components/showcase/AgentAvatarListSkeleton'
import { AgentBuildInspectorSkeleton } from '@/components/showcase/AgentBuildInspectorSkeleton'
import { RosterBuildToolbarSkeleton } from '@/components/roster/RosterBuildToolbarSkeleton'
import { cn } from '@/lib/utils'

interface RosterPageSkeletonProps {
  className?: string
}

export function RosterPageSkeleton({ className }: RosterPageSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      aria-busy="true"
      className={cn('flex flex-col md:flex-row md:items-stretch gap-3', className)}
    >
      {/* Left column: vertical list of agent avatar tabs */}
      <AgentAvatarListSkeleton count={6} />

      {/* Right column: detailed build inspector */}
      <div className="min-w-0 flex-1 w-full">
        <AgentBuildInspectorSkeleton topBar={<RosterBuildToolbarSkeleton />} showMobileSections />
      </div>
    </div>
  )
}
