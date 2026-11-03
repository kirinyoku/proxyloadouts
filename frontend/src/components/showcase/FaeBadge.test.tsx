import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import {
  FaeBadge,
  FaeTooltipContent,
} from './FaeBadge'
import {
  getZfaeUrl,
  formatFaePercentile,
  formatFaeRank,
  formatFaeRankParts,
  resolveFaeBadgeState,
} from '@/lib/fae'
import type { FaeRating } from '@/types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { date?: string }) => {
      const dict: Record<string, string> = {
        'fae.rankLabel': 'Rank',
        'fae.scoreLabel': 'Score',
        'fae.topPrefix': 'Top',
        'fae.unassessed': 'Unassessed',
        'fae.observedAt': 'Rating observed on {{date}}',
        'fae.observedUnknown': 'Evaluation date unavailable.',
        'fae.ratingInfoTitle': 'About this rating',
        'fae.ratingInfoDescription': 'This rating reflects the build at the time of evaluation and may not be up to date due to leaderboard shifts. To get the latest version, click the refresh button next to the rating.',
        'fae.outdatedRatingTitle': 'Outdated rating',
        'fae.outdatedRatingDescription': 'To update the rating, equip this build in game and rescan the agent on the Showcase page.',
        'fae.outdatedRating': 'Outdated',
        'fae.howToUpdate': 'How to update',
        'fae.updateGuideEquip': 'In game, equip the agent with this build and place them on your profile showcase.',
        'fae.updateGuideRefreshBefore': 'On the Showcase page, refresh your profile, then click',
        'fae.updateGuideRefreshAfter': 'next to the FAE rating.',
        'fae.refreshRating': 'Refresh FAE rating',
        'fae.updateGuideOpenShowcase': 'Go to Showcase',
        'fae.openBuild': 'Open build on zfae.net',
        'fae.weaponChoice': 'W-Engine choice',
        'fae.discSets': 'Drive Disc sets',
        'fae.mainstats': 'Main stats',
        'fae.substats': 'Substats',
      }
      if (options?.date !== undefined) {
        return (dict[key] ?? key).replace('{{date}}', options.date)
      }
      return dict[key] ?? key
    },
  }),
}))

describe('formatFaePercentile', () => {
  it('formats less than 1% with 2 decimal places', () => {
    expect(formatFaePercentile(0.00038)).toBe('0.04%')
    expect(formatFaePercentile(0.005)).toBe('0.5%')
  })

  it('formats less than 10% with 1 decimal place', () => {
    expect(formatFaePercentile(0.054)).toBe('5.4%')
    expect(formatFaePercentile(0.09)).toBe('9%')
  })

  it('formats 10% or more with 0 decimal places', () => {
    expect(formatFaePercentile(0.25)).toBe('25%')
    expect(formatFaePercentile(0.5)).toBe('50%')
  })
})

describe('formatFaeRank', () => {
  it('formats rank and total with thousand separators', () => {
    expect(formatFaeRank(14, 41147)).toBe('#14 / 41,147')
  })

  it('formats rank alone when total is missing', () => {
    expect(formatFaeRank(5)).toBe('#5')
  })
})

describe('formatFaeRankParts', () => {
  it('formats rank and total with thousand separators', () => {
    expect(formatFaeRankParts(14, 41147)).toEqual({ rank: '#14', total: '41,147' })
  })

  it('formats rank alone when total is missing or zero', () => {
    expect(formatFaeRankParts(5)).toEqual({ rank: '#5', total: null })
    expect(formatFaeRankParts(5, 0)).toEqual({ rank: '#5', total: null })
  })
})

