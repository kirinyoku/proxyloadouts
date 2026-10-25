export const CHUNK_RELOAD_STORAGE_KEY = 'pxl_chunk_reload_ts'
export const DEFAULT_CHUNK_RELOAD_COOLDOWN_MS = 15_000

/**
 * Known error message patterns across modern browsers indicating a failed
 * dynamic import or missing code-split script/stylesheet after a deployment.
 */
const CHUNK_ERROR_PATTERNS = [
  'Importing a module script failed', // Safari / WebKit (macOS, iOS, iPadOS)
  'Failed to fetch dynamically imported module', // Chromium (Chrome, Edge, Brave, Opera)
  'error loading dynamically imported module', // Firefox
  'Loading chunk', // Webpack / Rollup generic
  'Failed to load module script', // Edge / Safari variants
  'Unable to preload CSS', // Vite CSS preload plugin
]

/**
 * Checks whether an error is caused by a missing or outdated code-split chunk.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : typeof (error as { message?: unknown })?.message === 'string'
          ? ((error as { message: string }).message)
          : ''

  if (!message) return false

  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}

/**
 * Checks if a chunk reload occurred recently (within the specified window).
 */
export function isRecentChunkReload(windowMs = DEFAULT_CHUNK_RELOAD_COOLDOWN_MS): boolean {
  if (typeof window === 'undefined') return false

  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)
    if (!raw) return false
    const lastReload = Number(raw)
    return Number.isFinite(lastReload) && Date.now() - lastReload < windowMs
  } catch {
    return false
  }
}

/**
 * Attempts a page reload when a chunk loading error occurs, throttled by sessionStorage
 * to prevent infinite reload loops if the network is truly down or deployment is broken.
 * Returns true if a reload was initiated, or false if suppressed by cooldown.
 */
export function reloadOnChunkError(cooldownMs = DEFAULT_CHUNK_RELOAD_COOLDOWN_MS): boolean {
  if (typeof window === 'undefined') return false

  try {
    const raw = sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)
    const lastReload = raw ? Number(raw) : 0
    const now = Date.now()

    if (now - lastReload >= cooldownMs) {
      sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now))
      window.location.reload()
      return true
    }
  } catch {
    // If sessionStorage is unavailable (e.g. sandboxed iframe), still attempt reload
    try {
      window.location.reload()
      return true
    } catch {
      return false
    }
  }

  return false
}

/**
 * Wraps dynamic component loaders with automatic chunk mismatch recovery.
 * If the module fails to load due to a stale chunk hash from a previous deployment,
 * triggers an immediate page reload while returning a pending Promise so React Suspense
 * stays in its loading state instead of crashing with a red error screen.
 */
export function lazyWithChunkRetry<T>(importer: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      return await importer()
    } catch (error) {
      if (isChunkLoadError(error) && reloadOnChunkError()) {
        // Return a promise that stays unresolved while the browser performs the reload
        return new Promise<T>(() => {})
      }
      throw error
    }
  }
}

/**
 * Listens for Vite's preloadError event, which fires when dynamic imports or
 * modulepreloads fail at runtime.
 */
export function initVitePreloadErrorHandler(): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => {}
  }

  const onPreloadError = (event: Event) => {
    // Prevent Vite's default behaviour which re-throws the error to window.onerror
    event.preventDefault()
    reloadOnChunkError()
  }

  window.addEventListener('vite:preloadError', onPreloadError)
  return () => {
    if (typeof window.removeEventListener === 'function') {
      window.removeEventListener('vite:preloadError', onPreloadError)
    }
  }
}

/** Resets reload throttle state for tests. */
export function resetChunkReloadForTests(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY)
  } catch {
    // Ignore in non-browser test runners
  }
}
