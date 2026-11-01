import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePublicTeam } from '@/api/hooks'
import { PublicOwnerHeader } from '@/components/common/PublicOwnerHeader'
import { PageLoader } from '@/components/common/PageLoader'
import { SharedUnavailableState } from '@/components/common/SharedUnavailableState'
import { TeamCard } from '@/components/teams/TeamCard'

export function PublicTeamPage() {
  const { t } = useTranslation()
  const { teamId, token } = useParams<{ teamId?: string; token?: string }>()
  const { data, isLoading, isError } = usePublicTeam(teamId, token)

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-xl py-8">
        <PageLoader label={t('common.loading')} />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <SharedUnavailableState
        title={t('sharing.teamNotFoundTitle')}
        description={t('sharing.teamNotFoundDesc')}
      />
    )
  }

  const { team, owner } = data
  const pageTitle = t('sharing.teamPageTitle', { name: team.name })
  const pageDescription = t('sharing.teamPageMetaDesc', {
    name: team.name,
    owner: owner.nickname || owner.uid,
  })

  return (
    <div className="mx-auto w-full max-w-xl space-y-3.5 sm:space-y-4">
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      {/* Author Header */}
      <PublicOwnerHeader
        owner={owner}
        targetTab="squads"
        showShowcaseButton={false}
        showShareButton={false}
      />

      {/* Main Team Card */}
      <TeamCard
        summary={data}
        readOnly={true}
        shareUrl={typeof window !== 'undefined' && window.location ? window.location.href : undefined}
      />
    </div>
  )
}

export default PublicTeamPage
