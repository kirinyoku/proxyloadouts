import type { FaeRating } from '@/types'

export type FaeBadgeState =
  | { kind: 'loading' }
  | { kind: 'snapshot'; rating: FaeRating; uid?: string }
  | { kind: 'snapshot_outdated'; rating: FaeRating; uid?: string }
  | { kind: 'unassessed'; showUnassessed?: boolean }

export function resolveFaeBadgeState(
  isLoading: boolean | undefined,
  rating: FaeRating | null | undefined,
  uid: string | undefined,
  showUnassessed: boolean | undefined,
): FaeBadgeState {
  if (isLoading && !rating) {
    return { kind: 'loading' }
  }
  if (!rating || rating.status === 'unassessed' || rating.rank == null) {
    return { kind: 'unassessed', showUnassessed }
  }
  if (rating.status === 'snapshot_outdated' || rating.outdated) {
    return { kind: 'snapshot_outdated', rating, uid }
  }
  return { kind: 'snapshot', rating, uid }
}

export function formatFaePercentile(topPercentile: number): string {
  const pct = 100 * topPercentile
  const decimals = pct < 1 ? 2 : pct < 10 ? 1 : 0
  return `${Number(pct.toFixed(decimals))}%`
}

export interface FaeRankParts {
  rank: string
  total: string | null
}

export function formatFaeRankParts(rank: number, rankOf?: number): FaeRankParts {
  const formattedRank = `#${new Intl.NumberFormat().format(rank)}`
  if (rankOf != null && rankOf > 0) {
    return {
      rank: formattedRank,
      total: new Intl.NumberFormat().format(rankOf),
    }
  }
  return { rank: formattedRank, total: null }
}

export function formatFaeRank(rank: number, rankOf?: number): string {
  const parts = formatFaeRankParts(rank, rankOf)
  return parts.total ? `${parts.rank} / ${parts.total}` : parts.rank
}

export function getZfaeUrl(uid?: string, slug?: string): string {
  if (uid && slug) {
    return `https://zfae.net/profile/${encodeURIComponent(uid)}/${encodeURIComponent(slug)}`
  }
  if (slug) {
    return `https://zfae.net/leaderboard/${encodeURIComponent(slug)}`
  }
  if (uid) {
    return `https://zfae.net/profile/${encodeURIComponent(uid)}`
  }
  return 'https://zfae.net'
}
