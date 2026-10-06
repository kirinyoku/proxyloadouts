import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { RosterBuildToolbar } from './RosterBuildToolbar'
import type { Build } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const translations: Record<string, string> = {
          'roster.deleteBuildButton': 'Удалить',
          'roster.deleteBuildTitle': 'Удалить этот билд',
          'roster.addNote': 'Заметка',
          'roster.addNoteTitle': 'Добавить заметку',
          'roster.noteInputPlaceholder': 'Заметка к билду…',
          'roster.renameBuild': 'Переименовать пресет',
          'roster.buildSelectPlaceholder': 'Билд',
        }
        return translations[key] ?? (options?.name as string ?? key)
      },
    }),
  }
})

vi.mock('@/api/hooks', () => ({
  useRenameBuild: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteBuild: () => ({ mutate: vi.fn(), isPending: false }),
}))

const mockBuilds: Build[] = [
  {
    id: 'build-1',
    game_account_id: 'acc-1',
    agent_id: 1011,
    agent_name: 'Ария',
    name: 'Основной билд',
    description: 'Тактическая заметка с крит уроном',
    weapon_uid: null,
    weapon_id: null,
    disc_uids: [],
    created_at: '2026-09-25T20:00:00Z',
    updated_at: '2026-09-25T20:48:00Z',
    build_data: {
      id: 1011,
      name: 'Ария',
      level: 60,
      promotion: 6,
      mindscape_cinema: 0,
      core_skill_enhancement: 0,
      rarity: 'S',
      attribute: 'Ether',
      attribute_name: 'Ether',
      specialty: 'Attack',
      specialty_name: 'Attack',
      skin: null,
      splash_art_url: '',
      skills: [],
      w_engine: null,
      drive_discs: {
        slots: [],
        set_bonuses: [],
      },
    },
  },
]

describe('RosterBuildToolbar', () => {
  it('renders "Удалить" text on the delete button', () => {
    const html = renderToString(
      <RosterBuildToolbar
        agentName="Ария"
        builds={mockBuilds}
        selectedBuildId="build-1"
        onSelectBuildId={vi.fn()}
      />,
    )

    expect(html).toContain('Удалить')
  })

  it('does not render trash icon on desktop delete button', () => {
    const html = renderToString(
      <RosterBuildToolbar
        agentName="Ария"
        builds={mockBuilds}
        selectedBuildId="build-1"
        onSelectBuildId={vi.fn()}
      />,
    )

    // Desktop toolbar (hidden sm:flex)
    const desktopToolbar = html.split('sm:hidden')[0]
    expect(desktopToolbar).toBeDefined()
    // The desktop delete button should contain "Удалить" without svg icon inside it
    const desktopDeleteMatch = desktopToolbar?.match(/<button[^>]*aria-label="Удалить этот билд"[^>]*>(.*?)<\/button>/s)
    expect(desktopDeleteMatch).not.toBeNull()
    expect(desktopDeleteMatch?.[1]).not.toContain('<svg')
    expect(desktopDeleteMatch?.[1]).toContain('Удалить')
  })

  it('does NOT render agent name, attribute, or specialty in the toolbar', () => {
    const html = renderToString(
      <RosterBuildToolbar
        agentName="Ария"
        builds={mockBuilds}
        selectedBuildId="build-1"
        onSelectBuildId={vi.fn()}
      />,
    )

    // The agentName prop is only used for dialog descriptions, not in the toolbar headings/badges
    expect(html).not.toContain('<h2')
    expect(html).not.toContain('AttributeBadge')
    expect(html).not.toContain('SpecialtyBadge')
  })

  it('renders note with w-fit, max-w-full, truncate and does not cap with max-w-[320px]', () => {
    const html = renderToString(
      <RosterBuildToolbar
        agentName="Ария"
        builds={mockBuilds}
        selectedBuildId="build-1"
        onSelectBuildId={vi.fn()}
      />,
    )

    expect(html).toContain('Тактическая заметка с крит уроном')
    expect(html).toContain('w-fit')
    expect(html).toContain('max-w-full')
    expect(html).toContain('truncate')
    expect(html).not.toContain('md:max-w-[320px]')
  })

  it('renders capacity meta indicator when provided', () => {
    const html = renderToString(
      <RosterBuildToolbar
        agentName="Ария"
        builds={mockBuilds}
        selectedBuildId="build-1"
        onSelectBuildId={vi.fn()}
        meta={<span data-testid="capacity-chip">1/5</span>}
      />,
    )

    expect(html).toContain('data-testid="capacity-chip"')
    expect(html).toContain('1/5')
  })

  it('renders icon-only delete button on mobile without "Удалить" text', () => {
    const html = renderToString(
      <RosterBuildToolbar
        agentName="Ария"
        builds={mockBuilds}
        selectedBuildId="build-1"
        onSelectBuildId={vi.fn()}
      />,
    )

    const mobileToolbar = html.split('sm:hidden')[1]
    expect(mobileToolbar).toBeDefined()
    const mobileDeleteMatch = mobileToolbar?.match(/<button[^>]*aria-label="Удалить этот билд"[^>]*>(.*?)<\/button>/s)
    expect(mobileDeleteMatch).not.toBeNull()
    expect(mobileDeleteMatch?.[1]).toContain('<svg')
    expect(mobileDeleteMatch?.[1]).not.toContain('Удалить')
  })

  it('renders capacity meta indicator on mobile in row 1 before build list', () => {
    const html = renderToString(
      <RosterBuildToolbar
        agentName="Ария"
        builds={mockBuilds}
        selectedBuildId="build-1"
        onSelectBuildId={vi.fn()}
        meta={<span data-testid="capacity-chip">1/5</span>}
      />,
    )

    const mobileToolbar = html.split('sm:hidden')[1]
    expect(mobileToolbar).toBeDefined()
    const chipIdx = mobileToolbar?.indexOf('data-testid="capacity-chip"') ?? -1
    const buildSelectIdx = mobileToolbar?.indexOf('Основной билд') ?? -1
    expect(chipIdx).toBeGreaterThan(-1)
    expect(buildSelectIdx).toBeGreaterThan(chipIdx)
  })

  it('does not render date in mobile build selector to maximize build name width', () => {
    const html = renderToString(
      <RosterBuildToolbar
        agentName="Ария"
        builds={mockBuilds}
        selectedBuildId="build-1"
        onSelectBuildId={vi.fn()}
      />,
    )

    const mobileToolbar = html.split('sm:hidden')[1]
    expect(mobileToolbar).toBeDefined()
    expect(mobileToolbar).toContain('Основной билд')
    expect(mobileToolbar).not.toContain('text-[10px] text-muted-foreground/90')
  })
})
