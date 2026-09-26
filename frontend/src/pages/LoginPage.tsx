import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMe } from '@/api/hooks'

import { getPostLoginRedirect, savePostLoginRedirect } from '@/lib/auth-storage'
import { DiscordIcon } from '@/components/common/DiscordIcon'
import { PxlLogo } from '@/components/common/PxlLogo'

const DISCORD_LOGIN_URL = '/api/v1/auth/discord/login'

export function LoginPage() {
  const { t } = useTranslation()
  const { data: me, isPending } = useMe()
  const location = useLocation()

  const state = location.state as { from?: string } | null
  const from = typeof state?.from === 'string' ? state.from : undefined

  if (!isPending && me) {
    return <Navigate to={getPostLoginRedirect('/')} replace />
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-3">
          <PxlLogo size="lg" className="items-center text-center" />
          <h1 className="sr-only">{t('login.title')}</h1>
          <p className="pt-1 text-balance text-sm text-muted-foreground">
            {t('login.description')}
          </p>
        </div>

        <a
          href={DISCORD_LOGIN_URL}
          onClick={() => savePostLoginRedirect(from)}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-5 font-medium text-white shadow-lg shadow-[#5865F2]/25 transition-all hover:bg-[#4752c4] hover:shadow-[#5865F2]/40 active:translate-y-px"
        >
          <DiscordIcon className="size-5" />
          {t('login.discordButton')}
        </a>

        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
          {t('login.guestNote')}
        </p>
      </div>
    </main>
  )
}
