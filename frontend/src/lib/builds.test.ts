import { describe, expect, it } from 'vitest'
import type { Agent, Build, DriveDiscs, StatValue } from '@/types'
import {
  calculateSubStatTotals,
  findMatchingSavedBuild,
  getAgentEquipmentFingerprint,
  groupByAgent,
} from './builds'

function createSampleAgent(id: number, name: string): Agent {
  const dummyStat: StatValue = {
    property_id: 12101,
    name: 'Base ATK',
    value: 684,
    is_percent: false,
    rolls: 0,
    icon_url: '',
  }

  return {
    id,
    name,
    level: 60,
    promotion: 5,
    mindscape_cinema: 2,
    core_skill_enhancement: 6,
    attribute: 'Ether',
    attribute_name: 'Ether',
    specialty: 'Attack',
    specialty_name: 'Attack',
    rarity: 'S',
    skin: null,
    splash_art_url: '',
    w_engine: {
      id: 11001,
      uid: 'w-1',
      name: 'Steel Cushion',
      level: 60,
      phase: 1,
      modification: 1,
      rarity: 'S',
      specialty: 'Attack',
      specialty_name: 'Attack',
      icon_url: '',
      passive_description: '',
      main_stat: dummyStat,
      secondary_stat: { ...dummyStat, property_id: 20101, name: 'CRIT Rate', value: 0.24, is_percent: true },
    },
    drive_discs: {
      slots: [
        {
          id: 201,
          uid: 'disc-s1',
          slot: 1,
          level: 15,
          rarity: 'S',
          icon_path: '',
          set: { id: 1, name: 'Woodpecker' },
          main_stat: { property_id: 11101, name: 'HP', value: 2200, is_percent: false, rolls: 0, icon_url: '' },
          sub_stats: [
            { property_id: 20101, name: 'CRIT Rate', value: 0.048, is_percent: true, rolls: 2, icon_url: '' },
            { property_id: 21101, name: 'CRIT DMG', value: 0.096, is_percent: true, rolls: 2, icon_url: '' },
          ],
        },
        {
          id: 202,
          uid: 'disc-s2',
          slot: 2,
          level: 15,
          rarity: 'S',
          icon_path: '',
          set: { id: 1, name: 'Woodpecker' },
          main_stat: { property_id: 12101, name: 'ATK', value: 316, is_percent: false, rolls: 0, icon_url: '' },
          sub_stats: [
            { property_id: 20101, name: 'CRIT Rate', value: 0.072, is_percent: true, rolls: 3, icon_url: '' },
            { property_id: 12102, name: 'ATK%', value: 0.03, is_percent: true, rolls: 1, icon_url: '' },
          ],
        },
      ],
      set_bonuses: [],
    },
    skills: [],
    stats: {
      hp: 10000,
      atk: 2500,
      def: 600,
      impact: 100,
      crit_rate: 0.5,
      crit_dmg: 1.2,
      attribute_dmg_bonus: 0,
      anomaly_mastery: 100,
      anomaly_proficiency: 100,
      pen_ratio: 0,
      pen_flat: 0,
      energy_regen: 1.2,
      sheer_force: 0,
    },
  }
}

