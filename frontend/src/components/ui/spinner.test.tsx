import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Spinner } from './spinner'

describe('Spinner component (Symmetric Dual-Arc)', () => {
  it('renders default spinner with role="status" and aria-label', () => {
    const html = renderToString(<Spinner />)
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-label="Loading"')
    expect(html).toContain('size-4') // default 'sm'
    expect(html).toContain('text-primary')
  })

  it('renders with custom size and color', () => {
    const html = renderToString(<Spinner size="lg" color="cyan" className="custom-test-class" />)
    expect(html).toContain('size-8') // 'lg'
    expect(html).toContain('text-[#2eb6ff]') // 'cyan'
    expect(html).toContain('custom-test-class')
  })

  it('renders with xs size for buttons', () => {
    const html = renderToString(<Spinner size="xs" color="white" />)
    expect(html).toContain('size-3.5')
    expect(html).toContain('text-white')
  })
})
