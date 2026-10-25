import type React from 'react'

export const loadShowcasePage = () =>
  import('@/pages/ShowcasePage').then((m) => ({ default: m.ShowcasePage }))
export const loadLoginPage = () =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage }))
export const loadAuthCallbackPage = () =>
  import('@/pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage }))
export const loadRosterPage = () =>
  import('@/pages/RosterPage').then((m) => ({ default: m.RosterPage }))
export const loadTeamsPage = () =>
  import('@/pages/TeamsPage').then((m) => ({ default: m.TeamsPage }))
export const loadTeamBuilderPage = () =>
  import('@/pages/TeamBuilderPage').then((m) => ({ default: m.TeamBuilderPage }))
export const loadSettingsPage = () =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
export const loadAboutPage = () =>
  import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage }))
export const loadPrivacyPage = () =>
  import('@/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage }))
export const loadNotFoundPage = () =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage }))

export const routePreloaders: Record<
  string,
  () => Promise<{ default: React.ComponentType<any> }>
> = {
  '/showcase': loadShowcasePage,
  '/roster': loadRosterPage,
  '/teams': loadTeamsPage,
  '/settings': loadSettingsPage,
  '/about': loadAboutPage,
  '/privacy': loadPrivacyPage,
  '/login': loadLoginPage,
}

/**
 * Preloads a specific route component chunk on hover/focus to eliminate navigation delays.
 */
export function preloadRoute(path: string): void {
  // Strip query string when matching route preloader
  const basePath = path.split('?')[0] ?? path
  const loader = routePreloaders[basePath]
  if (loader) {
    void loader()
  }
}

/**
 * Preloads high-frequency routes in browser idle time after initial mount.
 */
export function preloadCoreRoutes(): void {
  if (typeof window === 'undefined') return

  const run = () => {
    void loadShowcasePage()
    void loadRosterPage()
    void loadTeamsPage()
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 2500 })
  } else {
    setTimeout(run, 1000)
  }
}