describe('resolveFaeBadgeState', () => {
  const liveRating: FaeRating = {
    status: 'live',
    outdated: false,
    rank: 14,
    rank_of: 41147,
    top_percentile: 0.00038,
    score: 82.6,
    slug: 'claret',
  }

  it('resolves loading state when no previous rating exists', () => {
    const state = resolveFaeBadgeState(true, null, '1500000000', true)
    expect(state.kind).toBe('loading')
  })

  it('resolves unassessed state when rating is null or unassessed', () => {
    const state1 = resolveFaeBadgeState(false, null, '1500000000', true)
    expect(state1.kind).toBe('unassessed')

    const state2 = resolveFaeBadgeState(false, { status: 'unassessed', outdated: false }, '1500000000', false)
    expect(state2.kind).toBe('unassessed')
  })

  it('resolves snapshot_outdated state when status is snapshot_outdated or outdated is true', () => {
    const state = resolveFaeBadgeState(false, { ...liveRating, status: 'snapshot_outdated', outdated: true }, '1500000000', true)
    expect(state.kind).toBe('snapshot_outdated')
  })

  it('treats legacy live ratings as saved observations', () => {
    const state = resolveFaeBadgeState(false, liveRating, '1500000000', true)
    expect(state.kind).toBe('snapshot')
  })
})

