import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { DriveDiscGrid, SetBonusChips } from './DriveDiscGrid'
import type { DriveDisc, DriveDiscs } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: { count?: number; slot?: number; level?: number }) => {
        if (options?.count !== undefined) return `${key}:${options.count}`
        if (options?.slot !== undefined) return `${key}:${options.slot}`
        if (options?.level !== undefined) return `${key}:${options.level}`
        return key
      },
    }),
  }
})

describe('DriveDiscGrid - Highlight SubStats', () => {
  // Mock Remielle (1581) disc setup matching user's in-game screenshot
  const mockDisc: DriveDisc = {
    id: 2001,
    uid: 'disc-slot-2',
    slot: 2,
    level: 15,
    rarity: 'S',
    icon_path: '',
    set: {
      id: 1,
      name: 'Feathered Fate',
    },
    main_stat: {
      property_id: 12101,
      name: 'ATK',
      value: 316,
      is_percent: false,
      rolls: 0,
      icon_url: '',
    },
    sub_stats: [
      {
        property_id: 11102,
        name: 'HP',
        value: 0.06,
        is_percent: true,
        rolls: 2, // base 1 + 1 upgrade = +1
        icon_url: '',
      },
      {
        property_id: 31201,
        name: 'Anomaly Proficiency',
        value: 27,
        is_percent: false,
        rolls: 3, // base 1 + 2 upgrades = +2
        icon_url: '',
      },
      {
        property_id: 12102,
        name: 'ATK',
        value: 0.09,
        is_percent: true,
        rolls: 3, // base 1 + 2 upgrades = +2
        icon_url: '',
      },
      {
        property_id: 13101,
        name: 'DEF',
        value: 15,
        is_percent: false,
        rolls: 1, // base 1 (no upgrades)
        icon_url: '',
      },
    ],
  }

  const driveDiscs: DriveDiscs = {
    slots: [mockDisc],
    set_bonuses: [{ count: 2, set: mockDisc.set, effects: [] }],
  }

  it('highlights recommended substats in amber-400 and non-recommended in foreground/90 for Remielle (1581)', () => {
    const html = renderToString(
      <DriveDiscGrid driveDiscs={driveDiscs} agentId={1581} />
    )

    // Recommended: Anomaly Proficiency and ATK should be rendered with text-amber-400 font-semibold
    expect(html).toContain('font-semibold text-amber-400">Anomaly Proficiency</span>')
    expect(html).toContain('font-semibold text-amber-400">ATK</span>')

    // Non-recommended: HP and DEF should NOT be rendered with amber-400 for stat name
    expect(html).toContain('text-foreground/90">HP</span>')
    expect(html).toContain('text-foreground/90">DEF</span>')

    // Upgrades: +1 and +2 are rendered with text-amber-400 font-bold
    expect(html).toContain('font-mono text-xs font-bold text-amber-400 leading-none">+<!-- -->1</span>')
    expect(html).toContain('font-mono text-xs font-bold text-amber-400 leading-none">+<!-- -->2</span>')

    // Upgrades are placed directly next to the substat name in the same text group
    expect(html).toMatch(/Anomaly Proficiency<\/span><span class="[^"]*text-amber-400[^"]*">\+<!-- -->2<\/span>/)
    expect(html).toMatch(/ATK<\/span><span class="[^"]*text-amber-400[^"]*">\+<!-- -->2<\/span>/)

    // Colored border is only applied to recommended substats, not regular ones (even with rolls like HP +1)
    expect(html).toMatch(/class="[^"]*border-amber-400\/20[^"]*"[^>]*title="Anomaly Proficiency/)
    expect(html).not.toMatch(/class="[^"]*border-amber-400\/20[^"]*"[^>]*title="HP/)
  })

  it('renders all substat names as foreground/90 when agentId is omitted', () => {
    const html = renderToString(<DriveDiscGrid driveDiscs={driveDiscs} />)

    expect(html).toContain('text-foreground/90">Anomaly Proficiency</span>')
    expect(html).toContain('text-foreground/90">ATK</span>')
    expect(html).toContain('text-foreground/90">HP</span>')
    expect(html).toContain('text-foreground/90">DEF</span>')
  })

  it('correctly handles Nangong Yu (1511): ATK% is highlighted, but Flat ATK is NOT highlighted', () => {
    const nangongDisc: DriveDisc = {
      ...mockDisc,
      sub_stats: [
        {
          property_id: 12102, // ATK%
          name: 'ATK',
          value: 0.09,
          is_percent: true,
          rolls: 1,
          icon_url: '',
        },
        {
          property_id: 12103, // Flat ATK
          name: 'ATK',
          value: 57,
          is_percent: false,
          rolls: 1,
          icon_url: '',
        },
      ],
    }

    const html = renderToString(
      <DriveDiscGrid driveDiscs={{ slots: [nangongDisc], set_bonuses: [] }} agentId={1511} />
    )

    // ATK% is recommended (amber-400 font-semibold)
    expect(html).toContain('font-semibold text-amber-400">ATK</span>')
    // Flat ATK is not recommended (foreground/90)
    expect(html).toContain('text-foreground/90">ATK</span>')
  })

  it('respects recommendedSubStats passed via prop directly', () => {
    const customDisc: DriveDisc = {
      ...mockDisc,
      sub_stats: [
        {
          property_id: 13102, // DEF%
          name: 'DEF',
          value: 0.096,
          is_percent: true,
          rolls: 1,
          icon_url: '',
        },
      ],
    }

    // Pass custom recommendedSubStats [13102]
    const html = renderToString(
      <DriveDiscGrid
        driveDiscs={{ slots: [customDisc], set_bonuses: [] }}
        agentId={1511}
        recommendedSubStats={[13102]}
      />
    )

    expect(html).toContain('font-semibold text-amber-400">DEF</span>')
  })

  it('renders disc slot numbers with text-muted-foreground instead of amber-400', () => {
    const html = renderToString(<DriveDiscGrid driveDiscs={driveDiscs} />)

    // Slot 2 should have text-muted-foreground
    expect(html).toMatch(/class="[^"]*text-muted-foreground[^"]*">\[(?:<!-- -->)?2(?:<!-- -->)?\]<\/span>/)
    // Slot numbers should not use text-amber-400
    expect(html).not.toMatch(/class="[^"]*text-amber-400[^"]*">\[(?:<!-- -->)?2(?:<!-- -->)?\]<\/span>/)
  })

  it('uses single-column layout on mobile and two-column on tablet', () => {
    const html = renderToString(<DriveDiscGrid driveDiscs={driveDiscs} />)

    expect(html).toContain('grid-cols-1')
    expect(html).toContain('sm:grid-cols-2')
  })

  it('renders all 6 slots in a single unified grid container without splitting into 2 separate grids', () => {
    const html = renderToString(<DriveDiscGrid driveDiscs={driveDiscs} />)

    // Ensure there is only ONE grid container for the disc cards, eliminating the 2-container layout bug
    const gridMatches = html.match(/sm:grid-cols-2/g)
    expect(gridMatches).toHaveLength(1)

    // All slots 1 through 6 are rendered in the unified grid
    for (let slot = 1; slot <= 6; slot++) {
      if (slot === 2) {
        expect(html).toMatch(/\[(?:<!-- -->)?2(?:<!-- -->)?\]/)
      } else {
        expect(html).toContain(`gear.slotNumber:${slot}`)
      }
    }
  })

  it('applies h-full on disc cards to maintain equal height across grid rows', () => {
    const html = renderToString(<DriveDiscGrid driveDiscs={driveDiscs} />)
    expect(html).toContain('h-full')
  })

  it('does not render active set bonuses chips in DriveDiscGrid', () => {
    const multiBonusDiscs: DriveDiscs = {
      slots: [mockDisc],
      set_bonuses: [
        { count: 4, set: { id: 1, name: 'Hormone Punk' }, effects: [] },
        { count: 2, set: { id: 2, name: 'Woodpecker Electro' }, effects: [] },
      ],
    }

    const html = renderToString(<DriveDiscGrid driveDiscs={multiBonusDiscs} />)

    // Should not render set bonus names or counts in DriveDiscGrid
    expect(html).not.toContain('Hormone Punk')
    expect(html).not.toContain('Woodpecker Electro')
    expect(html).not.toContain('(4)')
    expect(html).not.toContain('(2)')
    expect(html).not.toContain('showcase.activeSets')
  })

  it('highlights recommended sub-stats procs in SubStatTotalsBar at the bottom', () => {
    const html = renderToString(
      <DriveDiscGrid driveDiscs={driveDiscs} agentId={1581} />
    )

    // Recommended sub-stats procs are highlighted in SubStatTotalsBar at the bottom
    expect(html).toContain('border-amber-400/40 bg-amber-400/[0.08]')
  })

  it('renders SetBonusChips component with correct order and styling when used directly', () => {
    const bonuses = [
      { count: 2, set: { id: 2, name: 'Woodpecker Electro' }, effects: [] },
      { count: 4, set: { id: 1, name: 'Hormone Punk' }, effects: [] },
    ]

    const html = renderToString(
      <SetBonusChips bonuses={bonuses} discs={[mockDisc]} />
    )

    // 4-piece set bonus count uses font-bold text-primary
    expect(html).toMatch(/class="[^"]*text-primary\b[^"]*">\((?:<!-- -->)?4(?:<!-- -->)?\)<\/span>/)
    // 2-piece set bonus count uses font-semibold text-primary/75
    expect(html).toMatch(/class="[^"]*text-primary\/75[^"]*">\((?:<!-- -->)?2(?:<!-- -->)?\)<\/span>/)
    // Set bonuses should not use text-amber-400
    expect(html).not.toMatch(/class="[^"]*text-amber-400[^"]*">\((?:<!-- -->)?(?:2|4)(?:<!-- -->)?\)<\/span>/)
    // Hides set names on mobile
    expect(html).toContain('hidden sm:inline max-w-40 truncate font-heading text-xs font-bold tracking-wide text-foreground">Hormone Punk</span>')
  })
})

