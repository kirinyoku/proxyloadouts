import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Search } from 'lucide-react'
import { EmptyState } from './EmptyState'

describe('EmptyState', () => {
  it('renders title and description', () => {
    const html = renderToString(
      <EmptyState
        title="No items found"
        description="Try adjusting your search filters."
      />
    )

    expect(html).toContain('No items found')
    expect(html).toContain('Try adjusting your search filters.')
    expect(html).toContain('role="status"')
    expect(html).toContain('font-heading')
  })

  it('renders icon component in badge', () => {
    const html = renderToString(
      <EmptyState
        icon={Search}
        title="Search empty"
      />
    )

    expect(html).toContain('<svg')
    expect(html).toContain('border-white/10')
  })

  it('renders action button and children', () => {
    const html = renderToString(
      <EmptyState
        title="Empty"
        action={<button type="button">Create item</button>}
      >
        <div data-testid="custom-child">Extra child info</div>
      </EmptyState>
    )

    expect(html).toContain('Create item')
    expect(html).toContain('Extra child info')
  })

  it('applies small size styling when size="sm"', () => {
    const html = renderToString(
      <EmptyState
        icon={Search}
        size="sm"
        title="Small Title"
      />
    )

    expect(html).toContain('p-6')
    expect(html).toContain('text-base')
  })
})
