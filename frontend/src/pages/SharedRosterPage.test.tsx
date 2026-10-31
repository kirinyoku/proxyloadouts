import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import SharedRosterPage from './SharedRosterPage'
import type { Agent, Build, PublicOwnerInfo } from '@/types'

const mockUseQuery = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: unknown) => mockUseQuery(options),
}))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ token: 'roster-token-123' }),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => {
        const dict: Record<string, string> = {
          'common.loading': 'Загрузка…',
          'sharing.rosterNotFoundTitle': 'Ростер не найден или скрыт владельцем',
          'sharing.rosterNotFoundDesc': 'Этот ростер не существует, был удален или владелец скрыл его из общего доступа.',
          'sharing.backToHome': 'На главную',
          'sharing.backToShowcase': 'К витрине',
        }
        return dict[key] ?? key
      },
      i18n: { language: 'ru' },
    }),
  }
})

vi.mock('@/components/showcase/ShowcaseSavedPresets', () => ({
  ShowcaseSavedPresets: ({ builds, profile }: { builds: Build[]; profile: React.ReactNode }) => (
    <div data-testid="showcase-saved-presets">
      {profile}
      <div data-testid="build-count">{builds.length}</div>
    </div>
  ),
}))

vi.mock('@/components/showcase/ShowcaseProfileHeader', () => ({
  ShowcaseProfileIdentity: ({ owner }: { owner: PublicOwnerInfo }) => (
    <div data-testid="showcase-profile-identity">{owner.nickname}</div>
  ),
}))

describe('SharedRosterPage', () => {
  const mockOwner: PublicOwnerInfo = {
    uid: '1504687050',
    region: 'Europe',
    nickname: 'ProxyMaster',
    avatar_url: 'https://example.com/avatar.png',
    is_verified: true,
  }

  const mockBuild: Build = {
    id: 'build-123',
    game_account_id: 'acc-1',
    agent_id: 1011,
    agent_name: 'Эллен',
    name: 'Аномальный крит',
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
      mindscape_cinema: 1,
      attribute: 'Ice',
      specialty: 'Attack',
      rarity: 'S',
      ui_stats: {},
      skills: [],
      highlight_props: [20101],
      recommended_sub_stats: [20101],
      drive_discs: {
        slots: [],
        set_bonuses: [],
      },
    } as unknown as Agent,
  }

  it('renders loading state when pending', () => {
    mockUseQuery.mockReturnValue({
      isPending: true,
      isError: false,
      data: undefined,
    })

    const html = renderToString(<SharedRosterPage />)
    expect(html).toContain('Загрузка…')
  })

  it('renders SharedUnavailableState on error or missing data', () => {
    mockUseQuery.mockReturnValue({
      isPending: false,
      isError: true,
      data: undefined,
    })

    const html = renderToString(<SharedRosterPage />)
    expect(html).toContain('Ростер не найден или скрыт владельцем')
    expect(html).toContain('Этот ростер не существует, был удален или владелец скрыл его из общего доступа.')
    expect(html).toContain('На главную')
    expect(html).not.toContain('К витрине')
  })

  it('renders ShowcaseSavedPresets and profile identity on valid roster data', () => {
    mockUseQuery.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        builds: [mockBuild],
        owner: mockOwner,
      },
    })

    const html = renderToString(<SharedRosterPage />)
    expect(html).toContain('ProxyMaster')
    expect(html).toContain('data-testid="showcase-saved-presets"')
    expect(html).toContain('data-testid="build-count"')
  })
})
