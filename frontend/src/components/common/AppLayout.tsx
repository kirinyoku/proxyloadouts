import { Outlet } from 'react-router-dom'
import { AppHeader } from '@/components/common/AppHeader'
import { AppFooter } from '@/components/common/AppFooter'

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex min-h-dvh flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-2.5 sm:py-3">
          <Outlet />
        </main>
      </div>
      <AppFooter />
    </div>
  )
}
