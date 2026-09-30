import type { SlotNumber } from '@/store/useTeamDraftStore'
import type { Build, ConflictCode, ConflictReport } from '@/types'

import i18n from '@/i18n'

export const CONFLICT_LABELS_RU: Record<ConflictCode, string> = {
  DUPLICATE_AGENT: 'Дубликат агента в отряде',
  ITEM_REUSE: 'Драйв-диск занят в двух сборках',
  WEAPON_REUSE: 'Амплификатор занят в двух сборках',
  ACCOUNT_MISMATCH: 'Агенты с разных аккаунтов Прокси',
}

export const CONFLICT_LABELS_EN: Record<ConflictCode, string> = {
  DUPLICATE_AGENT: 'Duplicate agent in squad',
  ITEM_REUSE: 'Drive Disc used in two builds',
  WEAPON_REUSE: 'W-Engine used in two builds',
  ACCOUNT_MISMATCH: 'Agents from different Proxy accounts',
}

export function getConflictLabel(code: ConflictCode): string {
  if (i18n.isInitialized) {
    const translated = i18n.t(`conflicts.${code}`)
    if (translated) return translated
  }
  const lang = i18n.language === 'en' ? 'en' : 'ru'
  const dict = lang === 'en' ? CONFLICT_LABELS_EN : CONFLICT_LABELS_RU
  return dict[code] ?? code
}


export function getConflictBuildNames(
  slots: readonly (Build | null)[],
): Map<string, string> {
  const names = new Map<string, string>()
  for (const build of slots) {
    if (build) {
      names.set(build.id, build.name)
      names.set(build.name, build.name)
    }
  }
  return names
}

export function resolveConflictingBuildNames(
  refs: readonly string[],
  slots: readonly (Build | null)[],
): string[] {
  const names = getConflictBuildNames(slots)
  const resolved = refs.map((ref) => names.get(ref) ?? ref)
  return [...new Set(resolved)]
}

export interface SlotConflictDetail {
  codes: ConflictCode[]
  hasWeaponConflict: boolean
  conflictingDiscSlots: number[]
  conflictingDiscUIDs: string[]
}

export function getDetailedSlotConflicts(
  report: ConflictReport | null,
  slots: readonly (Build | null)[],
): Record<SlotNumber, SlotConflictDetail> {
  const result: Record<SlotNumber, SlotConflictDetail> = {
    1: { codes: [], hasWeaponConflict: false, conflictingDiscSlots: [], conflictingDiscUIDs: [] },
    2: { codes: [], hasWeaponConflict: false, conflictingDiscSlots: [], conflictingDiscUIDs: [] },
    3: { codes: [], hasWeaponConflict: false, conflictingDiscSlots: [], conflictingDiscUIDs: [] },
  }
  if (!report || report.errors.length === 0) return result

  const buildIdToSlot = new Map<string, SlotNumber>()
  const buildNameToSlot = new Map<string, SlotNumber>()
  slots.forEach((build, index) => {
    if (!build) return
    const slot = (index + 1) as SlotNumber
    buildIdToSlot.set(build.id, slot)
    buildNameToSlot.set(build.name, slot)
  })

  for (const error of report.errors) {
    const affected = new Set<SlotNumber>()
    if (error.agent_id) {
      slots.forEach((build, index) => {
        if (build?.agent_id === error.agent_id) affected.add((index + 1) as SlotNumber)
      })
    }
    for (const ref of error.conflicting_builds ?? []) {
      const slot = buildIdToSlot.get(ref) ?? buildNameToSlot.get(ref)
      if (slot) affected.add(slot)
    }

    for (const slot of affected) {
      const detail = result[slot]
      if (!detail.codes.includes(error.code)) {
        detail.codes.push(error.code)
      }

      if (error.code === 'WEAPON_REUSE') {
        detail.hasWeaponConflict = true
      }

      if (error.code === 'ITEM_REUSE') {
        if (error.item_uid && !detail.conflictingDiscUIDs.includes(error.item_uid)) {
          detail.conflictingDiscUIDs.push(error.item_uid)
        }
        let discSlot = error.slot ?? 0
        if (!discSlot && error.item_uid) {
          const build = slots[slot - 1]
          const disc = build?.build_data?.drive_discs?.slots?.find((d) => d.uid === error.item_uid)
          if (disc) discSlot = disc.slot
        }
        if (discSlot > 0 && !detail.conflictingDiscSlots.includes(discSlot)) {
          detail.conflictingDiscSlots.push(discSlot)
          detail.conflictingDiscSlots.sort((a, b) => a - b)
        }
      }
    }
  }

  return result
}

export function getSlotConflicts(
  report: ConflictReport | null,
  slots: readonly (Build | null)[],
): Record<SlotNumber, ConflictCode[]> {
  const detailed = getDetailedSlotConflicts(report, slots)
  return {
    1: detailed[1].codes,
    2: detailed[2].codes,
    3: detailed[3].codes,
  }
}

export interface ConflictingDiscMeta {
  slot: number
  setName?: string
  iconUrl?: string
}

