import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AppHeader } from '@/components/common/AppHeader'
import { AppFooter } from '@/components/common/AppFooter'
import { PageLoader } from '@/components/common/PageLoader'

function LayoutFallback() {
  const { t } = useTranslation()
  return <PageLoader fixed={false} label={t('common.loadingModule')} />
}

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-2.5 sm:py-3">
          <Suspense fallback={<LayoutFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <AppFooter />
    </div>
  )
}
