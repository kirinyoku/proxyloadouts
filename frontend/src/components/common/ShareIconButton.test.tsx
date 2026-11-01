import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ShareIconButton } from './ShareIconButton'

describe('ShareIconButton', () => {
  it('renders bordered elevated button surface with Share2 icon by default', () => {
    const html = renderToString(
      <ShareIconButton aria-label="Поделиться" title="Поделиться" />,
    )

    expect(html).toContain('lucide-share-2')
    expect(html).toContain('bg-card/80')
    expect(html).toContain('border-border/60')
    expect(html).not.toContain('rounded-full bg-primary')
  })

  it('renders corner public status dot when isPublic is true', () => {
    const html = renderToString(
      <ShareIconButton isPublic aria-label="Поделиться" />,
    )

    expect(html).toContain('lucide-share-2')
    expect(html).toContain('rounded-full bg-primary')
    expect(html).toContain('top-0.5 right-0.5')
  })

  it('renders Check icon and hides public status dot when copied is true', () => {
    const html = renderToString(
      <ShareIconButton isPublic copied aria-label="Поделиться" />,
    )

    expect(html).toContain('lucide-check')
    expect(html).not.toContain('lucide-share-2')
    expect(html).not.toContain('rounded-full bg-primary')
  })
})
