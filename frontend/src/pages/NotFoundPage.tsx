import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Home } from 'lucide-react'
import { InterknotTerminalError } from '@/components/common/InterknotTerminalError'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    document.title = t('notFoundPage.pageTitle')
  }, [t])

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  const currentHost =
    typeof window !== 'undefined' && window.location?.host
      ? window.location.host
      : 'proxyloadouts.app'

  return (
    <div className="flex min-h-[calc(100vh-14rem)] flex-col items-center justify-center py-6 sm:py-12">
      <title>{t('notFoundPage.pageTitle')}</title>
      <meta name="description" content={t('notFoundPage.description')} />
      <InterknotTerminalError
        status={404}
        query={location.pathname}
        host={currentHost}
        statusTag={t('notFoundPage.badge')}
        screenStatus={t('notFoundPage.diagnostic.status')}
        title={t('notFoundPage.title')}
        description={t('notFoundPage.description')}
        className="w-full max-w-2xl mx-auto"
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBack}
              className="h-9 min-w-28 px-4 cursor-pointer"
            >
              <ArrowLeft className="size-3.5 mr-1.5" />
              {t('notFoundPage.actions.back')}
            </Button>
            <Button asChild size="sm" className="h-9 min-w-36 px-4">
              <Link to="/">
                <Home className="size-3.5 mr-1.5" />
                {t('notFoundPage.actions.home')}
              </Link>
            </Button>
          </>
        }
      />
    </div>
  )
}
