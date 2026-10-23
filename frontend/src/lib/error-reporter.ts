const CLIENT_ERROR_ENDPOINT = '/api/v1/telemetry/client-error'
const MAX_MESSAGE_LEN = 500
const MAX_STACK_LEN = 4000
const MAX_URL_LEN = 500
const MAX_SESSION_SIGNATURES = 50

const reportedSignatures = new Set<string>()
let initialized = false

export interface ErrorReportContext {
  componentStack?: string | null
  [key: string]: unknown
}

function truncate(val: string | undefined | null, maxLen: number): string | undefined {
  if (!val) return undefined
  const trimmed = val.trim()
  if (!trimmed) return undefined
  return trimmed.length > maxLen ? `${trimmed.slice(0, maxLen - 1)}…` : trimmed
}

function extractErrorDetails(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      message: error.name && !error.message.startsWith(error.name)
        ? `${error.name}: ${error.message}`
        : error.message || error.name || 'Unknown Error',
      stack: error.stack,
    }
  }
  if (typeof error === 'string') {
    return { message: error }
  }
  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: String(error) }
  }
}

/**
 * Reports an unhandled client-side exception to the backend telemetry endpoint,
 * which deduplicates and forwards the alert to the configured Telegram bot.
 */
export function reportError(error: unknown, context?: ErrorReportContext): void {
  console.error('Reported uncaught error:', error, context)

  const { message: rawMessage, stack: rawStack } = extractErrorDetails(error)
  const message = truncate(rawMessage, MAX_MESSAGE_LEN)
  if (!message) return

  const stack = truncate(rawStack, MAX_STACK_LEN)
  const componentStack = truncate(
    typeof context?.componentStack === 'string' ? context.componentStack : undefined,
    MAX_STACK_LEN,
  )
  const url =
    typeof window !== 'undefined' && window.location?.href
      ? truncate(window.location.href, MAX_URL_LEN)
      : undefined

  const signature = `${message}|${stack?.split('\n')[0] ?? ''}`
  if (reportedSignatures.has(signature)) {
    return
  }
  if (reportedSignatures.size >= MAX_SESSION_SIGNATURES) {
    reportedSignatures.clear()
  }
  reportedSignatures.add(signature)

  if (typeof fetch !== 'function') return

  void fetch(CLIENT_ERROR_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: JSON.stringify({
      message,
      stack,
      component_stack: componentStack,
      url,
    }),
    keepalive: true,
  }).catch(() => {
    // Telemetry failures must never trigger secondary unhandled rejections.
  })
}

/**
 * Registers global window listeners for uncaught runtime errors and unhandled
 * promise rejections.
 */
export function initErrorReporter(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true

  window.addEventListener('error', (event: ErrorEvent) => {
    reportError(event.error ?? event.message ?? 'Window ErrorEvent')
  })

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    reportError(event.reason ?? 'Unhandled Promise Rejection')
  })
}

/**
 * Resets internal deduplication state (used in unit tests).
 */
export function resetErrorReporterForTests(): void {
  reportedSignatures.clear()
}
