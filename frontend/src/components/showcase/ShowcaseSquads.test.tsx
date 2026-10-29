import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ShowcaseSquads } from './ShowcaseSquads'
import type { Agent, Build, ConflictReport, Team, TeamMember, TeamSummary } from '@/types'

// Mock react-i18next
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const dict: Record<string, string> = {
          'showcase.noPublicSquads': 'В этом профиле пока нет публичных отрядов',
          'showcase.copySquadLink': 'Скопировать ссылку на отряд',
          'showcase.squadLinkCopied': 'Ссылка на отряд скопирована',
          'sharing.share': 'Поделиться',
          'sharing.linkCopied': 'Скопировано',
          'teams.searchPlaceholder': 'Название отряда или агенты…',
          'teams.clearSearchAria': 'Сбросить поиск',
          'teams.noResultsTitle': 'Отряды не найдены',
          'teams.noResultsDesc': 'Под текущие запрос и фильтры отрядов ничего не нашлось.',
          'teams.resetFilters': 'Сбросить фильтры',
          'teams.conflictBadge': 'Конфликт',
          'teams.conflictTooltip': 'В отряде обнаружен конфликт экипировки',
          'teams.slotLabel': 'Слот {{slot}}',
        }
        if (key === 'teams.teamAria') {
          return `Отряд ${options?.name ?? ''}`
        }
        if (key === 'teams.updatedAt') {
          return `Обновлено ${options?.date ?? ''}`
        }
        return dict[key] ?? key
      },
    }),
  }
})

// Mock Tooltip components
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// Mock react-router-dom Link
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

const mockAgent1: Agent = {
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

const mockBuild1: Build = {
  id: 'build-anby-1',
  game_account_id: 'acc-1',
  agent_id: 1011,
  agent_name: 'Anby Demara',
  name: 'Stunner Anby',
  description: 'Fast daze build',
  weapon_uid: null,
  weapon_id: null,
  disc_uids: [],
  is_public: true,
  build_data: mockAgent1,
  created_at: '2026-03-01T12:00:00Z',
  updated_at: '2026-03-01T12:00:00Z',
}

const mockMember1: TeamMember = {
  slot_number: 1,
  build: mockBuild1,
}

const mockAgent2: Agent = {
  id: 1021,
  name: 'Ellen Joe',
  level: 60,
  promotion: 6,
  mindscape_cinema: 1,
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
    impact: 80,
    crit_rate: 0.2,
    crit_dmg: 0.8,
    attribute_dmg_bonus: 0.3,
    anomaly_mastery: 30,
    anomaly_proficiency: 30,
    pen_ratio: 0,
    pen_flat: 0,
    energy_regen: 1.2,
    sheer_force: 0,
  },
}

const mockBuild2: Build = {
  id: 'build-ellen-1',
  game_account_id: 'acc-1',
  agent_id: 1021,
  agent_name: 'Ellen Joe',
  name: 'Ice Hypercarry',
  description: 'Crit focused',
  weapon_uid: null,
  weapon_id: null,
  disc_uids: [],
  is_public: true,
  build_data: mockAgent2,
  created_at: '2026-03-01T12:00:00Z',
  updated_at: '2026-03-01T12:00:00Z',
}

const mockMember2: TeamMember = {
  slot_number: 2,
  build: mockBuild2,
}

const mockValidReport: ConflictReport = {
  is_valid: true,
  errors: [],
}

const mockConflictReport: ConflictReport = {
  is_valid: false,
  errors: [
    {
      code: 'WEAPON_REUSE',
      message: 'Duplicate W-Engine conflict',
      slot: 1,
    },
  ],
}

function createTeamSummary(
  id: string,
  name: string,
  description: string,
  members: TeamMember[],
  report: ConflictReport = mockValidReport,
): TeamSummary {
  const team: Team = {
    id,
    game_account_id: 'acc-1',
    name,
    description,
    is_public: true,
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
  }
  return {
    team,
    members,
    report,
  }
}

describe('ShowcaseSquads', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders EmptyState when no squads are provided', () => {
    const html = renderToString(<ShowcaseSquads teams={[]} />)
    expect(html).toContain('В этом профиле пока нет публичных отрядов')
  })

  it('renders squads in a 2-column grid layout', () => {
    const teams = [
      createTeamSummary('team-1', 'Shock Team', 'Electric overload', [mockMember1]),
      createTeamSummary('team-2', 'Freeze Team', 'Ice freeze', [mockMember2]),
    ]
    const html = renderToString(<ShowcaseSquads teams={teams} />)

    expect(html).toContain('Shock Team')
    expect(html).toContain('Freeze Team')
    expect(html).toContain('grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2')
    expect(html).toContain('border-2 border-black')
    expect(html).toContain('Electric overload')
  })

  it('hides search input when there are 2 or fewer squads', () => {
    const teams = [
      createTeamSummary('team-1', 'Team 1', '', [mockMember1]),
      createTeamSummary('team-2', 'Team 2', '', [mockMember2]),
    ]
    const html = renderToString(<ShowcaseSquads teams={teams} />)
    expect(html).not.toContain('Название отряда или агенты…')
  })

  it('shows search input when there are more than 2 squads', () => {
    const teams = [
      createTeamSummary('team-1', 'Team 1', '', [mockMember1]),
      createTeamSummary('team-2', 'Team 2', '', [mockMember2]),
      createTeamSummary('team-3', 'Team 3', '', [mockMember1, mockMember2]),
    ]
    const html = renderToString(<ShowcaseSquads teams={teams} />)
    expect(html).toContain('Название отряда или агенты…')
    expect(html).toContain('3 / 3')
  })

  it('renders conflict badge and accent when a squad has conflict', () => {
    const teams = [
      createTeamSummary('team-conflict', 'Conflict Squad', '', [mockMember1, mockMember2], mockConflictReport),
    ]
    const html = renderToString(<ShowcaseSquads teams={teams} />)

    expect(html).toContain('Conflict Squad')
    expect(html).toContain('Конфликт')
    expect(html).toContain('via-destructive')
  })
})
