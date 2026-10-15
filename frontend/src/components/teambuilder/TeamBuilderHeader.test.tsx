import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { TeamBuilderHeader } from './TeamBuilderHeader'
import { TeamBuilderHeaderSkeleton } from './TeamBuilderHeaderSkeleton'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const dict: Record<string, string> = {
        'teamBuilder.newTitle': 'Новый отряд',
        'teamBuilder.editTitle': 'Редактирование',
        'roster.toTeamsTitle': 'К списку отрядов',
      }
      return dict[key] ?? key
    },
  }),
}))

describe('TeamBuilderHeader', () => {
  it('renders creation title and back link without slot badge', () => {
    const html = renderToString(
      <MemoryRouter>
        <TeamBuilderHeader isEditing={false} />
      </MemoryRouter>,
    )

    expect(html).toContain('Новый отряд')
    expect(html).toContain('href="/teams"')
    expect(html).not.toContain('/ 3')
  })

  it('renders edit title when isEditing is true', () => {
    const html = renderToString(
      <MemoryRouter>
        <TeamBuilderHeader isEditing={true} />
      </MemoryRouter>,
    )

    expect(html).toContain('Редактирование')
    expect(html).not.toContain('/ 3')
  })
})

describe('TeamBuilderHeaderSkeleton', () => {
  it('renders skeleton without slot counter pill', () => {
    const html = renderToString(<TeamBuilderHeaderSkeleton />)
    expect(html).toContain('aria-hidden="true"')
    // Should not contain the removed w-16 badge skeleton
    expect(html).not.toContain('w-16')
  })
})
