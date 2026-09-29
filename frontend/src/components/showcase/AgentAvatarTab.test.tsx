import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { AgentAvatarTab } from './AgentAvatarTab'
import type { Agent } from '@/types'

// Mock react-i18next so t() returns key or formatted text without warning
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      options?.count !== undefined ? `${key}:${options.count}` : key,
  }),
}))

const dummyAgent: Agent = {
  id: 1011,
  name: 'Anby Demara',
  level: 60,
  promotion: 5,
  mindscape_cinema: 2,
  core_skill_enhancement: 6,
  attribute: 'Electric',
  attribute_name: 'Electric',
  specialty: 'Stun',
  specialty_name: 'Stun',
  rarity: 'A',
  skin: null,
  splash_art_url: 'https://example.com/anby.png',
  w_engine: null,
  drive_discs: { slots: [], set_bonuses: [] },
  skills: [],
  stats: {
    hp: 8000,
    atk: 1200,
    def: 500,
    impact: 120,
    crit_rate: 0.05,
    crit_dmg: 0.5,
    attribute_dmg_bonus: 0,
    anomaly_mastery: 90,
    anomaly_proficiency: 90,
    pen_ratio: 0,
    pen_flat: 0,
    energy_regen: 1.2,
    sheer_force: 0,
  },
}

const accessibleName = (html: string) => html.match(/aria-label="([^"]*)"/)?.[1] ?? ''

describe('AgentAvatarTab component', () => {
  it('renders correctly in Showcase mode with full Agent object and mindscape cinema', () => {
    const html = renderToString(
      <AgentAvatarTab agent={dummyAgent} selected={true} onSelect={() => {}} />
    )

    // Contains role="tab" and aria-selected="true"
    expect(html).toContain('role="tab"')
    expect(html).toContain('aria-selected="true"')

    // Contains selected border and glow classes
    expect(html).toContain('border-primary')
    expect(html).toContain('ring-2 ring-primary/70')

    // Contains Mindscape Cinema badge (M2)
    expect(html).toContain('data-testid="mindscape-badge"')
    expect(html).toContain('M2')

    // WCAG 2.5.3: the badge renders visible text inside the button, so the
    // accessible name has to contain it. An aria-label of just the agent name
    // would hide both the badge and the rank from screen readers.
    const name = accessibleName(html)
    expect(name).toContain('Anby Demara')
    expect(name).toContain('M2')
  })

  it('renders correctly in Roster mode with buildsCount badge', () => {
    const html = renderToString(
      <AgentAvatarTab
        agentId={1011}
        agentName="Anby Demara"
        buildsCount={3}
        selected={false}
        onSelect={() => {}}
      />
    )

    expect(html).toContain('aria-selected="false"')

    // Contains builds count badge with 3
    expect(html).toContain('data-testid="builds-count-badge"')
    expect(html).toContain('<span>3</span>')

    // Does not render mindscape badge when in builds count mode
    expect(html).not.toContain('data-testid="mindscape-badge"')

    // The build count is visible text, so it must appear in the accessible name.
    const name = accessibleName(html)
    expect(name).toContain('Anby Demara')
    expect(name).toContain('3')
  })

  it('names the tab with the agent name alone when no badge is rendered', () => {
    const html = renderToString(
      <AgentAvatarTab
        agentId={1011}
        agentName="Anby Demara"
        buildsCount={1}
        onSelect={() => {}}
      />
    )

    expect(html).not.toContain('data-testid="builds-count-badge"')
    expect(html).not.toContain('data-testid="mindscape-badge"')
    expect(accessibleName(html)).toBe('Anby Demara')
  })

  it('renders fallback initials when iconUrl is not provided', () => {
    const agentWithoutArt: Agent = {
      ...dummyAgent,
      id: 999999,
      name: 'Nicole Demara',
      splash_art_url: '',
    }

    const html = renderToString(
      <AgentAvatarTab agent={agentWithoutArt} onSelect={() => {}} />
    )

    // First two letters of Nicole
    expect(html).toContain('Ni')
  })

  it('applies unselected styles with hover and active scaling', () => {
    const html = renderToString(
      <AgentAvatarTab agent={dummyAgent} selected={false} onSelect={() => {}} />
    )

    expect(html).toContain('opacity-75')
    expect(html).toContain('hover:scale-105')
    expect(html).toContain('active:scale-95')
  })
})
