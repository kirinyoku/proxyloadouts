import { describe, expect, it, beforeEach, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ZzzBackground } from './ZzzBackground'
import { setBgAnimationMode } from '@/lib/bg-animation'

describe('ZzzBackground component', () => {
  beforeEach(() => {
    localStorage.clear()
    setBgAnimationMode('enabled')
  })

  it('renders fixed background container with marquee rows and ZZZ typography when enabled', () => {
    const html = renderToString(<ZzzBackground />)

    expect(html).toContain('zzz-bg-animated-root')
    expect(html).toContain('fixed inset-0')
    expect(html).toContain('pointer-events-none')
    expect(html).toContain('zzz-marquee-track-left')
    expect(html).toContain('zzz-marquee-track-right')
    expect(html).toContain('PROXYLOADOUTS')
    expect(html).toContain('text-stroke-zzz')
  })

  it('renders nothing when background animation is disabled', () => {
    setBgAnimationMode('disabled')
    const html = renderToString(<ZzzBackground />)
    expect(html).toBe('')
  })

  it('renders nothing on mobile viewport even when background animation is enabled in settings', () => {
    const originalMatchMedia = window.matchMedia
    try {
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: true,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))

      const html = renderToString(<ZzzBackground />)
      expect(html).toBe('')
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
})
