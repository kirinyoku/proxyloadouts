import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { useIsMobile, MOBILE_MEDIA_QUERY } from './useIsMobile'

function TestComponent() {
  const isMobile = useIsMobile()
  return <div data-mobile={String(isMobile)}>{isMobile ? 'MOBILE' : 'DESKTOP'}</div>
}

describe('useIsMobile hook', () => {
  const originalMatchMedia = window.matchMedia

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('renders false (DESKTOP) during SSR or when matchMedia is unavailable', () => {
    // @ts-expect-error test undefined matchMedia
    delete window.matchMedia

    const html = renderToString(<TestComponent />)
    expect(html).toContain('data-mobile="false"')
    expect(html).toContain('DESKTOP')
  })

  it('renders false when matchMedia does not match mobile query', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const html = renderToString(<TestComponent />)
    expect(html).toContain('data-mobile="false"')
    expect(html).toContain('DESKTOP')
  })

  it('renders true when matchMedia matches mobile query', () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === MOBILE_MEDIA_QUERY,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const html = renderToString(<TestComponent />)
    expect(html).toContain('data-mobile="true"')
    expect(html).toContain('MOBILE')
  })
})
