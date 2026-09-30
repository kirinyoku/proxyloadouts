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
})
