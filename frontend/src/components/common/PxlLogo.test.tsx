import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { PxlLogo } from './PxlLogo'

describe('PxlLogo', () => {
  it('renders pure text wordmark without icons or svg', () => {
    const html = renderToString(<PxlLogo />)

    expect(html).not.toContain('<svg')
    expect(html).toContain('aria-label="PXL"')
    expect(html).toContain('text-primary')
  })

  it('renders default subtitle brand texts PROXY and LOADOUTS', () => {
    const html = renderToString(<PxlLogo />)

    expect(html).toContain('PROXY')
    expect(html).toContain('LOADOUTS')
  })

  it('can hide subtitle when showSubtitle is false', () => {
    const html = renderToString(<PxlLogo showSubtitle={false} />)

    expect(html).toContain('aria-label="PXL"')
    expect(html).not.toContain('PROXY')
  })

  it('renders custom subtitle text when provided', () => {
    const html = renderToString(<PxlLogo subtitleText="ZZZ BUILD SYSTEM" />)

    expect(html).toContain('ZZZ BUILD SYSTEM')
  })

  it('renders PxlMark SVG emblem when showMark is true', () => {
    const html = renderToString(<PxlLogo showMark />)

    expect(html).toContain('<svg')
    expect(html).toContain('pxl-mark-glow')
    expect(html).toContain('aria-label="PXL"')
    expect(html).toContain('PROXY')
    expect(html).toContain('LOADOUTS')
  })
})
