import { lazy, Suspense, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Home, Sparkles, Users } from 'lucide-react'
import { usePublicTeam } from '@/api/hooks'
import { PublicOwnerHeader } from '@/components/common/PublicOwnerHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { PageLoader } from '@/components/common/PageLoader'
import { TeamMemberPreview } from '@/components/teams/TeamMemberPreview'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import type { Build } from '@/types'

const BuildInspectorDialog = lazy(() =>
  import('@/components/roster/BuildInspectorDialog').then((module) => ({
    default: module.BuildInspectorDialog,
  })),
)

export function PublicTeamPage() {
  const { t } = useTranslation()
  const { teamId } = useParams<{ teamId: string }>()
  const { data, isLoading, isError } = usePublicTeam(teamId)
  const [inspectBuild, setInspectBuild] = useState<Build | null>(null)

  const sortedMembers = useMemo(() => {
    return [...(data?.members ?? [])].sort((a, b) => a.slot_number - b.slot_number)
  }, [data?.members])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <PageLoader label={t('common.loading')} />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={Users}
          title={t('sharing.teamNotFoundTitle')}
          description={t('sharing.teamNotFoundDesc')}
          action={
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild variant="secondary" className="gap-2 rounded-xl">
                <Link to="/">
                  <Home className="size-4" />
                  <span>{t('sharing.backToHome')}</span>
                </Link>
              </Button>
              <Button asChild className="gap-2 rounded-xl bg-primary text-primary-foreground">
                <Link to="/showcase">
                  <Sparkles className="size-4" />
                  <span>{t('sharing.backToShowcase')}</span>
                </Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const { team, owner, report } = data
  const hasConflict = Boolean(report && !report.is_valid)
  const pageTitle = t('sharing.teamPageTitle', { name: team.name })
  const pageDescription = t('sharing.teamPageMetaDesc', {
    name: team.name,
    owner: owner.nickname || owner.uid,
  })

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 sm:px-4 py-4 sm:py-6">
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      {/* Author Header */}
      <PublicOwnerHeader owner={owner} targetTab="squads" />

      {/* Main Team Card */}
      <div className="rounded-3xl border border-white/[0.08] bg-card/96 p-4 sm:p-6 shadow-2xl backdrop-blur-sm space-y-5">
        {/* Team Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-wide text-foreground">
                {team.name}
              </h1>
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
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                <span className="font-heading text-primary/70 mr-1.5 font-bold">//</span>
                {team.description.trim()}
              </p>
            )}
          </div>

          <div className="shrink-0 font-mono text-xs text-muted-foreground sm:text-right">
            {formatDateTime(team.updated_at || team.created_at)}
          </div>
        </div>

        {/* Squad Members (1-3 slots) */}
        <div className="space-y-2">
          <h2 className="font-heading text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            {t('sharing.squadMembers')}
          </h2>
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
                  onInspectClick={(b) => setInspectBuild(b)}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* Build Inspector Modal when clicking any member */}
      {inspectBuild !== null && (
        <Suspense fallback={null}>
          <BuildInspectorDialog
            key={inspectBuild.id}
            build={inspectBuild}
            open={inspectBuild !== null}
            onOpenChange={(open) => {
              if (!open) setInspectBuild(null)
            }}
            teamName={team.name}
            publicMode={true}
            isPublicView={true}
          />
        </Suspense>
      )}
    </div>
  )
}
export default PublicTeamPage
