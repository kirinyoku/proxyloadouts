import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useMe } from '@/api/hooks'
import { PageLoader } from '@/components/common/PageLoader'

export function ProtectedRoute() {
  const { t } = useTranslation()
  const { data: me, isPending } = useMe()
  const location = useLocation()

  if (isPending) {
    return <PageLoader label={t('common.loading')} />
  }

  if (!me) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
