import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { WEngineCardSkeleton } from '@/components/showcase/WEngineCardSkeleton'
import { AgentStatsPanelSkeleton } from '@/components/showcase/AgentStatsPanelSkeleton'
import { DriveDiscGridSkeleton } from '@/components/showcase/DriveDiscGridSkeleton'

interface AgentBuildInspectorSkeletonProps {
  topBar?: React.ReactNode
  showDiscActions?: boolean
  showMobileSections?: boolean
  className?: string
}

export function AgentBuildInspectorSkeleton({
  topBar,
  showDiscActions = false,
  showMobileSections = false,
  className,
}: AgentBuildInspectorSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative rounded-3xl border border-white/[0.08] bg-gradient-to-b from-[#121722]/95 via-[#0f141d]/95 to-[#0b0e14]/98 p-2.5 md:py-3 md:px-3.5 shadow-2xl backdrop-blur-xl',
        className,
      )}
    >
      <div className="relative z-10 space-y-2.5">
        {topBar}

        {showMobileSections && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-2">
              <Skeleton className="h-6 w-36" />
              {showDiscActions && <Skeleton className="h-8 w-28 shrink-0 rounded-xl" />}
            </div>
            <div className="lg:hidden">
              <WEngineCardSkeleton />
            </div>
            <div className="mx-auto grid max-w-sm grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/40 p-0.5 lg:hidden">
              <Skeleton className="h-7.5 rounded-[6px]" />
              <Skeleton className="h-7.5 rounded-[6px]" />
            </div>
          </>
        )}

        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-[270px_minmax(0,1fr)]">
          {/* Left Column: W-Engine + Vertical Stats List */}
          <div className="space-y-2.5">
            <WEngineCardSkeleton className={showMobileSections ? 'hidden lg:block' : undefined} />
            {showMobileSections ? (
              <>
                <AgentStatsPanelSkeleton compact className="lg:hidden" />
                <AgentStatsPanelSkeleton className="hidden lg:block" />
              </>
            ) : (
              <AgentStatsPanelSkeleton />
            )}
          </div>

          {/* Right Column: 2x3 Drive Disc Grid */}
          <div className={cn('min-w-0', showMobileSections && 'hidden lg:block')}>
            <DriveDiscGridSkeleton showActions={!showMobileSections && showDiscActions} />
          </div>
        </div>

        {/* Footer skeleton */}
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-2">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </div>
    </div>
  )
}
