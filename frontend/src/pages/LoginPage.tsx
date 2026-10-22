import { Link, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Home } from 'lucide-react'
import { useMe } from '@/api/hooks'

import { getPostLoginRedirect, savePostLoginRedirect } from '@/lib/auth-storage'
import { Button } from '@/components/ui/button'
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
      <title>{t('login.pageTitle')}</title>
      <meta name="description" content={t('login.metaDescription')} />

      {/* Top navigation back link */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <Link to="/" aria-label={t('login.backToHome')}>
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">{t('login.backToHome')}</span>
          </Link>
        </Button>
      </div>

      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-3">
          <Link
            to="/"
            className="inline-block rounded-xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('login.backToHome')}
          >
            <PxlLogo size="lg" showMark layout="vertical" className="items-center text-center" />
          </Link>
          <h1 className="sr-only">{t('login.title')}</h1>
          <p className="pt-1 text-balance text-sm text-muted-foreground">
            {t('login.description')}
          </p>
        </div>

        <div className="space-y-3">
          <a
            href={DISCORD_LOGIN_URL}
            onClick={() => savePostLoginRedirect(from)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-5 font-medium text-white shadow-lg shadow-[#5865F2]/25 transition-all hover:bg-[#4752c4] hover:shadow-[#5865F2]/40 active:translate-y-px"
          >
            <DiscordIcon className="size-5" />
            {t('login.discordButton')}
          </a>

          <Button
            variant="outline"
            size="lg"
            asChild
            className="h-11 w-full rounded-lg gap-2 border-border/80 bg-background/50 font-heading text-xs tracking-wider text-muted-foreground transition-all hover:border-border hover:bg-muted hover:text-foreground active:translate-y-px"
          >
            <Link to="/">
              <Home className="size-4" />
              <span>{t('login.backToHome')}</span>
            </Link>
          </Button>
        </div>

        <p className="text-pretty text-xs leading-relaxed text-muted-foreground">
          {t('login.guestNote')}
        </p>
      </div>
    </main>
  )
}
