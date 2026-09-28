import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { SegmentedControl } from './SegmentedControl'

const options = [
  { value: 'rounded', label: 'Скруглённые' },
  { value: 'sharp', label: 'Острые' },
] as const

describe('SegmentedControl', () => {
  it('renders a radiogroup with one radio per option', () => {
    const html = renderToString(
      <SegmentedControl
        options={options}
        value="rounded"
        onValueChange={vi.fn()}
        ariaLabel="Геометрия углов"
      />
    )
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-label="Геометрия углов"')
    expect(html.match(/role="radio"/g)).toHaveLength(2)
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('aria-checked="false"')
  })

  it('marks the selected option as checked', () => {
    const html = renderToString(
      <SegmentedControl
        options={options}
        value="sharp"
        onValueChange={vi.fn()}
        ariaLabel="Геометрия углов"
      />
    )
    // Only the "sharp" radio is checked, so exactly one aria-checked="true" exists.
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1)
    expect(html).toContain('Острые')
  })

  it('renders an optional glyph for each option', () => {
    const html = renderToString(
      <SegmentedControl
        options={[{ value: 'rounded', label: 'A', glyph: <span data-testid="glyph" /> }]}
        value="rounded"
        onValueChange={vi.fn()}
        ariaLabel="A"
      />
    )
    expect(html).toContain('data-testid="glyph"')
  })
})
