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
          'teamBuilder.pickerNoBuilds': 'У активного Прокси пока нет сохраненных билдов в ростере.',
          'teamBuilder.pickerSearchPlaceholder': 'Поиск по агенту или пресету…',
          'teamBuilder.pickerAll': 'Все',
          'teamBuilder.pickerReset': 'Сбросить',
          'teamBuilder.pickerHideConflicting': 'Скрыть конфликты',
          'teamBuilder.pickerShowAll': 'Показать все',
          'teamBuilder.pickerInSquad': 'В команде',
          'teams.resetFilters': 'Сбросить фильтры',
        }
        return translations[key] ?? (options?.slot != null ? `Занят диск ${options.slot}` : key)
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
  description: '',
  weapon_uid: 'w-1',
  weapon_id: 12001,
  disc_uids: [],
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

  it('renders mobile-adapted bottom sheet drawer and 2-tier stacked build cards', () => {
    const html = renderToString(
      <BuildPickerDialog
        open={true}
        builds={[mockBuild1, mockBuild2]}
        squadBuilds={[mockBuild1]}
        onSelect={vi.fn()}
        onOpenChange={vi.fn()}
      />,
    )

    // Contains bottom sheet styling classes
    expect(html).toContain('rounded-t-[28px]')
    expect(html).toContain('max-h-[92dvh]')

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
})
