import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { ApiError } from '@/api/client'
import { AppLayout } from '@/components/common/AppLayout'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { PageLoader } from '@/components/common/PageLoader'
import { ZzzBackground } from '@/components/common/ZzzBackground'
import { HomePage } from '@/pages/HomePage'

import {
  loadAuthCallbackPage,
  loadLoginPage,
  loadPrivacyPage,
  loadRosterPage,
  loadSettingsPage,
  loadShowcasePage,
  loadTeamBuilderPage,
  loadTeamsPage,
  preloadCoreRoutes,
} from '@/lib/route-preload'

const ShowcasePage = lazy(loadShowcasePage)
const LoginPage = lazy(loadLoginPage)
const AuthCallbackPage = lazy(loadAuthCallbackPage)
const RosterPage = lazy(loadRosterPage)
const TeamsPage = lazy(loadTeamsPage)
const TeamBuilderPage = lazy(loadTeamBuilderPage)
const SettingsPage = lazy(loadSettingsPage)
const PrivacyPage = lazy(loadPrivacyPage)

function BuildRouteRedirect() {
  const { buildId } = useParams<{ buildId: string }>()
  return <Navigate to={buildId ? `/roster?build=${encodeURIComponent(buildId)}` : '/roster'} replace />
}

function PageFallback() {
  const { t } = useTranslation()
  return <PageLoader label={t('common.loadingModule')} />
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          return error.status >= 500 && failureCount < 1
        }
        return failureCount < 1
      },
      retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
    },
  },
})

function App() {
  useEffect(() => {
    preloadCoreRoutes()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider delayDuration={100} skipDelayDuration={300}>
          <ErrorBoundary>
            <ZzzBackground />
            <div className="relative z-10">
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/auth/callback" element={<AuthCallbackPage />} />
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/showcase" element={<ShowcasePage />} />
                    <Route path="/privacy" element={<PrivacyPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route element={<ProtectedRoute />}>
                      <Route path="/roster" element={<RosterPage />} />
                      <Route path="/builds/:buildId" element={<BuildRouteRedirect />} />
                      <Route path="/teambuilder" element={<Navigate to="/teams/new" replace />} />
                      <Route path="/teams" element={<TeamsPage />} />
                      <Route path="/teams/new" element={<TeamBuilderPage />} />
                      <Route path="/teams/:teamId" element={<Navigate to="/teams" replace />} />
                      <Route path="/teams/:teamId/edit" element={<TeamBuilderPage />} />
                    </Route>
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </div>
          </ErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
