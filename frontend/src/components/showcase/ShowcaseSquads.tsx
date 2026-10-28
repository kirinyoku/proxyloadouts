import { lazy, Suspense, useRef, useState } from 'react'
import { AlertCircle, Check, Share2, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/common/EmptyState'
import { TeamMemberPreview } from '@/components/teams/TeamMemberPreview'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import { formatDateTime } from '@/lib/format'
import type { Build, TeamSummary } from '@/types'

const BuildInspectorDialog = lazy(() =>
  import('@/components/roster/BuildInspectorDialog').then((module) => ({
    default: module.BuildInspectorDialog,
  })),
)

export interface ShowcaseSquadsProps {
  teams: TeamSummary[]
}

export function ShowcaseSquads({ teams }: ShowcaseSquadsProps) {
  const { t } = useTranslation()
  const [inspectBuild, setInspectBuild] = useState<Build | null>(null)
  const [copiedTeamId, setCopiedTeamId] = useState<string | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  if (teams.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t('showcase.noPublicSquads')}
        description=""
      />
    )
  }

  async function handleCopyTeamLink(teamId: string) {
    const url = `${window.location.origin}/t/${teamId}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedTeamId(teamId)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopiedTeamId(null), 2000)
      toast.success(t('showcase.squadLinkCopied'))
    } catch {
      // clipboard access error ignored
    }
  }

  return (
    <div className="space-y-4">
      {teams.map((summary) => {
        const { team, members, report } = summary
        const sortedMembers = [...(members ?? [])].sort((a, b) => a.slot_number - b.slot_number)
        const hasConflict = Boolean(report && !report.is_valid)

        return (
          <div
            key={team.id}
            className="rounded-3xl border border-white/[0.08] bg-card/96 p-4 sm:p-5 shadow-xl backdrop-blur-sm space-y-4"
          >
            {/* Squad Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-white/[0.08] pb-3">
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-lg sm:text-xl font-bold tracking-wide text-foreground">
                    {team.name}
                  </h3>
                  {hasConflict && (
                    <span
                      title={t('teams.conflictTooltip')}
                      className="inline-flex items-center gap-1 text-xs text-amber-400"
                    >
                      <AlertCircle className="size-4" />
                    </span>
                  )}
                </div>

                {team.description?.trim() && (
                  <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">
                    <span className="font-heading text-primary/70 mr-1.5 font-bold">//</span>
                    {team.description.trim()}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0 sm:self-start">
                <span className="font-mono text-[11px] text-muted-foreground hidden sm:inline">
                  {formatDateTime(team.updated_at || team.created_at)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyTeamLink(team.id)}
                  title={t('showcase.copySquadLink')}
                  className="h-8 gap-1.5 rounded-xl border-white/10 text-xs font-medium hover:border-primary/40 hover:bg-primary/10 hover:text-primary transition-all"
                >
                  {copiedTeamId === team.id ? (
                    <>
                      <Check className="size-3.5 stroke-[2.5] text-primary" />
                      <span>{t('sharing.linkCopied')}</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="size-3.5" />
                      <span>{t('sharing.share')}</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Squad Members */}
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3].map((slotNumber) => {
                const member = sortedMembers.find((m) => m.slot_number === slotNumber)
                if (!member) return null
                return (
                  <TeamMemberPreview
                    key={slotNumber}
                    member={member}
                    slotNumber={slotNumber}
                    teamId={team.id}
                    onInspectClick={(build) => setInspectBuild(build)}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Build Inspector Dialog */}
      {inspectBuild !== null && (
        <Suspense fallback={null}>
          <BuildInspectorDialog
            key={inspectBuild.id}
            build={inspectBuild}
            open={inspectBuild !== null}
            onOpenChange={(open) => {
              if (!open) setInspectBuild(null)
            }}
          />
        </Suspense>
      )}
    </div>
  )
}
