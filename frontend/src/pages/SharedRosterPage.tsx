import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useParams } from 'react-router-dom'
import { fetchSharedRoster, fetchSharedSquads } from '@/api/client'
import { PageLoader } from '@/components/common/PageLoader'
import { SharedUnavailableState } from '@/components/common/SharedUnavailableState'
import { ShowcaseProfileIdentity } from '@/components/showcase/ShowcaseProfileHeader'
import { ShowcaseSavedPresets } from '@/components/showcase/ShowcaseSavedPresets'
import { ShowcaseSquads } from '@/components/showcase/ShowcaseSquads'

export default function SharedRosterPage() {
  const { token } = useParams<{ token: string }>()
  const location = useLocation()
  const isSquads = location.pathname.startsWith('/shared/squads')
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'ru'
  const { data, isPending, isError } = useQuery({
    queryKey: [isSquads ? 'shared-squads' : 'shared-roster', token, lang],
    queryFn: ({ signal }) => isSquads ? fetchSharedSquads(token!, lang, signal) : fetchSharedRoster(token!, lang, signal),
    enabled: Boolean(token),
    gcTime: 0,
  })

  if (isPending) return <PageLoader label={t('common.loading')} />
  if (isError || !data) {
    return (
      <SharedUnavailableState
        title={t('sharing.rosterNotFoundTitle')}
        description={t('sharing.rosterNotFoundDesc')}
      />
    )
  }

  const profileHeader = (
    <div className="flex min-w-0 items-center rounded-2xl xl:max-w-[300px] border border-white/[0.08] bg-card/96 p-2.5 shadow-lg backdrop-blur-sm sm:px-3.5 sm:py-2">
      <ShowcaseProfileIdentity
        profile={{ ...data.owner, nickname: data.owner.nickname || data.owner.uid, avatar_url: data.owner.avatar_url ?? undefined }}
        owner={data.owner}
      />
    </div>
  )

  const hasSquads = Boolean(data.teams && data.teams.length > 0)

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-6 sm:px-4">
      {hasSquads ? (
        <div className="space-y-6">
          {profileHeader}
          <ShowcaseSquads teams={data.teams} />
        </div>
      ) : (
        <ShowcaseSavedPresets
          builds={data.builds}
          profile={profileHeader}
        />
      )}
    </div>
  )
}
