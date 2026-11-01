import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Switch } from './switch'

describe('Switch', () => {
  it('exposes switch semantics and checked state', () => {
    const html = renderToString(<Switch checked onCheckedChange={() => {}} aria-label="Анимация" />)
    expect(html).toContain('role="switch"')
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('data-state="checked"')
    expect(html).toContain('aria-label="Анимация"')
  })

  it('renders the unchecked state', () => {
    const html = renderToString(<Switch checked={false} onCheckedChange={() => {}} />)
    expect(html).toContain('aria-checked="false"')
    expect(html).toContain('data-state="unchecked"')
    expect(html).not.toContain('data-state="checked"')
  })

  it('marks a disabled switch as non-interactive', () => {
    const html = renderToString(<Switch checked disabled onCheckedChange={() => {}} />)
    expect(html).toContain('disabled=""')
  })

  it('renders compact size variant when size="sm"', () => {
    const html = renderToString(<Switch checked size="sm" onCheckedChange={() => {}} />)
    expect(html).toContain('h-4.5 w-8')
    expect(html).toContain('size-3.5')
    expect(html).toContain('translate-x-3.5')
  })
})
