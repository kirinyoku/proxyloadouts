import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/i18n'
import { BuildShareImage } from './BuildShareImage'
import type { Build, Team, TeamMember } from '@/types'

function createBuild(id: string, name: string): Build {
  return {
    id,
    game_account_id: 'acc-1',
    agent_id: 1021,
    agent_name: 'Alice',
    name,
    description: '',
    weapon_uid: null,
    weapon_id: null,
    disc_uids: [],
    is_public: false,
    created_at: '2026-10-28T19:26:00Z',
    updated_at: '2026-10-28T19:26:00Z',
    build_data: {
      id: 1021,
      name: 'Alice',
      level: 60,
      promotion: 6,
      mindscape_cinema: 0,
      core_skill_enhancement: 0,
      rarity: 'S',
      attribute: 'Physical',
      attribute_name: 'Physical',
      specialty: 'Anomaly',
      specialty_name: 'Anomaly',
      skin: null,
      splash_art_url: '',
      skills: [],
      w_engine: null,
      drive_discs: {
        slots: [],
        set_bonuses: [],
      },
      ui_stats: {
        hp: { property_id: 11101, name: 'HP', total: '11137', base: '7500', added: '3637', icon_url: '' },
      },
    },
  }
}

describe('BuildShareImage', () => {
  it('renders a sharp-cornered opaque build card with bottom-left watermark inside the card', () => {
    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <BuildShareImage subject={{ kind: 'build', build: createBuild('build-1', 'Main') }} />
      </I18nextProvider>,
    )

    expect(html).toContain('data-export-root="true"')
    expect(html).toContain('class="bg-card font-sans text-foreground"')
    expect(html).not.toContain('bg-transparent')
    expect(html).not.toContain('bg-background')
    expect(html).not.toMatch(/<section class="[^"]*rounded/)
    expect(html).toMatch(/<section class="[^"]*\bbg-card p-5\b[^"]*">/)
    expect(html).not.toMatch(/<section class="[^"]*bg-card\/96/)

    const headerEndIdx = html.indexOf('</header>')
    const headerHtml = html.slice(0, headerEndIdx)
    expect(headerHtml).toContain('Alice')
    const capsuleStartIdx = headerHtml.indexOf('rounded-[6px_6px_0_6px]')
    expect(capsuleStartIdx).toBeGreaterThan(-1)
    const capsuleHtml = headerHtml.slice(capsuleStartIdx)
    const levelLabel = i18n.t('gear.level', { level: 60 })
    const levelIdx = capsuleHtml.indexOf(levelLabel)
    const badgeImgIdx = capsuleHtml.indexOf('<img')
    expect(levelIdx).toBeGreaterThan(-1)
    expect(badgeImgIdx).toBeGreaterThan(levelIdx)

    const watermarkIdx = html.indexOf('proxyloadouts.com')
    const sectionCloseIdx = html.indexOf('</section>')
    expect(watermarkIdx).toBeGreaterThan(-1)
    expect(watermarkIdx).toBeLessThan(sectionCloseIdx)

    const footerStart = html.lastIndexOf('<div class="flex items-center', sectionCloseIdx)
    const footerHtml = html.slice(footerStart, sectionCloseIdx)
    const footerWatermarkIdx = footerHtml.indexOf('proxyloadouts.com')
    const footerUpdatedIdx = footerHtml.indexOf('<p ')
    expect(footerWatermarkIdx).toBeGreaterThan(-1)
    expect(footerUpdatedIdx).toBeGreaterThan(footerWatermarkIdx)
  })

  it('wraps the team header in a sharp-cornered opaque card and sorts members by slot_number', () => {
    const team: Team = {
      id: 'team-1',
      game_account_id: 'acc-1',
      name: 'Anomaly Squad',
      description: '',
      is_public: false,
      created_at: '2026-10-28T19:26:00Z',
      updated_at: '2026-10-28T19:26:00Z',
    }
    const members: TeamMember[] = [
      { slot_number: 3, build: createBuild('b-3', 'Third Slot') },
      { slot_number: 1, build: createBuild('b-1', 'First Slot') },
      { slot_number: 2, build: createBuild('b-2', 'Second Slot') },
    ]

    const html = renderToString(
      <I18nextProvider i18n={i18n}>
        <BuildShareImage subject={{ kind: 'team', team, members }} />
      </I18nextProvider>,
    )

    expect(html).toContain('space-y-4 bg-background font-sans text-foreground')
    expect(html).not.toContain('bg-transparent')
    expect(html).not.toMatch(/<header class="[^"]*rounded/)
    expect(html).not.toMatch(/<section class="[^"]*rounded/)
    expect(html).toMatch(/<header class="[^"]*bg-card[^"]*"><h1[^>]*>Anomaly Squad<\/h1><\/header>/)
    const firstIdx = html.indexOf('First Slot')
    const secondIdx = html.indexOf('Second Slot')
    const thirdIdx = html.indexOf('Third Slot')
    expect(firstIdx).toBeGreaterThan(-1)
    expect(secondIdx).toBeGreaterThan(firstIdx)
    expect(thirdIdx).toBeGreaterThan(secondIdx)
  })
})
