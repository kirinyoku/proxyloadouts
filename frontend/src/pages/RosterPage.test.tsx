import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { RosterPage } from './RosterPage'
import type { Build } from '@/types'

// Mock react-i18next
vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { count?: number }) => {
        const translations: Record<string, string> = {
          'nav.roster': 'РОСТЕР',
          'roster.linkUidTitle': 'Привяжите UID',
          'roster.emptyTitle': 'В ростере пока нет сохраненных сборок',
          'roster.noSearchResults': 'По поисковому запросу ничего не найдено.',
          'roster.clearSearchButton': 'Очистить поиск',
          'roster.noFilterResults': 'По выбранным атрибутам и специальностям агентов не найдено.',
          'roster.resetFilters': 'Сбросить фильтры',
          'roster.buildsLimitTitle': `${options?.count ?? 0}/5 сборок`,
        }
        return translations[key] ?? key
      },
    }),
  }
})

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
}))

// Mock hooks
const mockUseActiveAccount = vi.fn()
const mockUseBuilds = vi.fn()

vi.mock('@/hooks/useActiveAccount', () => ({
  useActiveAccount: () => mockUseActiveAccount(),
}))

vi.mock('@/api/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/hooks')>()
  return {
    ...actual,
    useBuilds: () => mockUseBuilds(),
    useRenameBuild: () => ({ mutate: vi.fn(), isPending: false }),
    useDeleteBuild: () => ({ mutate: vi.fn(), isPending: false }),
  }
})

const mockBuild: Build = {
  id: 'build-1',
  game_account_id: '1',
  agent_id: 1011,
  agent_name: 'Anby Demara',
  name: 'Anby Stun Build',
  description: '',
  weapon_uid: null,
  weapon_id: null,
  disc_uids: [],
  build_data: {
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
  },
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
}

describe('RosterPage', () => {
  it('renders active roster and showcase when builds are present and match filters', () => {
    mockUseActiveAccount.mockReturnValue({
      activeAccount: { id: 1, uid: '1504687050' },
      accounts: [{ id: 1, uid: '1504687050' }],
      isPending: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [mockBuild],
      isPending: false,
      isError: false,
      isSuccess: true,
    })

    const html = renderToString(<RosterPage />)

    // Should render agent rail and showcase
    expect(html).toContain('Anby Demara')
    expect(html).toContain('Anby Stun Build')
    // Layout should render dynamic sidebar capped at card height
    expect(html).toContain('md:items-stretch')
    expect(html).toContain('md:self-stretch')
    expect(html).toContain('md:max-h-full')
    expect(html).not.toContain('md:absolute md:inset-0')
    // Should NOT render empty filter results card
    expect(html).not.toContain('По выбранным атрибутам и специальностям агентов не найдено.')
  })

  it('renders link UID state when user has no linked accounts', () => {
    mockUseActiveAccount.mockReturnValue({
      activeAccount: null,
      accounts: [],
      isPending: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      isSuccess: true,
    })

    const html = renderToString(<RosterPage />)
    expect(html).toContain('Привяжите UID')
  })

  it('renders empty roster state when account has zero builds', () => {
    mockUseActiveAccount.mockReturnValue({
      activeAccount: { id: 1, uid: '1504687050' },
      accounts: [{ id: 1, uid: '1504687050' }],
      isPending: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [],
      isPending: false,
      isError: false,
      isSuccess: true,
    })

    const html = renderToString(<RosterPage />)
    expect(html).toContain('В ростере пока нет сохраненных сборок')
  })

  it('hides showcase and displays empty search message with clear button when search matches no agents', () => {
    mockUseActiveAccount.mockReturnValue({
      activeAccount: { id: 1, uid: '1504687050' },
      accounts: [{ id: 1, uid: '1504687050' }],
      isPending: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [mockBuild], // Anby is Electric Stun
      isPending: false,
      isError: false,
      isSuccess: true,
    })

    // Search query that matches no agents
    const html = renderToString(<RosterPage initialSearch="NonExistentAgent" />)

    // Should display empty search results message
    expect(html).toContain('По поисковому запросу ничего не найдено.')
    // Should display clear search button
    expect(html).toContain('Очистить поиск')
    // Showcase and agent rail must NOT be rendered when no agents match
    expect(html).not.toContain('Anby Stun Build')
  })

  it('does not display empty plate when no search is active even if an unmatching filter was preset', () => {
    mockUseActiveAccount.mockReturnValue({
      activeAccount: { id: 1, uid: '1504687050' },
      accounts: [{ id: 1, uid: '1504687050' }],
      isPending: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [mockBuild], // Anby is Electric Stun
      isPending: false,
      isError: false,
      isSuccess: true,
    })

    // Filter by Ice attribute without search query
    const html = renderToString(<RosterPage initialAttribute="Ice" />)

    // Empty plate is reserved only for search, so it must not render
    expect(html).not.toContain('По поисковому запросу ничего не найдено.')
    expect(html).not.toContain('Очистить поиск')
    // Showcase is not rendered because no agent matches Ice
    expect(html).not.toContain('Anby Stun Build')
  })

  it('disables specialties that do not exist for the selected attribute (e.g. Physical disables Defense)', () => {
    const mockCorin: Build = {
      ...mockBuild,
      id: 'corin-1',
      agent_id: 1021,
      agent_name: 'Corin Wickes',
      name: 'Corin Saw Build',
      build_data: {
        ...mockBuild.build_data,
        id: 1021,
        name: 'Corin Wickes',
        attribute: 'Physical',
        attribute_name: 'Physical',
        specialty: 'Attack',
        specialty_name: 'Attack',
      },
    }

    const mockBen: Build = {
      ...mockBuild,
      id: 'ben-1',
      agent_id: 1031,
      agent_name: 'Ben Bigger',
      name: 'Ben Pillar Build',
      build_data: {
        ...mockBuild.build_data,
        id: 1031,
        name: 'Ben Bigger',
        attribute: 'Fire',
        attribute_name: 'Fire',
        specialty: 'Defense',
        specialty_name: 'Defense',
      },
    }

    mockUseActiveAccount.mockReturnValue({
      activeAccount: { id: 1, uid: '1504687050' },
      accounts: [{ id: 1, uid: '1504687050' }],
      isPending: false,
    })
    mockUseBuilds.mockReturnValue({
      data: [mockCorin, mockBen], // Corin is Physical Attack, Ben is Fire Defense (NO Physical Defense)
      isPending: false,
      isError: false,
      isSuccess: true,
    })

    // Select Physical attribute: Defense has NO Physical agent, so Defense must be disabled
    const htmlWithPhysical = renderToString(<RosterPage initialAttribute="Physical" />)

    // Corin build should be rendered
    expect(htmlWithPhysical).toContain('Corin Wickes')

    // Specialty: Defense is marked as disabled because no Physical Defense agent exists
    expect(htmlWithPhysical).toContain('aria-disabled="true"')
    expect(htmlWithPhysical).toContain('disabled=""')
    expect(htmlWithPhysical).toContain('cursor-not-allowed')
  })
})
