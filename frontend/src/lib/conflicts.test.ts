import { describe, expect, it } from 'vitest'
import type { Build, ConflictReport } from '@/types'
import {
  formatConflictMessage,
  getBuildPickerConflict,
  getDetailedBuildPickerConflict,
  getConflictBuildNames,
  getConflictLabel,
  getConflictingDiscMeta,
  getDetailedSlotConflicts,
  getSlotConflicts,
  resolveConflictingBuildNames,
} from './conflicts'
import i18n from '@/i18n'

function createMockBuild(id: string, name: string, agentId: number, discSlots: { slot: number; uid: string; setName?: string }[] = []): Build {
  return {
    id,
    game_account_id: 'acc-1',
    agent_id: agentId,
    agent_name: `Agent ${agentId}`,
    name,
    description: '',
    weapon_uid: null,
    weapon_id: null,
    disc_uids: discSlots.map((d) => d.uid),
    build_data: {
      id: agentId,
      name: `Agent ${agentId}`,
      level: 60,
      drive_discs: {
        slots: discSlots.map((d) => ({
          id: 100 + d.slot,
          slot: d.slot,
          level: 15,
          rating: 5,
          uid: d.uid,
          icon_path: `/icons/disc-${d.slot}.png`,
          set: d.setName ? { id: 1, name: d.setName } : { id: 1, name: 'Woodpecker' },
          main_stat: { property_id: 1, name: 'HP', value: 100, is_percent: false, rolls: 0, icon_url: '' },
          sub_stats: [],
        })),
        set_bonuses: [],
      },
    } as any,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }
}

