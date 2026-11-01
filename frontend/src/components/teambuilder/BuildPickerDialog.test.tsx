import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { BuildPickerDialog } from './BuildPickerDialog'
import type { Build } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        const translations: Record<string, string> = {
          'teamBuilder.pickerTitle': 'Выбор агента в команду',
          'teamBuilder.pickerTitleMobile': 'Выбор агента',
          'teamBuilder.pickerDesc': 'Выберите сохраненный билд агента для текущего слота команды',
          'teamBuilder.pickerTotalBuilds': 'Всего готовых билдов',
          'teamBuilder.pickerNoBuilds': 'В вашем ростере пока нет ни одной сборки.',
          'teamBuilder.pickerSearchPlaceholder': 'Поиск по агенту или пресету…',
          'teamBuilder.pickerAll': 'Все',
          'teamBuilder.pickerReset': 'Сбросить',
          'teamBuilder.pickerHideConflicting': 'Скрыть конфликты',
          'teamBuilder.pickerShowAll': 'Показать все',
          'teamBuilder.pickerInSquad': 'В команде',
          'teamBuilder.pickerSelectButton': 'ВЫБРАТЬ',
          'teamBuilder.pickerConflictBadge': 'КОНФЛИКТ',
          'teamBuilder.pickerGearConflictTitle': 'Конфликт экипировки:',
          'teams.resetFilters': 'Сбросить фильтры',
        }
        return translations[key] ?? ((options?.defaultValue as string) ?? (options?.slot != null ? `Занят диск ${options.slot}` : key))
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
  DialogClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DialogContent: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const mockBuild1: Build = {
  id: 'build-1',
  game_account_id: 'acc-1',
  agent_id: 1011,
  agent_name: 'Эллен',
  name: 'Shark Frostbite',
  description: 'Секретная заметка к сборке',
  weapon_uid: 'w-1',
  weapon_id: 12001,
  disc_uids: [],
  is_public: false,
  created_at: '2026-09-25T20:00:00Z',
  updated_at: '2026-09-25T20:00:00Z',
  build_data: {
    id: 1011,
    name: 'Эллен',
    level: 60,
    promotion: 6,
    mindscape_cinema: 0,
    core_skill_enhancement: 0,
    rarity: 'S',
    attribute: 'Ice',
    attribute_name: 'Ice',
    specialty: 'Attack',
    specialty_name: 'Attack',
    skin: null,
    splash_art_url: '',
    skills: [],
    w_engine: null,
    drive_discs: {
      slots: [],
      set_bonuses: [],
    },
  },
}

const mockBuild2: Build = {
  id: 'build-2',
  game_account_id: 'acc-1',
  agent_id: 1021,
  agent_name: 'Корин',
  name: 'Housekeeper Saw',
  description: '',
  weapon_uid: 'w-1', // same weapon -> conflict!
  weapon_id: 12001,
  disc_uids: [],
  is_public: false,
  created_at: '2026-09-25T20:00:00Z',
  updated_at: '2026-09-25T20:00:00Z',
  build_data: {
    id: 1021,
    name: 'Корин',
    level: 60,
    promotion: 6,
    mindscape_cinema: 0,
    core_skill_enhancement: 0,
    rarity: 'A',
    attribute: 'Physical',
    attribute_name: 'Physical',
    specialty: 'Attack',
    specialty_name: 'Attack',
    skin: null,
    splash_art_url: '',
    skills: [],
    w_engine: null,
    drive_discs: {
      slots: [],
      set_bonuses: [],
    },
  },
}

