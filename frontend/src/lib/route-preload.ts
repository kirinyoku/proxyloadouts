import type React from 'react'
import { lazyWithChunkRetry } from './chunk-reload'

export const loadShowcasePage = lazyWithChunkRetry(() =>
  import('@/pages/ShowcasePage').then((m) => ({ default: m.ShowcasePage })),
)
export const loadLoginPage = lazyWithChunkRetry(() =>
  import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
export const loadAuthCallbackPage = lazyWithChunkRetry(() =>
  import('@/pages/AuthCallbackPage').then((m) => ({ default: m.AuthCallbackPage })),
)
export const loadRosterPage = lazyWithChunkRetry(() =>
  import('@/pages/RosterPage').then((m) => ({ default: m.RosterPage })),
)
export const loadTeamsPage = lazyWithChunkRetry(() =>
  import('@/pages/TeamsPage').then((m) => ({ default: m.TeamsPage })),
)
export const loadTeamBuilderPage = lazyWithChunkRetry(() =>
  import('@/pages/TeamBuilderPage').then((m) => ({ default: m.TeamBuilderPage })),
)
export const loadSettingsPage = lazyWithChunkRetry(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
export const loadAboutPage = lazyWithChunkRetry(() =>
  import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })),
)
export const loadPrivacyPage = lazyWithChunkRetry(() =>
  import('@/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
)
export const loadNotFoundPage = lazyWithChunkRetry(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
export const loadPublicBuildPage = lazyWithChunkRetry(() =>
  import('@/pages/PublicBuildPage').then((m) => ({ default: m.PublicBuildPage })),
)
export const loadPublicTeamPage = lazyWithChunkRetry(() =>
  import('@/pages/PublicTeamPage').then((m) => ({ default: m.PublicTeamPage })),
)

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
    void loader().catch(() => {
      // Background preload failures are handled safely by lazyWithChunkRetry or suppressed
    })
  }
}

/**
 * Preloads high-frequency routes in browser idle time after initial mount.
 */
export function preloadCoreRoutes(): void {
  if (typeof window === 'undefined') return

  const run = () => {
    void loadShowcasePage().catch(() => {})
    void loadRosterPage().catch(() => {})
    void loadTeamsPage().catch(() => {})
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 2500 })
  } else {
    setTimeout(run, 1000)
  }
}
