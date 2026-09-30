import type { Build } from '@/types'

/**
 * Generates a default team name from the assigned agents in the squad,
 * formatted as "Agent1/Agent2/Agent3" (e.g. "Ария/Наньгун Юй/Санна").
 * Skips empty slots and falls back to empty string if no agents are selected.
 */
export function generateTeamName(builds: readonly (Build | null | undefined)[]): string {
  const names = builds
    .filter((b): b is Build => Boolean(b))
    .map((b) => (b.agent_name || b.build_data?.name || '').trim())
    .filter(Boolean)

  const joined = names.join('/')
  return joined.length > 100 ? joined.slice(0, 100) : joined
}
