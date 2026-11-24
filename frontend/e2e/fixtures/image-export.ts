import icons from './export-artwork/stat-icons.json' with { type: 'json' }
import type { Build, PublicOwnerInfo, StatValue, Team, TeamSummary, UIStats } from '../../src/types'

const statIcons: Record<number, string> = {
  111: icons.svgHP, 121: icons.svgATK, 131: icons.svgDEF, 122: icons.svgImpact,
  201: icons.svgCritRate, 211: icons.svgCritDMG, 314: icons.svgAnomalyMastery,
  312: icons.svgAnomalyProficiency, 231: icons.svgPENRatio, 232: icons.svgPENFlat, 305: icons.svgEnergyRegen,
}

const stat = (name: string, value: number, property_id: number, rolls = 1, is_percent = false): StatValue => ({
  name, value, property_id, is_percent, rolls, icon_url: statIcons[Math.floor(property_id / 100)] ?? '',
})
const uiStat = (name: string, total: string, property_id: number) => ({ name, total, property_id, base: total, added: '0', icon_url: statIcons[Math.floor(property_id / 100)] ?? '' })
const uiStats: UIStats = {
  hp: uiStat('HP', '11137', 11101), atk: uiStat('ATK', '3266', 12101), def: uiStat('DEF', '907', 13101),
  impact: uiStat('Impact', '86', 12201), crit_rate: uiStat('CRIT Rate', '14.6%', 20101),
  crit_dmg: uiStat('CRIT DMG', '50.0%', 21101), anomaly_mastery: uiStat('Anomaly Mastery', '195', 31401),
  anomaly_proficiency: uiStat('Anomaly Proficiency', '318', 31201), pen_ratio: uiStat('PEN Ratio', '0.0%', 23101),
  pen_flat: uiStat('PEN', '45', 23201), energy_regen: uiStat('Energy Regen', '1.20', 30501),
  attribute_dmg_bonus: uiStat('DMG Bonus', '40.0%', 31501),
}
const subStats = [
  [stat('CRIT Rate', .048, 20101, 2, true), stat('Anomaly Proficiency', 18, 31201, 2), stat('ATK', .09, 12102, 3, true), stat('HP', .06, 11102, 2, true)],
  [stat('HP', 112, 11101), stat('ATK', .09, 12102, 3, true), stat('Anomaly Proficiency', 27, 31201, 3), stat('PEN', 18, 23201, 2)],
  [stat('Anomaly Proficiency', 18, 31201, 2), stat('ATK', 19, 12101), stat('CRIT Rate', .048, 20101, 2, true), stat('ATK', .09, 12102, 3, true)],
  [stat('ATK', .12, 12102, 4, true), stat('DEF', 30, 13101, 2), stat('HP', .03, 11102, 1, true), stat('DEF', .048, 13102, 1, true)],
  [stat('PEN', 27, 23201, 3), stat('Anomaly Proficiency', 27, 31201, 3), stat('ATK', .06, 12102, 2, true), stat('DEF', .048, 13102, 1, true)],
  [stat('ATK', .09, 12102, 3, true), stat('HP', .06, 11102, 2, true), stat('Anomaly Proficiency', 18, 31201, 2), stat('DEF', .048, 13102, 1, true)],
]
const mainStats = [stat('HP', 2200, 11101), stat('ATK', 316, 12101), stat('DEF', 184, 13101), stat('Anomaly Proficiency', 92, 31201), stat('DMG Bonus', .3, 31501, 1, true), stat('Anomaly Mastery', .3, 31402, 1, true)]
export const build: Build = {
  id: 'build-png', game_account_id: 'account-png', agent_id: 1401, agent_name: 'Alice',
  name: '30 + 6', description: 'PRIVATE NOTE: never export', is_note_public: false,
  weapon_uid: 'weapon', weapon_id: 14140, disc_uids: [], is_public: false,
  created_at: '2026-10-28T19:26:00Z', updated_at: '2026-10-28T19:26:00Z',
  fae_rating: { status: 'snapshot', outdated: false, rank: 1481, rank_of: 15000, top_percentile: .099, slug: 'alice' },
  build_data: {
    id: 1401, name: 'Alice', level: 60, promotion: 6, mindscape_cinema: 0,
    core_skill_enhancement: 6, attribute: 'Physical', attribute_name: 'Physical', specialty: 'Anomaly',
    specialty_name: 'Anomaly', rarity: 'S', skin: null, splash_art_url: '', skills: [],
    highlight_props: [12101, 31401, 31201], recommended_sub_stats: [12102, 31201], ui_stats: uiStats,
    w_engine: {
      id: 14140, uid: 'weapon', name: 'Practiced Perfection', level: 60, phase: 6, modification: 1,
      rarity: 'S', specialty: 'Anomaly', specialty_name: 'Anomaly', icon_url: 'https://enka.network/ui/zzz/Weapon_S_1401.png',
      main_stat: stat('Base ATK', 713, 12101), secondary_stat: stat('ATK', .3, 12102, 1, true), passive_description: '',
    },
    drive_discs: {
      slots: mainStats.map((main_stat, index) => ({
        id: index + 1, uid: `disc-${index + 1}`, slot: index + 1,
        set: [1, 4].includes(index) ? { id: 33000, name: "Phaethon's Melody" } : { id: 32600, name: 'Fanged Metal' },
        level: 15, rarity: 'S', icon_path: `https://enka.network/ui/zzz/${[1, 4].includes(index) ? 'SuitSavior' : 'SuitFangedMetal'}.png`,
        main_stat, sub_stats: subStats[index],
      })),
      set_bonuses: [
        { set: { id: 32600, name: 'Fanged Metal' }, count: 4, effects: [] },
        { set: { id: 33000, name: "Phaethon's Melody" }, count: 2, effects: [] },
      ],
    },
  },
}
export const team: Team = {
  id: 'team-png', game_account_id: 'account-png', name: 'Ледяной отряд', description: 'PRIVATE TEAM NOTE',
  is_public: false, created_at: build.created_at, updated_at: build.updated_at,
}
export const summary: TeamSummary = {
  team, report: { is_valid: true, errors: [] },
  members: [3, 1, 2].map((slot_number) => ({
    slot_number, build: { ...build, id: `build-${slot_number}`, name: `Билд участника ${slot_number}` },
  })),
}
export const owner: PublicOwnerInfo = { uid: '1234567890', region: 'Europe', nickname: 'Proxy', avatar_url: null }
