const SERVICE_WORKER_URL = '/sw.js'

/** Enables runtime caching for immutable assets and third-party game images. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }

  void navigator.serviceWorker
    .register(SERVICE_WORKER_URL, {
      scope: '/',
      updateViaCache: 'none',
    })
    .catch(() => {
      // Caching is an enhancement; the app must remain usable without it.
    })
}
