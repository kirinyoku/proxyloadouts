import { describe, expect, it } from 'vitest'
import type { Build } from '@/types'
import {
  getBuildPickerConflict,
  getDetailedBuildPickerConflict,
} from './conflicts'

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

    it('returns ACCOUNT_MISMATCH when candidate belongs to a different account', () => {
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