describe('builds utilities', () => {
  describe('groupByAgent', () => {
    it('groups builds by agent and sorts them chronologically descending', () => {
      const builds: Build[] = [
        {
          id: 'b1',
          game_account_id: 'acc-1',
          agent_id: 101,
          agent_name: 'Zhu Yuan',
          name: 'Zhu Build Old',
          description: null,
          weapon_uid: null,
          weapon_id: null,
          disc_uids: [],
          build_data: {} as any,
          created_at: '2026-09-01T10:00:00Z',
          updated_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'b2',
          game_account_id: 'acc-1',
          agent_id: 101,
          agent_name: 'Zhu Yuan',
          name: 'Zhu Build New',
          description: null,
          weapon_uid: null,
          weapon_id: null,
          disc_uids: [],
          build_data: {} as any,
          created_at: '2026-09-02T10:00:00Z',
          updated_at: '2026-09-02T10:00:00Z',
        },
        {
          id: 'b3',
          game_account_id: 'acc-1',
          agent_id: 102,
          agent_name: 'Anby',
          name: 'Anby Stun',
          description: null,
          weapon_uid: null,
          weapon_id: null,
          disc_uids: [],
          build_data: {} as any,
          created_at: '2026-09-01T12:00:00Z',
          updated_at: '2026-09-01T12:00:00Z',
        },
      ]

      const grouped = groupByAgent(builds)
      expect(grouped).toHaveLength(2)

      // Sorted alphabetically by agent name: Anby (102) before Zhu Yuan (101)
      expect(grouped[0]!.agentName).toBe('Anby')
      expect(grouped[0]!.builds).toHaveLength(1)

      expect(grouped[1]!.agentName).toBe('Zhu Yuan')
      expect(grouped[1]!.builds).toHaveLength(2)
      // Sorted by updated_at descending: b2 before b1
      expect(grouped[1]!.builds[0]!.id).toBe('b2')
      expect(grouped[1]!.builds[1]!.id).toBe('b1')
    })
  })

  describe('calculateSubStatTotals', () => {
    it('returns empty array for nullish or empty slots', () => {
      expect(calculateSubStatTotals(null)).toEqual([])
      expect(calculateSubStatTotals(undefined)).toEqual([])
      expect(calculateSubStatTotals({ slots: [], set_bonuses: [] })).toEqual([])
    })

    it('aggregates values and rolls, sorting by descending roll count', () => {
      const discs: DriveDiscs = {
        slots: [
          {
            id: 1,
            uid: 'd1',
            slot: 1,
            level: 15,
            rarity: 'S',
            icon_path: '',
            set: { id: 1, name: 'Woodpecker' },
            main_stat: { property_id: 1, name: 'HP', value: 100, is_percent: false, rolls: 0, icon_url: '' },
            sub_stats: [
              { property_id: 20101, name: 'CRIT Rate', value: 0.048, is_percent: true, rolls: 2, icon_url: '' },
              { property_id: 21101, name: 'CRIT DMG', value: 0.096, is_percent: true, rolls: 2, icon_url: '' },
            ],
          },
          {
            id: 2,
            uid: 'd2',
            slot: 2,
            level: 15,
            rarity: 'S',
            icon_path: '',
            set: { id: 1, name: 'Woodpecker' },
            main_stat: { property_id: 2, name: 'ATK', value: 50, is_percent: false, rolls: 0, icon_url: '' },
            sub_stats: [
              { property_id: 20101, name: 'CRIT Rate', value: 0.072, is_percent: true, rolls: 3, icon_url: '' },
              { property_id: 12102, name: 'ATK%', value: 0.03, is_percent: true, rolls: 1, icon_url: '' },
            ],
          },
        ],
        set_bonuses: [],
      }

      const totals = calculateSubStatTotals(discs)
      expect(totals).toHaveLength(3)

      // Highest rolls: CRIT Rate with 2+3 = 5 rolls
      expect(totals[0]!.property_id).toBe(20101)
      expect(totals[0]!.rolls).toBe(5)
      expect(totals[0]!.value).toBeCloseTo(0.12)

      // Second: CRIT DMG with 2 rolls
      expect(totals[1]!.property_id).toBe(21101)
      expect(totals[1]!.rolls).toBe(2)

      // Third: ATK% with 1 roll
      expect(totals[2]!.property_id).toBe(12102)
      expect(totals[2]!.rolls).toBe(1)
    })
  })

  describe('getAgentEquipmentFingerprint and findMatchingSavedBuild', () => {
    it('returns empty string when agent is null or undefined', () => {
      expect(getAgentEquipmentFingerprint(null)).toBe('')
      expect(getAgentEquipmentFingerprint(undefined)).toBe('')
    })

    it('generates a deterministic fingerprint based on agent stats, weapon, and discs', () => {
      const agent = createSampleAgent(101, 'Zhu Yuan')
      const fp1 = getAgentEquipmentFingerprint(agent)
      const fp2 = getAgentEquipmentFingerprint(agent)

      expect(fp1).toBe(fp2)
      expect(fp1).toContain('101#lvl:60:5:2:6#w:w-1:60:1')
      expect(fp1).toContain('s1:disc-s1:15:[20101:2,21101:2]')
      expect(fp1).toContain('s2:disc-s2:15:[12102:1,20101:3]')
    })

    it('finds a matching saved build using equipment fingerprint', () => {
      const agent = createSampleAgent(101, 'Zhu Yuan')
      const matchingBuild: Build = {
        id: 'build-match',
        game_account_id: 'acc-1',
        agent_id: 101,
        agent_name: 'Zhu Yuan',
        name: 'Matched Setup',
        description: null,
        weapon_uid: 'w-1',
        weapon_id: 11001,
        disc_uids: [],
        build_data: { ...agent },
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      }

      const otherBuild: Build = {
        id: 'build-other',
        game_account_id: 'acc-1',
        agent_id: 101,
        agent_name: 'Zhu Yuan',
        name: 'Other Setup',
        description: null,
        weapon_uid: 'w-1',
        weapon_id: 11001,
        disc_uids: [],
        build_data: {
          ...agent,
          level: 50, // Different level -> different fingerprint
        },
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      }

      const match = findMatchingSavedBuild(agent, [otherBuild, matchingBuild])
      expect(match).not.toBeNull()
      expect(match?.id).toBe('build-match')

      const noMatch = findMatchingSavedBuild(agent, [otherBuild])
      expect(noMatch).toBeNull()
    })
  })
})