export function getConflictingDiscMeta(
  error: { code: ConflictCode; item_uid?: string; slot?: number },
  slots: readonly (Build | null)[],
): ConflictingDiscMeta | null {
  if (error.code !== 'ITEM_REUSE') return null
  const slot = error.slot ?? 0
  const uid = error.item_uid

  for (const build of slots) {
    if (!build) continue
    const discs = build.build_data?.drive_discs?.slots ?? []
    const matching = discs.find((d) => (uid && d.uid === uid) || (slot > 0 && d.slot === slot))
    if (matching) {
      return {
        slot: matching.slot,
        setName: matching.set?.name,
        iconUrl: matching.icon_path,
      }
    }
  }

  if (slot > 0) {
    return { slot }
  }
  return null
}

export function formatConflictMessage(
  error: { code: ConflictCode; message: string; item_uid?: string; slot?: number },
  slots: readonly (Build | null)[],
  t?: (key: any, options?: any) => string,
): string {
  const translate = t ?? ((key: string, opts?: any) => (i18n.isInitialized ? i18n.t(key, opts) : key))

  if (error.code === 'ITEM_REUSE') {
    const discMeta = getConflictingDiscMeta(error, slots)
    if (discMeta?.setName && discMeta.slot) {
      return translate('conflicts.discReuseNamed', {
        setName: discMeta.setName,
        slot: discMeta.slot,
      })
    }
    if (discMeta?.slot) {
      return translate('conflicts.discReuseSlot', { slot: discMeta.slot })
    }
    return translate('conflicts.ITEM_REUSE')
  }

  if (error.code === 'WEAPON_REUSE') {
    return translate('conflicts.WEAPON_REUSE')
  }

  if (error.code === 'ACCOUNT_MISMATCH') {
    return translate('conflicts.ACCOUNT_MISMATCH')
  }

  if (error.code === 'DUPLICATE_AGENT') {
    return translate('conflicts.DUPLICATE_AGENT')
  }

  return error.message
}

export type BuildPickerConflictType =
  | 'IN_SQUAD'
  | 'DUPLICATE_AGENT'
  | 'WEAPON_REUSE'
  | 'ITEM_REUSE'
  | 'ACCOUNT_MISMATCH'

export interface BuildPickerConflict {
  type: BuildPickerConflictType
  conflictingBuild: Build
  discSlot?: number
  discSetName?: string
}

/**
 * Checks whether a candidate build conflicts with any build already present in other team slots.
 * Returns the conflict details or null if the candidate build can be safely selected.
 */
export function getBuildPickerConflict(
  candidate: Build,
  otherSquadBuilds: readonly (Build | null | undefined)[],
): BuildPickerConflict | null {
  const activeBuilds = otherSquadBuilds.filter((b): b is Build => Boolean(b))

  for (const other of activeBuilds) {
    // 1. Exact same build is already in another slot
    if (candidate.id === other.id) {
      return { type: 'IN_SQUAD', conflictingBuild: other }
    }

    // 2. Different game account
    if (
      candidate.game_account_id &&
      other.game_account_id &&
      candidate.game_account_id !== other.game_account_id
    ) {
      return { type: 'ACCOUNT_MISMATCH', conflictingBuild: other }
    }

    // 3. Duplicate agent character in the squad (BR-04)
    if (candidate.agent_id === other.agent_id) {
      return { type: 'DUPLICATE_AGENT', conflictingBuild: other }
    }

    // 4. Same W-Engine UID equipped (BR-05)
    const candidateWeaponUid =
      candidate.weapon_uid ?? candidate.build_data?.w_engine?.uid ?? null
    const otherWeaponUid =
      other.weapon_uid ?? other.build_data?.w_engine?.uid ?? null
    if (candidateWeaponUid && otherWeaponUid && candidateWeaponUid === otherWeaponUid) {
      return { type: 'WEAPON_REUSE', conflictingBuild: other }
    }

    // 5. Drive Disc UID reuse (BR-05)
    const candidateDiscs = candidate.build_data?.drive_discs?.slots ?? []
    const otherDiscs = other.build_data?.drive_discs?.slots ?? []

    const otherDiscUids = new Set<string>()
    for (const uid of other.disc_uids ?? []) {
      if (uid) otherDiscUids.add(uid)
    }
    for (const d of otherDiscs) {
      if (d.uid) otherDiscUids.add(d.uid)
    }

    if (otherDiscUids.size > 0) {
      for (const d of candidateDiscs) {
        if (d.uid && otherDiscUids.has(d.uid)) {
          return {
            type: 'ITEM_REUSE',
            conflictingBuild: other,
            discSlot: d.slot,
            discSetName: d.set?.name,
          }
        }
      }

      for (const uid of candidate.disc_uids ?? []) {
        if (uid && otherDiscUids.has(uid)) {
          const matchingDisc = candidateDiscs.find((d) => d.uid === uid)
          return {
            type: 'ITEM_REUSE',
            conflictingBuild: other,
            discSlot: matchingDisc?.slot,
            discSetName: matchingDisc?.set?.name,
          }
        }
      }
    }
  }

  return null
}
