import { AGENT_HIGHLIGHT_PROPS, AGENT_RECOMMENDED_SUBSTATS } from '@/lib/game-constants.generated'

/**
 * Returns the stat family used to match a drive disc sub-stat against an agent stat.
 *
 * In ZZZ the family is the property ID floored to hundreds:
 * - 111: HP (11101 base, 11102 %, 11103 flat)
 * - 121: ATK (12101 base, 12102 %, 12103 flat)
 * - 131: DEF (13101 base, 13102 %, 13103 flat)
 * - 122: Impact (12201 base, 12202 %, 12203 flat)
 * - 201: CRIT Rate (20101 base, 20103 stat)
 * - 211: CRIT DMG (21101 base, 21103 stat)
 * - 231: PEN Ratio (23101 base, 23102 %, 23103 stat)
 * - 232: Flat PEN (23201 base, 23202 %, 23203 stat)
 * - 312: Anomaly Proficiency (31201 base, 31202 %, 31203 stat)
 * - 314: Anomaly Mastery (31401 base, 31402 %, 31403 stat)
 * - 305: Energy Regen / SpRecover (30501 base, 30502 %, 30503 stat)
 */
export function getPropertyFamily(propertyId: number): number {
  return Math.floor(propertyId / 100)
}

/**
 * Reports whether a combat stat is one of the agent's recommended stats (HighlightProps)
 * taken from the datamine. The game highlights these in yellow on the agent stats screen
 * rendered by AgentStatsPanel.
 *
 * @param propertyId Numeric stat ID (e.g. 12101 for ATK)
 * @param agentId Agent ID (e.g. 1581 for Ramiel)
 * @param highlightProps Optional HighlightProps slice taken from the agent payload
 */
export function isHighlightProp(
  propertyId?: number,
  agentId?: number | string,
  highlightProps?: readonly number[] | null
): boolean {
  if (!propertyId) return false

  const props =
    highlightProps && highlightProps.length > 0
      ? highlightProps
      : agentId
        ? AGENT_HIGHLIGHT_PROPS[Number(agentId)]
        : undefined

  if (!props || props.length === 0) {
    return false
  }

  const targetFamily = getPropertyFamily(propertyId)
  return props.some((hp) => getPropertyFamily(hp) === targetFamily)
}

/**
 * Reports whether a drive disc sub-stat is recommended for the agent in-game.
 * The game highlights these in yellow on the disc card, and they count towards
 * the Active Modifier Count.
 *
 * Follows the strict ZZZ rules:
 * - For families that split flat/% (HP 111, ATK 121, DEF 131, PEN 231) the property ID
 *   must match exactly (e.g. flat ATK 12103 is only highlighted when explicitly listed in
 *   RecommendedSubStats, as it is for Ramiel).
 * - Every other stat (CRIT Rate 201, CRIT DMG 211, Anomaly Proficiency 312) only needs a
 *   family match.
 *
 * @param propertyId Numeric sub-stat ID (e.g. 12102 for ATK%, 12103 for flat ATK)
 * @param agentId Agent ID (e.g. 1511 for Nekomata, 1581 for Ramiel)
 * @param recommendedSubStats Optional RecommendedSubStats slice taken from the agent payload
 */
export function isDiscSubStatRecommended(
  propertyId?: number,
  agentId?: number | string,
  recommendedSubStats?: readonly number[] | null
): boolean {
  if (!propertyId) return false

  const substats =
    recommendedSubStats && recommendedSubStats.length > 0
      ? recommendedSubStats
      : agentId
        ? AGENT_RECOMMENDED_SUBSTATS[Number(agentId)]
        : undefined

  if (!substats || substats.length === 0) {
    return false
  }

  const targetFamily = getPropertyFamily(propertyId)

  for (const rec of substats) {
    const recFamily = getPropertyFamily(rec)
    switch (recFamily) {
      case 111: // HP
      case 121: // ATK
      case 131: // DEF
      case 231: // PEN
        if (rec === propertyId) {
          return true
        }
        break
      default:
        if (rec === propertyId || recFamily === targetFamily) {
          return true
        }
    }
  }

  return false
}

