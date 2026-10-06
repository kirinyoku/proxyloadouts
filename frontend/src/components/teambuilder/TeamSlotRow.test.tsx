import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { TeamSlotRow } from './TeamSlotRow'
import type { Build } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { count?: number; name?: string; slot?: number | string }) => {
        const dict: Record<string, string> = {
          'teams.slotChooseAgent': 'Выбрать агента',
          'teams.slotLabel': `Слот ${options?.slot ?? 1}`,
          'teamBuilder.emptySlotChoose': 'Добавить агента',
          'teamBuilder.emptySlotAdd': 'Добавить в слот',
          'teamBuilder.replaceAgent': 'Заменить агента',
        }
        return dict[key] ?? key
      },
    }),
  }
})

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const baseBuild: Build = {
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
    attribute_name: 'Лед',
    specialty: 'Attack',
    specialty_name: 'Нападение',
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

describe('TeamSlotRow w-engine superposition badge', () => {
  it('renders black badge P1 for S-rank w-engine with modification 1', () => {
    const sRankBuild: Build = {
      ...baseBuild,
      build_data: {
        ...baseBuild.build_data,
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

    const html = renderToString(
      <TeamSlotRow
        slot={1}
        selected={sRankBuild}
        builds={[sRankBuild]}
        usedBuildIds={new Set(['build-1'])}
        conflictCodes={[]}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    expect(html).toContain('P1')
    expect(html).toMatch(/rounded-full\s+border\s+border-white\/20\s+bg-black[^"]*text-white/)
    expect(html).not.toContain('text-amber-400')
    expect(html).not.toContain('border-amber-400/40')
  })

  it('renders black badge P5 for S-rank w-engine with modification 5', () => {
    const sRankBuildP5: Build = {
      ...baseBuild,
      build_data: {
        ...baseBuild.build_data,
        w_engine: {
          id: 12001,
          uid: 'w-s-5',
          name: 'Глубоководный гость',
          rarity: 'S',
          level: 60,
          phase: 5,
          modification: 5,
          specialty: 'Attack',
          specialty_name: 'Нападение',
          icon_url: 'https://example.com/w1.webp',
          main_stat: { property_id: 1, name: 'ATK', value: 100, is_percent: false, rolls: 0, icon_url: '' },
          secondary_stat: { property_id: 2, name: 'CRIT', value: 20, is_percent: true, rolls: 0, icon_url: '' },
          passive_description: '',
        },
      },
    }

    const html = renderToString(
      <TeamSlotRow
        slot={1}
        selected={sRankBuildP5}
        builds={[sRankBuildP5]}
        usedBuildIds={new Set(['build-1'])}
        conflictCodes={[]}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    expect(html).toContain('P5')
    expect(html).toMatch(/rounded-full\s+border\s+border-white\/20\s+bg-black[^"]*text-white/)
  })

  it('does NOT render superposition badge for A-rank w-engine with modification 1', () => {
    const aRankBuildP1: Build = {
      ...baseBuild,
      build_data: {
        ...baseBuild.build_data,
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

    const html = renderToString(
      <TeamSlotRow
        slot={1}
        selected={aRankBuildP1}
        builds={[aRankBuildP1]}
        usedBuildIds={new Set(['build-1'])}
        conflictCodes={[]}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    expect(html).not.toMatch(/rounded-full border border-white\/20 bg-black[^"]*>\s*P1\s*</)
  })

  it('renders black badge P5 for A-rank w-engine with modification 5', () => {
    const aRankBuildP5: Build = {
      ...baseBuild,
      build_data: {
        ...baseBuild.build_data,
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
      <TeamSlotRow
        slot={1}
        selected={aRankBuildP5}
        builds={[aRankBuildP5]}
        usedBuildIds={new Set(['build-1'])}
        conflictCodes={[]}
        onSelect={vi.fn()}
        onClear={vi.fn()}
      />,
    )

    expect(html).toContain('P5')
    expect(html).toMatch(/rounded-full\s+border\s+border-white\/20\s+bg-black[^"]*text-white/)
  })
})
