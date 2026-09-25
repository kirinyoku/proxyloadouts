import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { InterknotTerminalError } from './InterknotTerminalError'
import { ApiError } from '@/api/client'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru' },
  }),
}))

describe('InterknotTerminalError component', () => {
  it('renders 404 full variant with UID and inline search form', () => {
    const html = renderToString(
      <InterknotTerminalError
        status={404}
        uid="922222222"
        onScanUid={() => {}}
        onRetry={() => {}}
      />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('HTTP 404')
    expect(html).toContain('922222222')
    expect(html).toContain('terminalError.notFound.statusTag')
  })

  it('renders 429 rate limit variant with throttle status and cooldown note', () => {
    const error = new ApiError(429, 'Too many requests')
    const html = renderToString(
      <InterknotTerminalError
        error={error}
        onRetry={() => {}}
      />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('HTTP 429')
    expect(html).toContain('terminalError.rateLimited.statusTag')
    expect(html).toContain('terminalError.rateLimited.recommendedWait')
  })

  it('renders 502 bad gateway variant with upstream downtime note', () => {
    const error = new ApiError(502, 'Bad Gateway')
    const html = renderToString(
      <InterknotTerminalError
        error={error}
        onRetry={() => {}}
      />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('HTTP 502')
    expect(html).toContain('terminalError.gatewayError.statusTag')
  })

  it('renders compact variant for lists with custom error code and title', () => {
    const html = renderToString(
      <InterknotTerminalError
        variant="compact"
        errorCode="500_DB"
        title="Failed to load teams list"
        onRetry={() => {}}
      />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('500_DB')
    expect(html).toContain('Failed to load teams list')
    expect(html).toContain('terminalError.retry')
  })
})
