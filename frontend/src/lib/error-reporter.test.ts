import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportError, resetErrorReporterForTests } from './error-reporter'

describe('error-reporter', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    resetErrorReporterForTests()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('sends formatted error payload to /api/v1/telemetry/client-error and deduplicates identical errors', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const err = new TypeError('Cannot read properties of undefined')
    reportError(err, { componentStack: '\n    at RosterPage' })
    // Second identical call should be suppressed by session deduplication
    reportError(err, { componentStack: '\n    at RosterPage' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [endpoint, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(endpoint).toBe('/api/v1/telemetry/client-error')
    expect(init.method).toBe('POST')

    const parsed = JSON.parse(init.body as string) as Record<string, string>
    expect(parsed.message).toContain('TypeError: Cannot read properties of undefined')
    expect(parsed.component_stack).toBe('at RosterPage')
  })
})
