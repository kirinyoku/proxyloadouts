import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { PublicTeamPage } from './PublicTeamPage'
import type { Agent, Build, PublicOwnerInfo, PublicTeamResponse } from '@/types'

const mockUsePublicTeam = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    setQueryData: vi.fn(),
  }),
}))

vi.mock('@/api/hooks', () => ({
  usePublicTeam: (id: string, token?: string) => mockUsePublicTeam(id, token),
  useDeleteTeam: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTeam: () => ({ mutate: vi.fn(), isPending: false }),
  usePatchTeam: () => ({ mutate: vi.fn(), isPending: false }),
  useBuilds: () => ({ data: [] }),
  queryKeys: {
    team: (id: string, lang: string) => ['teams', 'detail', id, lang],
  },
}))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ teamId: 'team-123' }),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, string>) => {
        const dict: Record<string, string> = {
          'common.loading': 'Загрузка…',
          'sharing.teamNotFoundTitle': 'Отряд не найден или скрыт владельцем',
          'sharing.teamNotFoundDesc': 'Этот отряд не существует, был удален или владелец скрыл его.',
          'sharing.backToHome': 'На главную',
          'sharing.backToShowcase': 'К витрине',
          'sharing.shareTeam': 'Поделиться отрядом',
          'sharing.linkCopied': 'Ссылка скопирована',
          'sharing.teamPageTitle': 'Отряд {{name}} — ProxyLoadouts',
          'sharing.teamPageMetaDesc': 'Публичный боевой отряд «{{name}}» игрока {{owner}} в ProxyLoadouts.',
          'teams.slotLabel': 'Слот {{slot}}',
        }
        if (key === 'sharing.teamPageTitle') {
          return `Отряд ${options?.name ?? ''} — ProxyLoadouts`
        }
        if (key === 'sharing.teamPageMetaDesc') {
          return `Публичный боевой отряд «${options?.name ?? ''}» игрока ${options?.owner ?? ''} в ProxyLoadouts.`
        }
        if (key === 'teams.teamAria') {
          return `Отряд ${options?.name ?? ''}`
        }
        if (key === 'teams.updatedAt') {
          return `Обновлено ${options?.date ?? ''}`
        }
        return dict[key] ?? key
      },
      i18n: { language: 'ru' },
    }),
  }
})

describe('PublicTeamPage', () => {
  const mockOwner: PublicOwnerInfo = {
    uid: '1504687050',
    region: 'Europe',
    nickname: 'ProxyMaster',
    avatar_url: 'https://example.com/avatar.png',
    is_verified: true,
  }

  const mockMemberBuild: Build = {
    id: 'build-1',
    game_account_id: 'acc-1',
    agent_id: 1011,
    agent_name: 'Эллен',
    name: 'Ледяной шторм',
    description: null,
    weapon_uid: 'w-1',
    weapon_id: 11001,
    disc_uids: [],
    is_public: true,
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
    build_data: {
      id: 1011,
      name: 'Эллен',
      level: 60,
      promotion: 6,
      mindscape_cinema: 0,
      attribute: 'Ice',
      specialty: 'Attack',
      rarity: 'S',
      ui_stats: {},
      skills: [],
      drive_discs: { slots: [], set_bonuses: [] },
      w_engine: null,
    } as unknown as Agent,
  }

  const mockTeamData: PublicTeamResponse = {
    team: {
      id: 'team-123',
      game_account_id: 'acc-1',
      name: 'Ледяное трио',
      description: 'Ротация через Е-шку и свап',
      is_public: true,
      created_at: '2026-10-01T12:00:00Z',
      updated_at: '2026-10-01T12:00:00Z',
    },
    owner: mockOwner,
    report: {
      is_valid: true,
      errors: [],
    },
    members: [
      {
        slot_number: 1,
        build: mockMemberBuild,
      },
    ],
  }

  it('renders loading state', () => {
    mockUsePublicTeam.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    })

    const html = renderToString(<PublicTeamPage />)
    expect(html).toContain('Загрузка…')
  })

  it('renders not found state on error', () => {
    mockUsePublicTeam.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    })

    const html = renderToString(<PublicTeamPage />)
    expect(html).toContain('Отряд не найден или скрыт владельцем')
    expect(html).toContain('На главную')
  })

  it('renders team details, author header, and members on success', () => {
    mockUsePublicTeam.mockReturnValue({
      isLoading: false,
      isError: false,
      data: mockTeamData,
    })

    const html = renderToString(<PublicTeamPage />)
    expect(html).toContain('ProxyMaster')
    expect(html).not.toContain('/showcase?uid=1504687050')
    expect(html).not.toContain('Открыть витрину')
    expect(html).toContain('lucide-share-2')
    expect(html).toContain('Поделиться отрядом')
    expect(html).toContain('rounded-full bg-primary')
    expect(html).toContain('Ледяное трио')
    expect(html).toContain('Ротация через Е-шку и свап')
    expect(html).toContain('Эллен')
    expect(html).toContain('Обновлено')
    expect(html).toContain('<title>Отряд Ледяное трио — ProxyLoadouts</title>')
    expect(html).toContain('content="Публичный боевой отряд «Ледяное трио» игрока ProxyMaster в ProxyLoadouts."')
  })
})
