import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { TeamSlotList } from './TeamSlotList'
import type { Build } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { count?: number; name?: string; slot?: number }) => {
        const dict: Record<string, string> = {
          'teamBuilder.newTitle': 'Новый отряд',
          'teamBuilder.unnamedTeam': 'Безымянный отряд',
          'teamBuilder.deckSlotCounter': `${options?.count ?? 0} / 3 агентов`,
          'teamBuilder.deckSlotPrompt': 'Клик по слоту — добавить или заменить агента',
          'teamBuilder.emptySlotChoose': 'Добавить агента',
          'teams.slotLabel': `Слот ${options?.slot ?? 1}`,
        }
        return dict[key] ?? key
      },
    }),
  }
})

const emptyBuilds: readonly (Build | null)[] = [null, null, null]

describe('TeamSlotList', () => {
  it('renders slot counter pill badge with high-contrast elements when empty', () => {
    const html = renderToString(
      <TeamSlotList
        slots={[null, null, null]}
        selectedBuilds={emptyBuilds}
        builds={[]}
        onSetSlot={vi.fn()}
        onClearSlot={vi.fn()}
      />,
    )

    // Should contain the pill badge container with UsersRound and 0 / 3
    expect(html).toContain('text-zinc-100')
    expect(html).toContain('>0<')
    expect(html).toContain('>/<')
    expect(html).toContain('>3<')
    expect(html).toContain('агентов')
    // Should have empty slot prompts with clear text
    expect(html).toContain('Добавить агента')
    expect(html).toContain('text-zinc-200')
  })

  it('highlights slot count with text-primary when agents are selected', () => {
    const mockBuild = {
      id: 'b1',
      name: 'Билд Арии',
      agent_id: '1011',
      agent_name: 'Ария',
      build_data: {
        id: '1011',
        name: 'Ария',
        rarity: 'S',
        attribute: 'ice',
        specialty: 'anomaly',
        mindscape_cinema: 0,
        level: 60,
      },
      created_at: '',
      updated_at: '',
    } as unknown as Build

    const filledBuilds: readonly (Build | null)[] = [mockBuild, null, null]

    const html = renderToString(
      <TeamSlotList
        slots={['b1', null, null]}
        selectedBuilds={filledBuilds}
        builds={[mockBuild]}
        onSetSlot={vi.fn()}
        onClearSlot={vi.fn()}
      />,
    )

    expect(html).toContain('text-primary')
    expect(html).toContain('1')
  })
})
