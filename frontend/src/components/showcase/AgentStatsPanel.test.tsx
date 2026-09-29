import { describe, it, expect, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AgentStatsPanel } from './AgentStatsPanel'
import type { UIStats } from '@/types'

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  }
})

describe('AgentStatsPanel - Recommended Stat Highlighting', () => {
  const mockUIStats: UIStats = {
    hp: {
      property_id: 11101,
      name: 'HP',
      base: '7483',
      added: '+3075',
      total: '10558',
      icon_url: '',
    },
    atk: {
      property_id: 12101,
      name: 'ATK',
      base: '931',
      added: '+2349',
      total: '3280',
      icon_url: '',
    },
    def: {
      property_id: 13101,
      name: 'DEF',
      base: '612',
      added: '+243',
      total: '855',
      icon_url: '',
    },
    impact: {
      property_id: 12201,
      name: 'Impact',
      base: '93',
      added: '+0',
      total: '93',
      icon_url: '',
    },
    crit_rate: {
      property_id: 20101,
      name: 'CRIT Rate',
      base: '5.0%',
      added: '+44.0%',
      total: '49.0%',
      icon_url: '',
    },
    crit_dmg: {
      property_id: 21101,
      name: 'CRIT DMG',
      base: '50.0%',
      added: '+100.8%',
      total: '150.8%',
      icon_url: '',
    },
    anomaly_proficiency: {
      property_id: 31201,
      name: 'Anomaly Proficiency',
      base: '91',
      added: '+26',
      total: '117',
      icon_url: '',
    },
  }

  it('renders default stats without highlight when no agentId or highlightProps is provided', () => {
    const html = renderToString(<AgentStatsPanel uiStats={mockUIStats} specialty="Attack" />)

    expect(html).toContain('HP')
    expect(html).toContain('10558')
    expect(html).toContain('ATK')
    expect(html).toContain('3280')

    // None of the stat labels should have amber text
    expect(html).not.toContain('text-amber-400 font-semibold')
  })

  it('highlights recommended stats for Ellen (ATK, CRIT Rate, CRIT DMG) in amber', () => {
    // Ellen: highlightProps [12101, 20101, 21101]
    const html = renderToString(
      <AgentStatsPanel
        uiStats={mockUIStats}
        specialty="Attack"
        agentId={1011}
        highlightProps={[12101, 20101, 21101]}
      />
    )

    // Recommended stats must be styled with amber text
    expect(html).toMatch(/<span[^>]*class="[^"]*text-amber-400 font-semibold[^"]*"[^>]*>ATK<\/span>/)
    expect(html).toMatch(/<span[^>]*class="[^"]*text-amber-400 font-semibold[^"]*"[^>]*>CRIT Rate<\/span>/)
    expect(html).toMatch(/<span[^>]*class="[^"]*text-amber-400 font-semibold[^"]*"[^>]*>CRIT DMG<\/span>/)

    // Non-recommended stats (HP, DEF, Impact) must NOT be amber
    expect(html).not.toMatch(/<span[^>]*class="[^"]*text-amber-400 font-semibold[^"]*"[^>]*>HP<\/span>/)
    expect(html).not.toMatch(/<span[^>]*class="[^"]*text-amber-400 font-semibold[^"]*"[^>]*>DEF<\/span>/)
    expect(html).not.toMatch(/<span[^>]*class="[^"]*text-amber-400 font-semibold[^"]*"[^>]*>Impact<\/span>/)
  })

  it('highlights recommended stats for Anomaly agent (ATK, Anomaly Proficiency)', () => {
    // Remielle / Anomaly: highlightProps [12101, 31201]
    const html = renderToString(
      <AgentStatsPanel
        uiStats={mockUIStats}
        specialty="Anomaly"
        agentId={1581}
        highlightProps={[12101, 31201]}
      />
    )

    expect(html).toMatch(/<span[^>]*class="[^"]*text-amber-400 font-semibold[^"]*"[^>]*>ATK<\/span>/)
    expect(html).toMatch(/<span[^>]*class="[^"]*text-amber-400 font-semibold[^"]*"[^>]*>Anomaly Proficiency<\/span>/)

    // CRIT stats are not recommended for Remielle
    expect(html).not.toMatch(/<span[^>]*class="[^"]*text-amber-400 font-semibold[^"]*"[^>]*>CRIT Rate<\/span>/)
    expect(html).not.toMatch(/<span[^>]*class="[^"]*text-amber-400 font-semibold[^"]*"[^>]*>CRIT DMG<\/span>/)
  })

  it('renders only the first four rows in compact mode', () => {
    const html = renderToString(
      <AgentStatsPanel uiStats={mockUIStats} specialty="Attack" compact />,
    )

    expect(html).toContain('gear.keyStatsTitle')
    expect(html).toContain('HP')
    expect(html).toContain('ATK')
    expect(html).toContain('DEF')
    expect(html).toContain('Impact')
    expect(html).not.toContain('CRIT Rate')
  })

  it('renders empty fallback when uiStats is empty or null', () => {
    const html = renderToString(<AgentStatsPanel uiStats={null} specialty="Attack" />)
    expect(html).toContain('gear.noStats')
  })
})
