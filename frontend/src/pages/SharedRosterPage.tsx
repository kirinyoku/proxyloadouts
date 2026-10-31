import { useQuery } from '@tanstack/react-query'
import { Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { fetchSharedRoster } from '@/api/client'
import { EmptyState } from '@/components/common/EmptyState'
import { PageLoader } from '@/components/common/PageLoader'
import { ShowcaseProfileIdentity } from '@/components/showcase/ShowcaseProfileHeader'
import { ShowcaseSavedPresets } from '@/components/showcase/ShowcaseSavedPresets'

export default function SharedRosterPage() {
  const { token } = useParams<{ token: string }>()
  const { t, i18n } = useTranslation()
  const lang = i18n.language?.startsWith('en') ? 'en' : 'ru'
  const { data, isPending, isError } = useQuery({
    queryKey: ['shared-roster', token, lang],
    queryFn: ({ signal }) => fetchSharedRoster(token!, lang, signal),
    enabled: Boolean(token),
    gcTime: 0,
  })

  if (isPending) return <PageLoader label={t('common.loading')} />
  if (isError || !data) return <EmptyState icon={Layers} title={t('sharing.rosterNotFound')} />

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-4">
      <ShowcaseSavedPresets
        builds={data.builds}
        profile={
          <div className="flex min-w-0 items-center rounded-2xl xl:max-w-[300px] border border-white/[0.08] bg-card/96 p-2.5 shadow-lg backdrop-blur-sm sm:px-3.5 sm:py-2">
            <ShowcaseProfileIdentity
              profile={{ ...data.owner, nickname: data.owner.nickname || data.owner.uid, avatar_url: data.owner.avatar_url ?? undefined }}
              owner={data.owner}
            />
          </div>
        }
      />
    </div>
  )
}
