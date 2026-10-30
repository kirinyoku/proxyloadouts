import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ShowcasePage } from './ShowcasePage'
import type { Agent, ShowcaseResponse } from '@/types'

// Mock react-i18next
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const translations: Record<string, string> = {
          'nav.showcase': 'ВИТРИНА',
          'showcase.emptyTitle': 'В витрине этого профиля пока нет агентов',
          'showcase.agentsRailAria': 'Список агентов в витрине',
          'showcase.saveBuild': 'Сохранить сборку',
          'showcase.buildAlreadySaved': 'Сборка сохранена',
          'showcase.refreshShowcase': 'Обновить витрину',
          'showcase.liveShowcase': 'Витрина в игре',
          'showcase.savedPresets': 'Архив сборок',
          'showcase.squads': 'Отряды',
          'showcase.enkaUnavailableNotice': 'Сервера EnkaNetwork временно недоступны — показаны сохраненные сборки и отряды игрока',
          'sharing.verifiedOwner': 'VERIFIED OWNER',
          'common.loading': 'Загрузка…',
        }
        return translations[key] ?? key
      },
      i18n: { language: 'ru' },
    }),
  }
})

const mockSearchParams = vi.fn().mockReturnValue([new URLSearchParams({ uid: '1504687050' }), vi.fn()])

// Mock react-router-dom
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...props}>{children}</a>
    ),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/showcase', search: '?uid=1504687050', hash: '', state: null, key: 'default' }),
    useSearchParams: () => mockSearchParams(),
  }
})

// Mock hooks
const mockUseActiveAccount = vi.fn()
const mockUseShowcase = vi.fn()
const mockUseShowcaseRoster = vi.fn().mockReturnValue({ data: null, isPending: false, isError: false })
const mockUseBuilds = vi.fn()
const mockUseMe = vi.fn()

vi.mock('@/hooks/useActiveAccount', () => ({
  useActiveAccount: () => mockUseActiveAccount(),
}))

