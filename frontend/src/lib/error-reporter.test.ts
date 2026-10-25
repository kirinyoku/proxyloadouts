import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reportError, resetErrorReporterForTests } from './error-reporter'
import { CHUNK_RELOAD_STORAGE_KEY, resetChunkReloadForTests } from './chunk-reload'

describe('error-reporter', () => {
  const originalFetch = globalThis.fetch
  const originalLocation = window.location
  let reloadMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetErrorReporterForTests()
    resetChunkReloadForTests()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    })
    resetChunkReloadForTests()
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

  it('suppresses telemetry and triggers reload when error is a chunk load failure', () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const chunkErr = new TypeError('Importing a module script failed.')
    reportError(chunkErr, { componentStack: '\n    at SettingsPage' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('suppresses telemetry if a chunk reload happened recently', () => {
    sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now() - 2_000))
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const chunkErr = new TypeError('Failed to fetch dynamically imported module: /assets/test.js')
    reportError(chunkErr)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(reloadMock).not.toHaveBeenCalled()
  })
})