describe('FaeBadge rendering', () => {
  const liveRating: FaeRating = {
    status: 'live',
    outdated: false,
    rank: 14,
    rank_of: 41147,
    top_percentile: 0.00038,
    score: 82.6,
    time_assessed: 1793393915,
    slug: 'claret',
    bracket_name: 'S Rank Limited W-Engines',
    breakdown: {
      weapon_percent: 100,
      disc_set_percent: 95,
      mainstat_percent: 90,
      substat_percent: 85,
    },
  }

  it('renders loading skeleton', () => {
    const html = renderToString(<FaeBadge isLoading />)
    expect(html).toContain('data-testid="fae-badge-loading"')
  })

  it('renders nothing when unassessed and showUnassessed is false', () => {
    const html = renderToString(<FaeBadge rating={null} showUnassessed={false} />)
    expect(html).toBe('')
  })

  it('renders an unassessed button that opens a dialog when showUnassessed is true', () => {
    const html = renderToString(<FaeBadge rating={null} showUnassessed />)
    expect(html).toMatch(/<button[^>]*data-testid="fae-badge-unassessed"[^>]*>/)
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('FAE')
    expect(html).toContain('Unassessed')
    expect(html).not.toContain('lucide-chevron-right')
  })

  it('renders live badge with correct score, rank, percentile, and profile link', () => {
    const html = renderToString(
      <FaeBadge rating={liveRating} uid="1503562965" showUnassessed />,
    )
    expect(html).toContain('data-testid="fae-badge-snapshot"')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('FAE')
    expect(html).toContain('Top 0.04%')
    expect(html).not.toContain('Outdated')
    expect(html).toContain('#14')
    expect(html).not.toContain('lucide-chevron-right')
  })

  it('renders tooltip content with rating, version, and breakdown', () => {
    const html = renderToString(
      <FaeTooltipContent rating={liveRating} dateStr={null} />,
    )
    expect(html).toContain('data-testid="fae-tooltip-content"')
    expect(html).not.toContain('S Rank Limited W-Engines')
    expect(html).toContain('V1')
    expect(html).toContain('Evaluation date unavailable.')
    expect(html).toContain('100%')
    expect(html).toContain('95%')
    expect(html).toContain('90%')
    expect(html).toContain('85%')
  })

  it.each(['11/2/2026', null])('shows current rating information with date %s', (dateStr) => {
    const html = renderToString(<FaeTooltipContent rating={liveRating} dateStr={dateStr} />)
    expect(html).toContain('About this rating')
    expect(html).toContain('This rating reflects the build at the time of evaluation and may not be up to date due to leaderboard shifts. To get the latest version, click the refresh button next to the rating.')
    expect(html).not.toContain('Outdated rating')
    expect(html).not.toContain('To update the rating')
    expect(html).not.toContain('<details')
    expect(html).not.toContain('How to update')
    expect(html).not.toContain('Go to Showcase')
    expect(html).toContain(dateStr ? `Rating observed on ${dateStr}` : 'Evaluation date unavailable.')
    expect(html).not.toContain('Saved rating')
    expect(html).not.toContain('lucide-history')
    expect(html).not.toContain('lucide-clock')
  })

  it.each([
    { status: 'snapshot_outdated', outdated: false },
    { status: 'snapshot', outdated: true },
  ] satisfies Pick<FaeRating, 'status' | 'outdated'>[])(
    'explains outdated rating for $status with outdated=$outdated regardless of date',
    (outdatedState) => {
      for (const dateStr of ['11/2/2026', null]) {
        const html = renderToString(
          <FaeTooltipContent rating={{ ...liveRating, ...outdatedState }} dateStr={dateStr} />,
        )
        expect(html).toContain('Outdated rating')
        expect(html).toContain('To update the rating, equip this build in game and rescan the agent on the Showcase page.')
        expect(html).not.toContain('About this rating')
        expect(html).not.toContain('This rating reflects the build at the time of evaluation and may not be up to date due to leaderboard shifts. To get the latest version, click the refresh button next to the rating.')
        expect(html).not.toContain('To get the latest version, click the refresh button next to the rating.')
        expect(html).toContain(dateStr ? `Rating observed on ${dateStr}` : 'Evaluation date unavailable.')
        expect(html).not.toContain('Saved rating')
        expect(html).not.toContain('lucide-history')
        expect(html).not.toContain('lucide-clock')
      }
    },
  )

  it.each([
    { uid: '1500 /?', href: '/showcase?uid=1500%20%2F%3F' },
    { uid: undefined, href: '/showcase' },
  ])('provides a closed native update guide linking to $href', ({ uid, href }) => {
    const html = renderToString(
      <FaeTooltipContent
        rating={{ ...liveRating, status: 'snapshot_outdated', outdated: true }}
        dateStr="11/2/2026"
        uid={uid}
      />,
    )
    const details = html.match(/<details\b[^>]*>[\s\S]*?<\/details>/)?.[0]
    expect(details).toBeDefined()
    expect(details).not.toMatch(/<details\b[^>]*\bopen(?:=|\s|>)/)
    expect(details).toMatch(/<summary\b[^>]*>[\s\S]*?How to update<\/summary>/)
    expect(details?.match(/<li\b/g)).toHaveLength(2)
    expect(details).toContain('In game, equip the agent with this build and place them on your profile showcase.')
    expect(details).toContain('On the Showcase page, refresh your profile, then click')
    expect(details).toContain('next to the FAE rating.')
    expect(details).toMatch(/<span role="img" aria-label="Refresh FAE rating"[^>]*><svg[^>]*aria-hidden="true"/)
    expect(details).not.toContain('<button')
    expect(details).toContain(`href="${href}"`)
    expect(details).toContain('Go to Showcase')
    expect(html.indexOf('</details>')).toBeLessThan(html.indexOf('Rating observed on 11/2/2026'))
  })

  it('keeps the previous numeric badge visible during refresh', () => {
    const html = renderToString(<FaeBadge rating={liveRating} isLoading />)
    expect(html).toContain('#14')
    expect(html).not.toContain('fae-badge-loading')
  })

  it('falls back to leaderboard URL when uid is missing', () => {
    expect(getZfaeUrl(undefined, liveRating.slug)).toBe('https://zfae.net/leaderboard/claret')
  })

  it('renders snapshot_outdated badge with a visible outdated rating caption', () => {
    const outdatedRating: FaeRating = {
      ...liveRating,
      status: 'snapshot_outdated',
      outdated: true,
    }
    const html = renderToString(
      <FaeBadge rating={outdatedRating} uid="1503562965" showUnassessed />,
    )
    expect(html).toContain('data-testid="fae-badge-outdated"')
    expect(html).not.toContain('lucide-rotate-ccw-clock')
    expect(html).toContain('>Outdated</span>')
    expect(html).not.toContain('<span class="sr-only">Outdated</span>')
    expect(html).toContain('FAE')
    expect(html).toContain('#14')
  })
})