vi.mock('@/api/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/hooks')>()
  return {
    ...actual,
    useMe: () => mockUseMe(),
    useShowcase: () => mockUseShowcase(),
    useShowcaseRoster: () => mockUseShowcaseRoster(),
    useBuilds: () => mockUseBuilds(),
    useRenameBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useToggleBuildVisibility: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

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

const mockShowcase: ShowcaseResponse = {
  uid: '1504687050',
  nickname: 'ProxyMaster',
  region: 'prod_gf_eu',
  interknot_level: 60,
  avatar_url: '',
  source: 'fresh',
  ttl_seconds: 300,
  fetched_at: '2026-09-01T00:00:00Z',
  agent_count: 1,
  agents: [mockAgent],
}

describe('ShowcasePage', () => {
  it('renders dynamic sidebar with sticky positioning when agents are present', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: mockShowcase,
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)

    // Should render agent rail
    expect(html).toContain('Anby Demara')
    // Layout should render dynamic sidebar capped at card height
    expect(html).toContain('md:items-stretch')
    expect(html).toContain('md:self-stretch')
    expect(html).toContain('md:max-h-full')
    expect(html).not.toContain('md:absolute md:inset-0')
  })

  it('renders empty showcase state when agents list is empty', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: { ...mockShowcase, agents: [] },
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    expect(html).toContain('В витрине этого профиля пока нет агентов')
    expect(html).not.toContain('md:max-h-[calc(100dvh-5rem)]')
  })

  it('does not render save build button for unowned uid when authenticated', () => {
    mockUseMe.mockReturnValue({ data: { id: 'user-1', username: 'TestUser' } })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: { id: 'acc-1', uid: '9999999999' },
      accounts: [{ id: 'acc-1', uid: '9999999999' }],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: mockShowcase,
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    expect(html).not.toContain('Привязать UID')
    expect(html).not.toContain('Сохранить сборку')
  })

  it('renders centered InterknotTerminalError layout when showcaseQuery has an error', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: null,
      isPending: false,
      isError: true,
      error: new Error('Profile not found'),
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    expect(html).toContain('role="alert"')
    expect(html).toContain('justify-center')
    expect(html).toContain('items-center')
    expect(html).toContain('min-h-[calc(100dvh-10rem)]')
  })

  it('recovers with saved presets when Enka is down and roster data is available', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: null,
      isPending: false,
      isError: true,
      error: new Error('502 Bad Gateway'),
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseShowcaseRoster.mockReturnValue({
      data: {
        owner: {
          uid: '1504687050',
          region: 'Europe',
          nickname: 'ProxyMaster',
          avatar_url: null,
          is_verified: true,
        },
        is_public_showcase: true,
        builds: [
          {
            id: 'b1',
            name: 'Standard Preset',
            agent_id: 1011,
            agent_name: 'Anby Demara',
            is_public: true,
            created_at: '',
            updated_at: '',
            build_data: mockAgent,
          },
        ],
        teams: [],
      },
      isPending: false,
      isError: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    expect(html).toContain('Сервера EnkaNetwork временно недоступны')
    expect(html).not.toContain('min-h-[calc(100dvh-10rem)]')
  })

  it('renders discord chip and owner info without verified owner badge', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: {
        ...mockShowcase,
        verified_owner: {
          uid: '1504687050',
          region: 'Europe',
          nickname: 'ProxyMaster',
          avatar_url: null,
          is_verified: true,
          discord_username: 'kirin#0001',
        },
      },
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseShowcaseRoster.mockReturnValue({
      data: null,
      isPending: false,
      isError: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    expect(html).not.toContain('VERIFIED OWNER')
    expect(html).toContain('kirin#0001')
  })

  it('renders loading spinner when tab=presets is opened and rosterQuery is pending', () => {
    mockSearchParams.mockReturnValueOnce([
      new URLSearchParams({ uid: '1504687050', tab: 'presets' }),
      vi.fn(),
    ])
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: mockShowcase,
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseShowcaseRoster.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    // Presets tab should be selected and render spinner instead of flashing live showcase
    expect(html).toContain('Загрузка…')
  })

  it('falls back to live showcase when requested tab has no content', () => {
    mockSearchParams.mockReturnValueOnce([
      new URLSearchParams({ uid: '1504687050', tab: 'presets' }),
      vi.fn(),
    ])
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: mockShowcase,
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseShowcaseRoster.mockReturnValue({
      data: {
        owner: { uid: '1504687050', region: 'Europe', nickname: 'ProxyMaster', avatar_url: null },
        is_public_showcase: true,
        builds: [],
        teams: [],
      },
      isPending: false,
      isError: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    // Should fall back to live showcase showing agent name
    expect(html).toContain('Anby Demara')
  })

  it('renders presets tab but not squads tab when only public presets exist', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: mockShowcase,
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseShowcaseRoster.mockReturnValue({
      data: {
        owner: { uid: '1504687050', region: 'Europe', nickname: 'ProxyMaster', avatar_url: null },
        is_public_roster: true,
        is_public_teams: false,
        is_public_showcase: true,
        builds: [
          {
            id: 'b1',
            name: 'Standard Preset',
            agent_id: 1011,
            agent_name: 'Anby Demara',
            is_public: true,
            created_at: '',
            updated_at: '',
            build_data: mockAgent,
          },
        ],
        teams: [],
      },
      isPending: false,
      isError: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    expect(html).toContain('Архив сборок (1)')
    expect(html).not.toContain('Отряды')
  })

  it('renders squads tab but not presets tab when only public squads exist', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: mockShowcase,
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseShowcaseRoster.mockReturnValue({
      data: {
        owner: { uid: '1504687050', region: 'Europe', nickname: 'ProxyMaster', avatar_url: null },
        is_public_roster: false,
        is_public_teams: true,
        is_public_showcase: true,
        builds: [],
        teams: [
          {
            team: { id: 't1', name: 'Alpha Squad', is_public: true },
            members: [],
          },
        ],
      },
      isPending: false,
      isError: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    expect(html).toContain('Отряды (1)')
    expect(html).not.toContain('Архив сборок')
  })

  it('does not trigger offline fallback if Enka is down and player has 0 public builds and 0 public squads', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: null,
      isPending: false,
      isError: true,
      error: new Error('500 Server Error'),
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseShowcaseRoster.mockReturnValue({
      data: {
        owner: { uid: '1504687050', region: 'Europe', nickname: 'ProxyMaster', avatar_url: null },
        is_public_roster: true,
        is_public_teams: true,
        is_public_showcase: true,
        builds: [],
        teams: [],
      },
      isPending: false,
      isError: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    // Terminal error should be rendered instead of fallback
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('Сервера EnkaNetwork временно недоступны')
  })

  it('sets interknot_level to 0 and hides IL badge in offline fallback mode', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: null,
      isPending: false,
      isError: true,
      error: new Error('502 Bad Gateway'),
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseShowcaseRoster.mockReturnValue({
      data: {
        owner: {
          uid: '1504687050',
          region: 'Europe',
          nickname: 'ProxyMaster',
          avatar_url: null,
          is_verified: true,
        },
        is_public_roster: true,
        is_public_teams: false,
        is_public_showcase: true,
        builds: [
          {
            id: 'b1',
            name: 'Standard Preset',
            agent_id: 1011,
            agent_name: 'Anby Demara',
            is_public: true,
            created_at: '',
            updated_at: '',
            build_data: mockAgent,
          },
        ],
        teams: [],
      },
      isPending: false,
      isError: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    expect(html).toContain('Сервера EnkaNetwork временно недоступны')
    // IL badge should NOT be rendered (interknot_level is 0)
    expect(html).not.toMatch(/IL\s*(<!-- -->)?\s*\d+/)
  })

  it('renders ShowcasePageSkeleton when Enka is down and roster query is still pending', () => {
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: null,
      isPending: false,
      isError: true,
      error: new Error('500 Server Error'),
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseShowcaseRoster.mockReturnValue({
      data: null,
      isPending: true,
      isError: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    // Should render skeleton with aria-busy="true" instead of terminal error
    expect(html).toContain('aria-busy="true"')
    expect(html).not.toContain('role="alert"')
  })

  it('supports explicit tab=live parameter in URL and renders live showcase', () => {
    mockSearchParams.mockReturnValueOnce([
      new URLSearchParams({ uid: '1504687050', tab: 'live' }),
      vi.fn(),
    ])
    mockUseMe.mockReturnValue({ data: null })
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseShowcase.mockReturnValue({
      data: mockShowcase,
      isPending: false,
      isError: false,
      isRefetching: false,
      refetch: vi.fn(),
    })
    mockUseShowcaseRoster.mockReturnValue({
      data: null,
      isPending: false,
      isError: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
    })

    const html = renderToString(<ShowcasePage />)
    expect(html).toContain('Anby Demara')
  })
})