describe('BuildPickerDialog', () => {
  it('does not render "Сбросить" button on initial render even when conflicts exist', () => {
    const html = renderToString(
      <BuildPickerDialog
        open={true}
        builds={[mockBuild1, mockBuild2]}
        squadBuilds={[mockBuild1]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )

    // Conflict toggle is visible
    expect(html).toContain('Скрыть конфликты')
    // Reset filters button should NOT be visible when no filters are active
    expect(html).not.toContain('Сбросить')
  })

  it('renders mobile-adapted fullscreen modal and 2-tier stacked build cards', () => {
    const html = renderToString(
      <BuildPickerDialog
        open={true}
        builds={[mockBuild1, mockBuild2]}
        squadBuilds={[mockBuild1]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )

    // Contains fullscreen mobile styling classes
    expect(html).toContain('h-dvh')
    expect(html).toContain('rounded-none')

    // Contains both mobile and desktop title variants
    expect(html).toContain('Выбор агента')
    expect(html).toContain('Выбор агента в команду')

    // Contains build names
    expect(html).toContain('Shark Frostbite')
    expect(html).toContain('Housekeeper Saw')

    // Conflict badge rendered for duplicate/weapon reuse
    expect(html).toContain('В команде')
    expect(html).toContain('Скрыть конфликты')
  })

  it('renders black superposition badge for S-rank w-engine at P1 and hides badge for A-rank at P1', () => {
    const sRankBuild: Build = {
      ...mockBuild1,
      id: 'build-s-rank',
      build_data: {
        ...mockBuild1.build_data,
        w_engine: {
          id: 12001,
          uid: 'w-s-1',
          name: 'Глубоководный гость',
          rarity: 'S',
          level: 60,
          phase: 1,
          modification: 1,
          specialty: 'Attack',
          specialty_name: 'Нападение',
          icon_url: 'https://example.com/w1.webp',
          main_stat: { property_id: 1, name: 'ATK', value: 100, is_percent: false, rolls: 0, icon_url: '' },
          secondary_stat: { property_id: 2, name: 'CRIT', value: 20, is_percent: true, rolls: 0, icon_url: '' },
          passive_description: '',
        },
      },
    }

    const aRankBuildP1: Build = {
      ...mockBuild2,
      id: 'build-a-rank-p1',
      build_data: {
        ...mockBuild2.build_data,
        w_engine: {
          id: 11001,
          uid: 'w-a-1',
          name: 'Двигатель звездопада',
          rarity: 'A',
          level: 60,
          phase: 1,
          modification: 1,
          specialty: 'Attack',
          specialty_name: 'Нападение',
          icon_url: 'https://example.com/w2.webp',
          main_stat: { property_id: 1, name: 'ATK', value: 100, is_percent: false, rolls: 0, icon_url: '' },
          secondary_stat: { property_id: 2, name: 'ATK%', value: 15, is_percent: true, rolls: 0, icon_url: '' },
          passive_description: '',
        },
      },
    }

    const aRankBuildP5: Build = {
      ...mockBuild2,
      id: 'build-a-rank-p5',
      build_data: {
        ...mockBuild2.build_data,
        w_engine: {
          id: 11002,
          uid: 'w-a-5',
          name: 'Двигатель звездопада',
          rarity: 'A',
          level: 60,
          phase: 5,
          modification: 5,
          specialty: 'Attack',
          specialty_name: 'Нападение',
          icon_url: 'https://example.com/w2.webp',
          main_stat: { property_id: 1, name: 'ATK', value: 100, is_percent: false, rolls: 0, icon_url: '' },
          secondary_stat: { property_id: 2, name: 'ATK%', value: 15, is_percent: true, rolls: 0, icon_url: '' },
          passive_description: '',
        },
      },
    }

    const html = renderToString(
      <BuildPickerDialog
        open={true}
        builds={[sRankBuild, aRankBuildP1, aRankBuildP5]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )

    // S-rank with modification 1 should render black P1 badge
    expect(html).toContain('P1')
    expect(html).toMatch(/rounded-full\s+border\s+border-white\/20\s+bg-black[^"]*text-white/)

    // A-rank with modification 5 should render P5 badge
    expect(html).toContain('P5')

    // Should not use old amber styling
    expect(html).not.toContain('text-amber-400')
    expect(html).not.toContain('border-amber-400/40')
  })

  it('renders 3-column desktop layout and contextual conflict warning ring on conflicting gear', () => {
    const conflictingWithWEngine: Build = {
      ...mockBuild2,
      build_data: {
        ...mockBuild2.build_data,
        w_engine: {
          id: 12001,
          uid: 'w-1',
          name: 'Глубоководный гость',
          rarity: 'S',
          level: 60,
          phase: 1,
          modification: 1,
          specialty: 'Attack',
          specialty_name: 'Нападение',
          icon_url: 'https://example.com/w1.webp',
          main_stat: { property_id: 1, name: 'ATK', value: 100, is_percent: false, rolls: 0, icon_url: '' },
          secondary_stat: { property_id: 2, name: 'CRIT', value: 20, is_percent: true, rolls: 0, icon_url: '' },
          passive_description: '',
        },
      },
    }

    const availableBuild: Build = {
      ...mockBuild2,
      id: 'build-available',
      weapon_uid: 'w-different',
    }

    const html = renderToString(
      <BuildPickerDialog
        open={true}
        builds={[mockBuild1, conflictingWithWEngine, availableBuild]}
        squadBuilds={[mockBuild1]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )

    // Contains 3-column grid definition
    expect(html).toContain('sm:grid-cols-[1fr_auto_148px]')
    // Contains gear conflict status badge and edge styling in red
    expect(html).toContain('border-red-500/35')
    expect(html).not.toContain('border-amber-500')
    // No cyan colors used anywhere for in-squad status
    expect(html).not.toContain('border-cyan-400')
    expect(html).not.toContain('bg-cyan-400')
    expect(html).not.toContain('text-cyan-300')
    // Contains localized select button without hashtag or chevron
    expect(html).toContain('ВЫБРАТЬ')
    expect(html).not.toContain('#SELECT')
    // Build description/notes are omitted, keeping only build title
    expect(html).not.toContain('Секретная заметка к сборке')
  })

  it('renders drive disc sets sorted with 4-piece set before 2-piece set regardless of input order', () => {
    const buildWithUnsortedSets: Build = {
      ...mockBuild1,
      id: 'build-unsorted-sets',
      build_data: {
        ...mockBuild1.build_data,
        drive_discs: {
          slots: [
            {
              id: 20101,
              uid: 'disc-201-1',
              slot: 1,
              level: 15,
              rarity: 'S',
              icon_path: 'https://example.com/disc2.webp',
              set: { id: 201, name: 'Woodpecker Electro' },
              main_stat: { property_id: 1, name: 'CRIT', value: 24, is_percent: true, rolls: 0, icon_url: '' },
              sub_stats: [],
            },
            {
              id: 20201,
              uid: 'disc-202-1',
              slot: 2,
              level: 15,
              rarity: 'S',
              icon_path: 'https://example.com/disc4.webp',
              set: { id: 202, name: 'Hormone Punk' },
              main_stat: { property_id: 2, name: 'ATK', value: 30, is_percent: true, rolls: 0, icon_url: '' },
              sub_stats: [],
            },
          ],
          // Deliberately put 2-piece bonus first and 4-piece bonus second
          set_bonuses: [
            { count: 2, set: { id: 201, name: 'Woodpecker Electro' }, effects: [] },
            { count: 4, set: { id: 202, name: 'Hormone Punk' }, effects: [] },
          ],
        },
      },
    }

    const html = renderToString(
      <BuildPickerDialog
        open={true}
        builds={[buildWithUnsortedSets]}
        squadBuilds={[]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )

    // The 4-piece set (Hormone Punk) should appear before the 2-piece set (Woodpecker Electro)
    const index4pc = html.indexOf('Hormone Punk')
    const index2pc = html.indexOf('Woodpecker Electro')
    expect(index4pc).toBeGreaterThan(-1)
    expect(index2pc).toBeGreaterThan(-1)
    expect(index4pc).toBeLessThan(index2pc)
  })

  it('renders conflict badge with chevron indicator and aria-expanded attribute for gear conflict across mobile and desktop', () => {
    const conflictingWithWEngine: Build = {
      ...mockBuild2,
      id: 'build-weapon-conflict',
      weapon_uid: 'w-1',
    }

    const html = renderToString(
      <BuildPickerDialog
        open={true}
        builds={[mockBuild1, conflictingWithWEngine]}
        squadBuilds={[mockBuild1]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )

    // Conflict badge with chevron indicator exists for touch affordance
    expect(html).toContain('КОНФЛИКТ')
    expect(html).toContain('lucide-chevron-down')
    // Option is marked with aria-disabled and aria-expanded="false"
    expect(html).toContain('aria-disabled="true"')
    expect(html).toContain('aria-expanded="false"')
  })
})

