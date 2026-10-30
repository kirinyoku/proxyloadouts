import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { TeamCard } from './TeamCard'
import type { Agent, Build, ConflictReport, Team, TeamMember, TeamSummary } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const dict: Record<string, string> = {
          'teams.conflictBadge': 'Конфликт',
          'teams.conflictTooltip': 'В отряде обнаружен конфликт экипировки',
          'sharing.share': 'Поделиться',
          'sharing.linkCopied': 'Скопировано',
          'sharing.teamPublicTooltip': 'Публичный отряд',
          'sharing.teamPrivateTooltip': 'Приватный отряд',
          'teams.editTeam': 'Редактировать отряд',
          'teams.deleteTeam': 'Удалить отряд',
          'teams.deleteDialogTitle': `Удалить отряд ${options?.name ?? ''}?`,
          'teams.deleteDialogDesc': 'Это действие нельзя отменить.',
          'teams.deleteDialogCancel': 'Отмена',
          'teams.deleteDialogConfirm': 'Удалить',
          'teams.deleteDialogDeleting': 'Удаление…',
          'teams.slotChooseAgent': 'Выбрать агента',
          'teams.slotLabel': `Слот ${options?.slot ?? 1}`,
          'teams.noWEngineShort': 'Нет амплификатора',
          'teams.noDiscsShort': 'Нет дисков',
        }
        if (key === 'teams.teamAria') return `Отряд ${options?.name ?? ''}`
        if (key === 'teams.editTeamAria') return `Редактировать отряд ${options?.name ?? ''}`
        if (key === 'teams.updatedAt') return `Обновлено ${options?.date ?? ''}`
        return dict[key] ?? key
      },
      i18n: { language: 'ru' },
    }),
  }
})

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
  }),
}))

vi.mock('@/api/hooks', () => ({
  useDeleteTeam: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTeam: () => ({ mutate: vi.fn(), isPending: false }),
  usePatchTeam: () => ({ mutate: vi.fn(), isPending: false }),
  useBuilds: () => ({ data: [] }),
  queryKeys: {
    team: (id: string, lang: string) => ['teams', 'detail', id, lang],
  },
}))

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockAgent: Agent = {
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

const mockBuild: Build = {
  id: 'build-1',
  game_account_id: 'acc-1',
  agent_id: 1011,
  agent_name: 'Anby Demara',
  name: 'Stunner Anby',
  description: 'Fast daze',
  weapon_uid: null,
  weapon_id: null,
  disc_uids: [],
  is_public: true,
  build_data: mockAgent,
  created_at: '2026-03-01T12:00:00Z',
  updated_at: '2026-03-01T12:00:00Z',
}

const mockMember: TeamMember = {
  slot_number: 1,
  build: mockBuild,
}

function createSummary(options?: {
  hasConflict?: boolean
  isPublic?: boolean
  members?: TeamMember[]
}): TeamSummary {
  const team: Team = {
    id: 'team-1',
    game_account_id: 'acc-1',
    name: 'Thunder Squad',
    description: 'Electric burst team',
    is_public: options?.isPublic ?? true,
    created_at: '2026-03-01T12:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
  }
  const report: ConflictReport = options?.hasConflict
    ? { is_valid: false, errors: [{ code: 'WEAPON_REUSE', message: 'Conflict', slot: 1 }] }
    : { is_valid: true, errors: [] }

  return {
    team,
    members: options?.members ?? [mockMember],
    report,
  }
}

describe('TeamCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders edit, delete, visibility, and share buttons in normal mode', () => {
    const summary = createSummary({ isPublic: true })
    const html = renderToString(<TeamCard summary={summary} />)

    expect(html).toContain('Thunder Squad')
    expect(html).toContain('/teams/team-1/edit')
    expect(html).toContain('Редактировать отряд')
    expect(html).toContain('Удалить отряд')
    expect(html).toContain('Публичный отряд')
    expect(html).toContain('Поделиться')
    expect(html).toContain('Выбрать агента')
  })

  it('renders only share button in readOnly mode, hiding edit, delete, and visibility', () => {
    const summary = createSummary({ isPublic: true })
    const html = renderToString(<TeamCard summary={summary} readOnly />)

    expect(html).toContain('Thunder Squad')
    expect(html).toContain('Поделиться')
    expect(html).not.toContain('/teams/team-1/edit')
    expect(html).not.toContain('Редактировать отряд')
    expect(html).not.toContain('Удалить отряд')
    expect(html).not.toContain('Публичный отряд')
    expect(html).not.toContain('Приватный отряд')
    expect(html).not.toContain('Выбрать агента')
  })

  it('does not render top rim accent or via-primary when there is no conflict', () => {
    const summary = createSummary({ hasConflict: false })
    const html = renderToString(<TeamCard summary={summary} />)

    expect(html).not.toContain('via-primary')
    expect(html).not.toContain('via-destructive')
    expect(html).not.toContain('Конфликт')
  })

  it('renders via-destructive top rim accent and badge when there is a conflict', () => {
    const summary = createSummary({ hasConflict: true })
    const html = renderToString(<TeamCard summary={summary} />)

    expect(html).toContain('via-destructive')
    expect(html).toContain('Конфликт')
    expect(html).not.toContain('via-primary')
  })
})
