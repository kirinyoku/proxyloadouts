import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ShowcaseSavedPresets } from './ShowcaseSavedPresets'
import type { Agent, Build } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const dict: Record<string, string> = {
          'showcase.savedPresets': 'Архив сборок',
          'showcase.noPublicPresets': 'В архиве этого профиля пока нет сборок',
          'showcase.presetLinkCopied': 'Ссылка на сборку скопирована',
          'showcase.copyPresetLink': 'Скопировать ссылку на сборку',
          'showcase.agentsRailAria': 'Список агентов в витрине',
          'showcase.agentSectionsAria': 'Разделы билда агента',
          'showcase.mobileDiscs': 'Диски',
          'showcase.mobileStats': 'Характеристики',
          'sharing.share': 'Поделиться',
          'sharing.linkCopied': 'Скопировано',
          'roster.searchPlaceholder': 'Поиск агента…',
          'roster.searchFilterPlaceholder': 'Агент, сборка или амплификатор…',
          'roster.clearSearch': 'Очистить поиск',
          'roster.clearSearchButton': 'Очистить поиск',
          'roster.noSearchResults': 'По вашему запросу ничего не найдено',
          'roster.noFilterResults': 'Нет агентов, соответствующих выбранным фильтрам',
          'roster.resetFilters': 'Сбросить фильтры',
          'roster.resetFiltersTitle': 'Сбросить все активные фильтры',
          'roster.filterAttributes': 'Фильтр по атрибуту',
          'roster.filterSpecialties': 'Фильтр по специальности',
          'roster.attrTooltip': 'Атрибут: {{label}}',
          'roster.specTooltip': 'Специальность: {{label}}',
          'attributes.Electric': 'Электро',
          'attributes.Ice': 'Лед',
          'specialties.Stun': 'Устрашение',
          'specialties.Attack': 'Нападение',
        }
        if (key === 'roster.buildsCount') {
          return `${options?.count ?? 0} сборок`
        }
        return dict[key] ?? key
      },
      i18n: { language: 'ru' },
    }),
  }
})

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

vi.mock('@/api/hooks', () => ({
  useMe: () => ({ data: null }),
  useRenameBuild: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteBuild: () => ({ mutate: vi.fn(), isPending: false }),
  useToggleBuildVisibility: () => ({ mutate: vi.fn(), isPending: false }),
}))

const mockAgentAnby: Agent = {
  id: 1011,
  name: 'Anby Demara',
  level: 60,
  promotion: 5,
  mindscape_cinema: 0,
  core_skill_enhancement: 6,
  attribute: 'Electric',
  attribute_name: 'Electric',
  specialty: 'Stun',
  specialty_name: 'Stun',
  rarity: 'A',
  skin: null,
  splash_art_url: '',
  w_engine: null,
  drive_discs: { slots: [], set_bonuses: [] },
  skills: [],
  stats: {
    hp: 1000,
    atk: 500,
    def: 300,
    impact: 100,
    crit_rate: 0.05,
    crit_dmg: 0.5,
    attribute_dmg_bonus: 0,
    anomaly_mastery: 50,
    anomaly_proficiency: 50,
    pen_ratio: 0,
    pen_flat: 0,
    energy_regen: 1,
    sheer_force: 0,
  },
}

const mockAgentEllen: Agent = {
  id: 1021,
  name: 'Ellen Joe',
  level: 60,
  promotion: 6,
  mindscape_cinema: 2,
  core_skill_enhancement: 6,
  attribute: 'Ice',
  attribute_name: 'Ice',
  specialty: 'Attack',
  specialty_name: 'Attack',
  rarity: 'S',
  skin: null,
  splash_art_url: '',
  w_engine: null,
  drive_discs: { slots: [], set_bonuses: [] },
  skills: [],
  stats: {
    hp: 1200,
    atk: 800,
    def: 400,
    impact: 90,
    crit_rate: 0.2,
    crit_dmg: 0.8,
    attribute_dmg_bonus: 0.3,
    anomaly_mastery: 40,
    anomaly_proficiency: 40,
    pen_ratio: 0,
    pen_flat: 0,
    energy_regen: 1.2,
    sheer_force: 0,
  },
}

const mockBuilds: Build[] = [
  {
    id: 'b-anby-1',
    game_account_id: 'acc-1',
    agent_id: 1011,
    agent_name: 'Anby Demara',
    name: 'Stun DPS',
    description: 'Fast daze buildup',
    weapon_uid: null,
    weapon_id: null,
    disc_uids: [],
    is_public: true,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    build_data: mockAgentAnby,
  },
  {
    id: 'b-anby-2',
    game_account_id: 'acc-1',
    agent_id: 1011,
    agent_name: 'Anby Demara',
    name: 'Support Stun',
    description: 'Energy regen focus',
    weapon_uid: null,
    weapon_id: null,
    disc_uids: [],
    is_public: true,
    created_at: '2026-10-02T00:00:00Z',
    updated_at: '2026-10-02T00:00:00Z',
    build_data: mockAgentAnby,
  },
  {
    id: 'b-ellen-1',
    game_account_id: 'acc-1',
    agent_id: 1021,
    agent_name: 'Ellen Joe',
    name: 'Main Freeze',
    description: null,
    weapon_uid: null,
    weapon_id: null,
    disc_uids: [],
    is_public: true,
    created_at: '2026-10-03T00:00:00Z',
    updated_at: '2026-10-03T00:00:00Z',
    build_data: mockAgentEllen,
  },
]

describe('ShowcaseSavedPresets', () => {
  it('renders empty state when builds list is empty', () => {
    const html = renderToString(<ShowcaseSavedPresets builds={[]} />)
    expect(html).toContain('В архиве этого профиля пока нет сборок')
  })

  it('renders RosterToolbar with search input and attribute/specialty capsules without duplicate title', () => {
    const html = renderToString(<ShowcaseSavedPresets builds={mockBuilds} />)

    // Title is hidden to avoid duplicating active tab header
    expect(html).not.toContain('Архив сборок')
    expect(html).not.toContain('<h1')
    // Search input
    expect(html).toContain('placeholder="Поиск агента…"')
    // Attribute capsule filter
    expect(html).toContain('aria-label="Фильтр по атрибуту"')
    // Specialty capsule filter
    expect(html).toContain('aria-label="Фильтр по специальности"')
  })

  it('renders agent avatar tabs with builds count badge and dropdown for multiple presets', () => {
    const html = renderToString(<ShowcaseSavedPresets builds={mockBuilds} />)

    // First agent Anby has 2 builds
    expect(html).toContain('Anby Demara')
    // Active build name rendered in dropdown trigger (most recent build)
    expect(html).toContain('Support Stun')
    // Active build description note
    expect(html).toContain('Energy regen focus')
    // Select trigger combobox is rendered
    expect(html).toContain('role="combobox"')
  })

  it('renders single build chip without dropdown when agent has only one preset', () => {
    // Ellen has only 1 build
    const html = renderToString(<ShowcaseSavedPresets builds={[mockBuilds[2]!]} />)

    expect(html).toContain('Ellen Joe')
    expect(html).toContain('Main Freeze')
    // No select combobox rendered when only 1 preset
    expect(html).not.toContain('role="combobox"')
  })

  it('renders MindscapeBadge with inline variant without falling to bottom right corner', () => {
    // Ellen has mindscape_cinema: 2
    const html = renderToString(<ShowcaseSavedPresets builds={[mockBuilds[2]!]} />)

    expect(html).toContain('Ellen Joe')
    // Mindscape badge M2 rendered inline
    expect(html).toContain('M2')
  })
})
