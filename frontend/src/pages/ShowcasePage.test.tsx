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
          'showcase.linkUid': 'Привязать UID',
          'showcase.linkUidTooltip': 'Привязать этот UID',
        }
        return translations[key] ?? key
      },
      i18n: { language: 'ru' },
    }),
  }
})

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
    useSearchParams: () => [new URLSearchParams({ uid: '1504687050' }), vi.fn()],
  }
})

// Mock hooks
const mockUseActiveAccount = vi.fn()
const mockUseShowcase = vi.fn()
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
    useBuilds: () => mockUseBuilds(),
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

  it('renders link UID button on the agent card but not in the header for unowned uid when authenticated', () => {
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
    // The button should be present on the agent card
    expect(html).toContain('Привязать UID')
    // The header before the agent card heading should not contain the link button
    const parts = html.split(/<h2[^>]*>Anby Demara<\/h2>/)
    expect(parts[0]).not.toContain('Привязать UID')
    expect(parts[1]).toContain('Привязать UID')
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
})