describe('conflicts utilities', () => {
  describe('getConflictLabel', () => {
    it('returns appropriate label based on active language', async () => {
      await i18n.changeLanguage('en')
      expect(getConflictLabel('DUPLICATE_AGENT')).toBe('Duplicate agent in squad')
      expect(getConflictLabel('ITEM_REUSE')).toBe('Drive Disc used in two builds')
      expect(getConflictLabel('WEAPON_REUSE')).toBe('W-Engine used in two builds')
      expect(getConflictLabel('ACCOUNT_MISMATCH')).toBe('Agents from different Proxy accounts')

      await i18n.changeLanguage('ru')
      expect(getConflictLabel('DUPLICATE_AGENT')).toBe('Дубликат агента в отряде')
      expect(getConflictLabel('ITEM_REUSE')).toBe('Драйв-диск занят в двух сборках')
    })
  })

  describe('getConflictBuildNames and resolveConflictingBuildNames', () => {
    const buildA = createMockBuild('build-1', 'Ellen Crit', 1011)
    const buildB = createMockBuild('build-2', 'Lycaon Stun', 1021)
    const slots = [buildA, buildB, null]

    it('maps build IDs and names to display names', () => {
      const names = getConflictBuildNames(slots)
      expect(names.get('build-1')).toBe('Ellen Crit')
      expect(names.get('Ellen Crit')).toBe('Ellen Crit')
      expect(names.get('build-2')).toBe('Lycaon Stun')
      expect(names.get('unknown')).toBeUndefined()
    })

    it('resolves conflicting build references with deduplication', () => {
      const refs = ['build-1', 'Ellen Crit', 'build-2', 'unknown-ref']
      const resolved = resolveConflictingBuildNames(refs, slots)
      expect(resolved).toEqual(['Ellen Crit', 'Lycaon Stun', 'unknown-ref'])
    })
  })

  describe('getDetailedSlotConflicts and getSlotConflicts', () => {
    const build1 = createMockBuild('b1', 'Build One', 101, [{ slot: 4, uid: 'disc-u1' }])
    const build2 = createMockBuild('b2', 'Build Two', 102, [{ slot: 4, uid: 'disc-u1' }])
    const build3 = createMockBuild('b3', 'Build Three', 103, [])
    const slots = [build1, build2, build3]

    it('returns empty conflict states when report is null or has no errors', () => {
      const empty = getDetailedSlotConflicts(null, slots)
      expect(empty[1].codes).toEqual([])
      expect(empty[2].codes).toEqual([])
      expect(empty[3].codes).toEqual([])

      const emptyReport: ConflictReport = { is_valid: true, errors: [] }
      const emptyFromReport = getDetailedSlotConflicts(emptyReport, slots)
      expect(emptyFromReport[1].codes).toEqual([])
    })

    it('maps duplicate agent errors correctly', () => {
      const report: ConflictReport = {
        is_valid: false,
        errors: [
          {
            code: 'DUPLICATE_AGENT',
            agent_id: 101,
            message: 'Duplicate agent',
            conflicting_builds: ['b1'],
          },
        ],
      }
      const detailed = getDetailedSlotConflicts(report, slots)
      expect(detailed[1].codes).toContain('DUPLICATE_AGENT')
      expect(detailed[2].codes).not.toContain('DUPLICATE_AGENT')

      const simple = getSlotConflicts(report, slots)
      expect(simple[1]).toEqual(['DUPLICATE_AGENT'])
      expect(simple[2]).toEqual([])
    })

    it('identifies weapon reuse conflicts across slots', () => {
      const report: ConflictReport = {
        is_valid: false,
        errors: [
          {
            code: 'WEAPON_REUSE',
            message: 'W-Engine conflict',
            conflicting_builds: ['b1', 'b2'],
          },
        ],
      }
      const detailed = getDetailedSlotConflicts(report, slots)
      expect(detailed[1].hasWeaponConflict).toBe(true)
      expect(detailed[2].hasWeaponConflict).toBe(true)
      expect(detailed[3].hasWeaponConflict).toBe(false)
    })

    it('maps drive disc reuse conflicts and resolves slot number from item_uid', () => {
      const report: ConflictReport = {
        is_valid: false,
        errors: [
          {
            code: 'ITEM_REUSE',
            item_uid: 'disc-u1',
            message: 'Disc reused',
            conflicting_builds: ['b1', 'b2'],
          },
        ],
      }
      const detailed = getDetailedSlotConflicts(report, slots)
      expect(detailed[1].conflictingDiscUIDs).toContain('disc-u1')
      expect(detailed[1].conflictingDiscSlots).toContain(4)
      expect(detailed[2].conflictingDiscUIDs).toContain('disc-u1')
      expect(detailed[2].conflictingDiscSlots).toContain(4)
      expect(detailed[3].conflictingDiscSlots).toEqual([])
    })
  })

  describe('getConflictingDiscMeta and formatConflictMessage', () => {
    const build = createMockBuild('b1', 'Test Build', 101, [
      { slot: 5, uid: 'disc-55', setName: 'Woodpecker Electro' },
    ])
    const slots = [build, null, null]

    it('extracts disc metadata when item_uid matches', () => {
      const meta = getConflictingDiscMeta(
        { code: 'ITEM_REUSE', item_uid: 'disc-55' },
        slots,
      )
      expect(meta).toEqual({
        slot: 5,
        setName: 'Woodpecker Electro',
        iconUrl: '/icons/disc-5.png',
      })
    })

    it('returns null for non-item conflicts', () => {
      expect(getConflictingDiscMeta({ code: 'WEAPON_REUSE' }, slots)).toBeNull()
    })

    it('formats conflict messages with custom or localized translations', async () => {
      await i18n.changeLanguage('en')
      const msg = formatConflictMessage(
        { code: 'ITEM_REUSE', item_uid: 'disc-55', message: 'fallback' },
        slots,
      )
      expect(msg).toBe('Drive Disc “Woodpecker Electro” (Slot 5) used in two builds')

      const weaponMsg = formatConflictMessage(
        { code: 'WEAPON_REUSE', message: 'fallback' },
        slots,
      )
      expect(weaponMsg).toBe('W-Engine used in two builds')
    })
  })

  describe('getBuildPickerConflict', () => {
    const activeEllen = createMockBuild('ellen-1', 'Shark Frostbite', 1011, [
      { slot: 4, uid: 'disc-4', setName: 'Polar Metal' },
      { slot: 5, uid: 'disc-5', setName: 'Woodpecker' },
    ])
    activeEllen.weapon_uid = 'weapon-visitor'

    const activeLycaon = createMockBuild('lycaon-1', 'Butler Stun', 1021, [
      { slot: 1, uid: 'disc-1', setName: 'Shockstar' },
    ])
    activeLycaon.weapon_uid = 'weapon-restrained'

    const currentSquad = [activeEllen, activeLycaon]

    it('returns IN_SQUAD when exact same build is already in the squad', () => {
      const conflict = getBuildPickerConflict(activeEllen, currentSquad)
      expect(conflict).toEqual({
        type: 'IN_SQUAD',
        conflictingBuild: activeEllen,
      })
    })

    it('returns DUPLICATE_AGENT when picking another preset of the same agent', () => {
      const alternateEllen = createMockBuild('ellen-2', 'Shark Alternative', 1011)
      const conflict = getBuildPickerConflict(alternateEllen, currentSquad)
      expect(conflict).toEqual({
        type: 'DUPLICATE_AGENT',
        conflictingBuild: activeEllen,
      })
    })

    it('returns WEAPON_REUSE when candidate shares weapon_uid with an active member', () => {
      const corinWithEllenWeapon = createMockBuild('corin-1', 'Housekeeper Saw', 1061)
      corinWithEllenWeapon.weapon_uid = 'weapon-visitor'

      const conflict = getBuildPickerConflict(corinWithEllenWeapon, currentSquad)
      expect(conflict).toEqual({
        type: 'WEAPON_REUSE',
        conflictingBuild: activeEllen,
      })
    })

    it('returns ITEM_REUSE with disc slot and set name when candidate shares a disc_uid', () => {
      const soukakuWithEllenDisc = createMockBuild('soukaku-1', 'Banner Support', 1031, [
        { slot: 4, uid: 'disc-4', setName: 'Polar Metal' },
      ])

      const conflict = getBuildPickerConflict(soukakuWithEllenDisc, currentSquad)
      expect(conflict).toEqual({
        type: 'ITEM_REUSE',
        conflictingBuild: activeEllen,
        discSlot: 4,
        discSetName: 'Polar Metal',
      })
    })

    it('returns ACCOUNT_MISMATCH when candidate belongs to a different proxy account', () => {
      const otherAccountBuild = createMockBuild('other-1', 'Alien Build', 1081)
      otherAccountBuild.game_account_id = 'different-acc'

      const conflict = getBuildPickerConflict(otherAccountBuild, currentSquad)
      expect(conflict).toEqual({
        type: 'ACCOUNT_MISMATCH',
        conflictingBuild: activeEllen,
      })
    })

    it('returns null when candidate has no conflicts with active squad', () => {
      const validSoukaku = createMockBuild('soukaku-1', 'Banner Support', 1031, [
        { slot: 2, uid: 'disc-free-2', setName: 'Swing Jazz' },
      ])
      validSoukaku.weapon_uid = 'weapon-kaboom'

      const conflict = getBuildPickerConflict(validSoukaku, currentSquad)
      expect(conflict).toBeNull()
    })

    it('handles empty, null, or undefined squad builds gracefully', () => {
      const validSoukaku = createMockBuild('soukaku-1', 'Banner Support', 1031)
      expect(getBuildPickerConflict(validSoukaku, [null, undefined])).toBeNull()
      expect(getBuildPickerConflict(validSoukaku, [])).toBeNull()
    })
  })

  describe('getDetailedBuildPickerConflict', () => {
    const activeEllen = createMockBuild('ellen-1', 'Shark Frostbite', 1011, [
      { slot: 1, uid: 'disc-1', setName: 'Polar Metal' },
      { slot: 4, uid: 'disc-4', setName: 'Polar Metal' },
    ])
    activeEllen.agent_name = 'Эллен'
    activeEllen.weapon_uid = 'weapon-visitor'

    const squad = [activeEllen, null, null]

    it('returns IN_SQUAD with slot number 1 for the exact build in slot 1', () => {
      const result = getDetailedBuildPickerConflict(activeEllen, squad)
      expect(result).not.toBeNull()
      expect(result?.type).toBe('IN_SQUAD')
      expect(result?.squadSlot).toBe(1)
      expect(result?.conflictingAgentName).toBe('Эллен')
    })

    it('returns DUPLICATE_AGENT for another build of the same agent', () => {
      const altEllen = createMockBuild('ellen-2', 'Shark Alternative', 1011)
      altEllen.agent_name = 'Эллен'
      const result = getDetailedBuildPickerConflict(altEllen, squad)
      expect(result?.type).toBe('DUPLICATE_AGENT')
      expect(result?.squadSlot).toBe(1)
      expect(result?.conflictingAgentName).toBe('Эллен')
    })

    it('returns GEAR_CONFLICT with both weapon and disc collision details simultaneously', () => {
      const corin = createMockBuild('corin-1', 'Housekeeper Saw', 1061, [
        { slot: 1, uid: 'disc-1', setName: 'Polar Metal' },
      ])
      corin.agent_name = 'Корин'
      corin.weapon_uid = 'weapon-visitor'

      const result = getDetailedBuildPickerConflict(corin, squad)
      expect(result?.type).toBe('GEAR_CONFLICT')
      expect(result?.hasWeaponConflict).toBe(true)
      expect(result?.conflictingDiscSlots).toEqual([1])
      expect(result?.conflictingAgentName).toBe('Эллен')
      expect(result?.squadSlot).toBe(1)
    })
  })
})
