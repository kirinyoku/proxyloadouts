import { useEffect } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMe } from '@/api/hooks'
import { consumePostLoginRedirect } from '@/lib/auth-storage'
import { PageLoader } from '@/components/common/PageLoader'

export function AuthCallbackPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: me, isPending, isError, refetch } = useMe()

  useEffect(() => {
    if (me) {
      navigate(consumePostLoginRedirect('/'), { replace: true })
    }
  }, [me, navigate])

  if (!isPending && !me) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <TriangleAlert className="size-10 text-destructive" />
        <div>
          <h1 className="text-xl font-semibold">{t('auth.failedTitle')}</h1>
          <p className="mt-1 max-w-sm text-muted-foreground">
            {isError
              ? t('auth.errorDesc')
              : t('auth.noSessionDesc')}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            {t('auth.retry')}
          </button>
          <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
            {t('auth.backToLogin')}
          </Link>
        </div>
      </main>
    )
  }

  return <PageLoader label={t('auth.completing')} />
}
