import type { Agent, Build, DriveDiscs, StatValue } from '@/types'

export interface BuildGroup {
  agentId: number
  agentName: string
  builds: Build[]
}

export function groupByAgent(builds: Build[]): BuildGroup[] {
  const map = new Map<number, Build[]>()
  for (const build of builds) {
    const existing = map.get(build.agent_id)
    if (existing) {
      existing.push(build)
    } else {
      map.set(build.agent_id, [build])
    }
  }
  return [...map.entries()]
    .map(([agentId, items]) => {
      const name = items[0]?.agent_name || `Agent ${agentId}`
      return {
        agentId,
        agentName: name,
        builds: [...items].sort(
          (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        ),
      }
    })
    .sort((a, b) => a.agentName.localeCompare(b.agentName))
}

/**
 * Aggregates and sums sub-stat values and roll counts across all equipped drive discs,
 * sorting by descending roll count.
 * Based on agent.DriveDiscs.SubStatTotals() logic from fairy SDK.
 */
export function calculateSubStatTotals(driveDiscs?: DriveDiscs | null): StatValue[] {
  if (!driveDiscs || !driveDiscs.slots) return []

  const totals = new Map<number, StatValue>()
  const order: number[] = []

  for (const disc of driveDiscs.slots) {
    if (!disc.sub_stats) continue
    for (const sub of disc.sub_stats) {
      const existing = totals.get(sub.property_id)
      if (existing) {
        totals.set(sub.property_id, {
          ...existing,
          value: existing.value + sub.value,
          rolls: existing.rolls + sub.rolls,
        })
      } else {
        totals.set(sub.property_id, { ...sub })
        order.push(sub.property_id)
      }
    }
  }

  return order
    .map((id) => totals.get(id)!)
    .filter(Boolean)
    .sort((a, b) => b.rolls - a.rolls)
}

/**
 * Computes a deterministic fingerprint of an agent's equipment and progression.
 * Used to immediately verify if the current build configuration is already saved
 * or if the player modified discs, weapon, or stats.
 */
export function getAgentEquipmentFingerprint(agent: Agent | null | undefined): string {
  if (!agent) return ''

  // 1. Weapon (W-Engine)
  const weaponPart = agent.w_engine
    ? `w:${agent.w_engine.uid || agent.w_engine.id}:${agent.w_engine.level}:${agent.w_engine.modification ?? agent.w_engine.phase ?? 0}`
    : 'w:none'

  // 2. Drive Discs (Slots 1..6)
  const discSlots = (agent.drive_discs?.slots ?? [])
    .slice()
    .sort((a, b) => a.slot - b.slot)
    .map((disc) => {
      const subRolls = (disc.sub_stats ?? [])
        .slice()
        .sort((a, b) => a.property_id - b.property_id)
        .map((s) => `${s.property_id}:${s.rolls}`)
        .join(',')
      return `s${disc.slot}:${disc.uid || disc.id}:${disc.level}:[${subRolls}]`
    })
    .join('|')

  // 3. Agent progression (level, promotion, cinema, core skill)
  const agentProgression = `lvl:${agent.level}:${agent.promotion ?? 0}:${agent.mindscape_cinema ?? 0}:${agent.core_skill_enhancement ?? 0}`

  return `${agent.id}#${agentProgression}#${weaponPart}#${discSlots}`
}

/**
 * Finds a saved build matching the agent's exact equipment and progression.
 */
export function findMatchingSavedBuild(
  agent: Agent | null | undefined,
  builds: Build[],
): Build | null {
  if (!agent || builds.length === 0) return null
  const targetFingerprint = getAgentEquipmentFingerprint(agent)
  if (!targetFingerprint) return null

  for (const build of builds) {
    if (build.agent_id !== agent.id) continue
    if (getAgentEquipmentFingerprint(build.build_data) === targetFingerprint) {
      return build
    }
  }

  return null
}


