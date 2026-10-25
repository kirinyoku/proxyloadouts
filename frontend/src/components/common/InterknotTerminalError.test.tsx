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
    expect(html).toContain('title="common.clear"')
    expect(html).toContain('title="terminalError.find"')
    expect(html).toContain('md:items-stretch')
    expect(html).toContain('h-full flex flex-col justify-between')
  })

  it('renders 400 bad request with UID search form and clear button', () => {
    const html = renderToString(
      <InterknotTerminalError
        status={400}
        uid="12345678"
        onScanUid={() => {}}
        onRetry={() => {}}
      />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('HTTP 400')
    expect(html).toContain('12345678')
    expect(html).toContain('title="common.clear"')
    expect(html).toContain('title="terminalError.find"')
    expect(html).toContain('md:items-stretch')
    expect(html).toContain('h-full flex flex-col justify-between')
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

  it('renders custom query, host, and actions slot in full 404 mode', () => {
    const html = renderToString(
      <InterknotTerminalError
        status={404}
        query="/custom-path"
        host="test.proxyloadouts.com"
        actions={<button type="button">Custom Home</button>}
      />
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('/custom-path')
    expect(html).toContain('test.proxyloadouts.com')
    expect(html).toContain('Custom Home')
  })
})
