import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { PublicBuildPage } from './PublicBuildPage'
import type { Agent, Build, PublicOwnerInfo } from '@/types'

const mockUsePublicBuild = vi.fn()

vi.mock('@/api/hooks', () => ({
  usePublicBuild: (id: string) => mockUsePublicBuild(id),
}))

vi.mock('react-router-dom', () => ({
  useParams: () => ({ buildId: 'build-123' }),
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
          'sharing.buildNotFoundTitle': 'Сборка не найдена или скрыта владельцем',
          'sharing.buildNotFoundDesc': 'Эта сборка не существует, была удалена или владелец скрыл её.',
          'sharing.backToHome': 'На главную',
          'sharing.backToShowcase': 'К витрине',
          'showcase.mobileDiscs': 'Диски',
          'showcase.mobileStats': 'Характеристики',
        }
        return dict[key] ?? key
      },
    }),
  }
})

describe('PublicBuildPage', () => {
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
    description: 'Заметка по ротации',
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
      drive_discs: { slots: [], set_bonuses: [] },
      w_engine: {
        id: 11001,
        uid: 'w-1',
        name: 'Латунный чайник',
        level: 60,
        phase: 1,
        modification: 5,
        rarity: 'S',
        specialty: 'Attack',
        icon_url: 'https://example.com/weapon.png',
      } as unknown as Agent['w_engine'],
    } as unknown as Agent,
  }

  it('renders loading state', () => {
    mockUsePublicBuild.mockReturnValue({
      isLoading: true,
      isError: false,
      data: undefined,
    })

    const html = renderToString(<PublicBuildPage />)
    expect(html).toContain('Загрузка…')
  })

  it('renders not found state on error', () => {
    mockUsePublicBuild.mockReturnValue({
      isLoading: false,
      isError: true,
      data: undefined,
    })

    const html = renderToString(<PublicBuildPage />)
    expect(html).toContain('Сборка не найдена или скрыта владельцем')
    expect(html).toContain('На главную')
    expect(html).toContain('К витрине')
  })

  it('renders build details and author header on success', () => {
    mockUsePublicBuild.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        build: mockBuild,
        owner: mockOwner,
      },
    })

    const html = renderToString(<PublicBuildPage />)
    expect(html).toContain('ProxyMaster')
    expect(html).toContain('Эллен')
    expect(html).toContain('Аномальный крит')
    expect(html).toContain('Заметка по ротации')
    expect(html).toContain('Латунный чайник')
  })
})
