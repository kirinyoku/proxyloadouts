import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { BuildInspectorDialog } from './BuildInspectorDialog'
import type { Build } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const translations: Record<string, string> = {
          'showcase.mobileDiscs': 'Диски',
          'showcase.mobileStats': 'Характеристики',
          'showcase.agentSectionsAria': 'Разделы билда агента',
          'roster.openInRoster': 'В Ростер',
          'roster.inSquad': '// В команде: ',
          'roster.updatedAt': 'Обновлено {{date}}',
          'roster.notePrefix': '// Заметка:',
          'roster.addNote': 'Заметка',
          'sharing.viewBuildPage': 'Открыть страницу сборки',
          'common.close': 'Закрыть',
          'attributes.Fire': 'Огонь',
          'specialties.Attack': 'Нападение',
        }
        return translations[key] ?? (options?.date != null ? `Обновлено ${options.date}` : key)
      },
    }),
  }
})

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-slot="dialog">{children}</div> : null,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockBuild: Build = {
  id: 'build-evelyn-1',
  game_account_id: 'acc-1',
  agent_id: 1021,
  agent_name: 'Эвелин',
  name: 'Основной билд',
  description: 'Фокус на крит и атаку',
  weapon_uid: 'w-1',
  weapon_id: 12002,
  disc_uids: [],
  is_public: false,
  created_at: '2026-09-25T20:00:00Z',
  updated_at: '2026-09-25T20:00:00Z',
  build_data: {
    id: 1021,
    name: 'Эвелин',
    level: 60,
    promotion: 6,
    mindscape_cinema: 1,
    core_skill_enhancement: 0,
    rarity: 'S',
    attribute: 'Fire',
    attribute_name: 'Fire',
    specialty: 'Attack',
    specialty_name: 'Attack',
    skin: null,
    splash_art_url: 'https://example.com/evelyn.png',
    skills: [],
    w_engine: {
      id: 12002,
      uid: 'w-1',
      name: 'Сера',
      rarity: 'S',
      level: 60,
      phase: 5,
      modification: 1,
      main_stat: { property_id: 12101, name: 'Базовая сила атаки', value: 478, is_percent: false, rolls: 1, icon_url: '' },
      secondary_stat: { property_id: 12102, name: 'Сила атаки', value: 0.3, is_percent: true, rolls: 1, icon_url: '' },
      specialty: 'Attack',
      specialty_name: 'Attack',
      icon_url: 'https://example.com/the-brimstone.png',
      passive_description: 'Увеличивает силу атаки',
    },
    drive_discs: {
      slots: [],
      set_bonuses: [],
    },
    ui_stats: {
      hp: { property_id: 11101, name: 'HP', total: '10558', base: '7500', added: '3058', icon_url: '' },
      atk: { property_id: 12101, name: 'Сила атаки', total: '3280', base: '950', added: '2330', icon_url: '' },
      def: { property_id: 13101, name: 'Защита', total: '855', base: '600', added: '255', icon_url: '' },
      crit_rate: { property_id: 20101, name: 'Крит. шанс', total: '49.0%', base: '5.0%', added: '44.0%', icon_url: '' },
      crit_dmg: { property_id: 21101, name: 'Крит. урон', total: '150.8%', base: '50.0%', added: '100.8%', icon_url: '' },
    },
  },
}

describe('BuildInspectorDialog', () => {
  it('returns null when build is null', () => {
    const html = renderToString(
      <BuildInspectorDialog
        build={null}
        open={true}
        onOpenChange={() => {}}
      />,
    )
    expect(html).toBe('')
  })

  it('renders agent details and metadata correctly', () => {
    const html = renderToString(
      <BuildInspectorDialog
        build={mockBuild}
        open={true}
        onOpenChange={() => {}}
        teamName="Команда 1"
      />,
    )

    expect(html).toContain('Эвелин')
    expect(html).toContain('Основной билд')
    expect(html).not.toContain('Команда 1')
    expect(html).toContain('Фокус на крит и атаку')
    expect(html).toContain('Заметка')
    expect(html).toContain('text-primary')
    expect(html).not.toContain('border-l-primary')
    expect(html).toContain('sm:hidden')
    expect(html).toContain('hidden sm:inline-flex')
    expect(html).toContain('/roster?build=build-evelyn-1&amp;from=teams')
    expect(html).toContain('В Ростер')
    expect(html).toContain('Закрыть')
    expect(html).toContain('Обновлено')
  })

  it('renders mobile tabs for Discs and Stats with correct layout classes', () => {
    const html = renderToString(
      <BuildInspectorDialog
        build={mockBuild}
        open={true}
        onOpenChange={() => {}}
      />,
    )

    // Mobile tabs list
    expect(html).toContain('role="tablist"')
    expect(html).toContain('Диски')
    expect(html).toContain('Характеристики')

    // Discs tab is active by default (aria-selected="true")
    expect(html).toContain('aria-selected="true"')

    // Mobile W-Engine is placed above tabs with lg:hidden
    expect(html).toContain('lg:hidden')

    // 2-column grid layout with responsive lg breakpoint
    expect(html).toContain('lg:grid-cols-[270px_minmax(0,1fr)]')
  })

  it('renders link to /b/:id when isPublicView is true and build is public', () => {
    const publicBuild = { ...mockBuild, is_public: true }
    const html = renderToString(
      <BuildInspectorDialog
        build={publicBuild}
        open={true}
        onOpenChange={() => {}}
        isPublicView={true}
      />,
    )

    expect(html).toContain('/b/build-evelyn-1')
    expect(html).toContain('Открыть страницу сборки')
    expect(html).not.toContain('/roster?build=')
  })

  it('renders link to /b/:id when publicMode is true and build is public', () => {
    const publicBuild = { ...mockBuild, is_public: true }
    const html = renderToString(
      <BuildInspectorDialog
        build={publicBuild}
        open={true}
        onOpenChange={() => {}}
        publicMode={true}
      />,
    )

    expect(html).toContain('/b/build-evelyn-1')
    expect(html).toContain('Открыть страницу сборки')
    expect(html).not.toContain('/roster?build=')
    // Link to build page should only be rendered in footer, never duplicated in header
    const occurrences = (html.match(/\/b\/build-evelyn-1/g) || []).length
    expect(occurrences).toBe(1)
  })

  it('does not render link to build page or roster when publicMode is true and build is private', () => {
    const privateBuild = { ...mockBuild, is_public: false }
    const html = renderToString(
      <BuildInspectorDialog
        build={privateBuild}
        open={true}
        onOpenChange={() => {}}
        publicMode={true}
      />,
    )

    expect(html).not.toContain('/b/build-evelyn-1')
    expect(html).not.toContain('Открыть страницу сборки')
    expect(html).not.toContain('/roster?build=')
  })
})
