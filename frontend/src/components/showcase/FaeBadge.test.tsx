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
        'fae.liveStatus': 'Leaderboard rating matches the gear in your showcase',
        'fae.savedRating': 'Saved rating',
        'fae.outdatedStatus': 'Saved on {{date}} — the gear in your showcase has changed',
        'fae.outdatedStatusNoDate': 'The gear in your showcase has changed since this rating was saved',
        'fae.unassessedHint': 'Not yet assessed on zfae.net leaderboards',
        'fae.openProfile': 'Open profile on zfae.net',
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

  it('resolves loading state when isLoading is true', () => {
    const state = resolveFaeBadgeState(true, liveRating, '1500000000', true)
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

  it('resolves live state for ranked live rating', () => {
    const state = resolveFaeBadgeState(false, liveRating, '1500000000', true)
    expect(state.kind).toBe('live')
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

  it('renders unassessed badge when showUnassessed is true', () => {
    const html = renderToString(<FaeBadge rating={null} showUnassessed />)
    expect(html).toContain('data-testid="fae-badge-unassessed"')
    expect(html).toContain('FAE')
    expect(html).toContain('Unassessed')
  })

  it('renders live badge with correct score, rank, percentile, and profile link', () => {
    const html = renderToString(
      <FaeBadge rating={liveRating} uid="1503562965" showUnassessed />,
    )
    expect(html).toContain('data-testid="fae-badge-live"')
    expect(html).toContain('aria-haspopup="dialog"')
    expect(html).toContain('FAE')
    expect(html).toContain('Top 0.04%')
    expect(html).toContain('#14')
  })

  it('renders tooltip content with rating, version, and breakdown', () => {
    const html = renderToString(
      <FaeTooltipContent rating={liveRating} isOutdated={false} dateStr={null} />,
    )
    expect(html).toContain('data-testid="fae-tooltip-content"')
    expect(html).not.toContain('S Rank Limited W-Engines')
    expect(html).toContain('V1')
    expect(html).toContain('Leaderboard rating matches the gear in your showcase')
    expect(html).not.toContain('Saved rating')
    expect(html).toContain('100%')
    expect(html).toContain('95%')
    expect(html).toContain('90%')
    expect(html).toContain('85%')
  })

  it('shows a saved rating warning with a date when available', () => {
    const dated = renderToString(<FaeTooltipContent rating={liveRating} isOutdated dateStr="11/2/2026" />)
    expect(dated).toContain('Saved rating')
    expect(dated).toContain('Saved on 11/2/2026')
    const undated = renderToString(<FaeTooltipContent rating={liveRating} isOutdated dateStr={null} />)
    expect(undated).toContain('changed since this rating was saved')
  })

  it('falls back to leaderboard URL when uid is missing', () => {
    expect(getZfaeUrl(undefined, liveRating.slug)).toBe('https://zfae.net/leaderboard/claret')
  })

  it('renders snapshot_outdated badge with outdated styling', () => {
    const outdatedRating: FaeRating = {
      ...liveRating,
      status: 'snapshot_outdated',
      outdated: true,
    }
    const html = renderToString(
      <FaeBadge rating={outdatedRating} uid="1503562965" showUnassessed />,
    )
    expect(html).toContain('data-testid="fae-badge-outdated"')
    expect(html).toContain('lucide-clock')
    expect(html).toContain('FAE')
    expect(html).toContain('#14')
  })
})
