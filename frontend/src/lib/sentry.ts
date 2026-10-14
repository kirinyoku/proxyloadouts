import * as Sentry from '@sentry/react'

/**
 * Initializes Sentry client if VITE_SENTRY_DSN environment variable is set.
 * In local dev without DSN, it remains dormant with zero overhead.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) {
    console.warn('[Sentry] VITE_SENTRY_DSN не найден в окружении (Sentry спит).')
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE || 'production',
    enabled: Boolean(dsn),
    tracesSampleRate: 0.1,
  })
  console.info('[Sentry] Инициализирован для frontend')
}

/**
 * Captures an exception to Sentry (and logs to console).
 */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  console.error('Reported uncaught error:', error, context)
  if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.captureException(error, { extra: context })
  }
}



