import type { Attribute, Specialty, Rarity } from '@/lib/game-constants.generated'
export type { Attribute, Specialty, Rarity } from '@/lib/game-constants.generated'

export type SkillType = 'basic' | 'dodge' | 'assist' | 'special' | 'chain' | 'passive'

export interface Skin {
  id: number
  name: string
  description: string
  splash_art_url: string
}

export interface SkillParam {
  name: string
  value: string
}

export interface Skill {
  level: number
  name: string
  description: string
  formatted_html?: string
  type: SkillType
  type_name: string
  params?: SkillParam[]
}

export interface SkillGroup {
  type: SkillType
  type_name: string
  level: number
  skills: Skill[]
}

export interface MindscapeNode {
  rank: number
  name: string
  description: string
  formatted_html?: string
  unlocked: boolean
}

export interface PotentialVisionNode {
  id: number
  level: number
  level_name: string
  title: string
  description: string
  formatted_html?: string
  is_active: boolean
}

export interface PotentialVision {
  is_unlocked: boolean
  current_id: number
  nodes: PotentialVisionNode[]
}

export interface StatValue {
  property_id: number
  name: string
  value: number
  is_percent: boolean
  rolls: number
  icon_url: string
}

export interface Stats {
  hp: number
  atk: number
  def: number
  impact: number
  crit_rate: number
  crit_dmg: number
  attribute_dmg_bonus: number
  anomaly_mastery: number
  anomaly_proficiency: number
  pen_ratio: number
  pen_flat: number
  energy_regen: number
  sheer_force: number
  sharp_crit_dmg?: number
  energy_property_id?: number
}

export interface FormattedStatBreakdown {
  property_id: number
  name: string
  base: string
  added: string
  total: string
  icon_url: string
}

export interface UIStats {
  hp?: FormattedStatBreakdown
  atk?: FormattedStatBreakdown
  def?: FormattedStatBreakdown
  impact?: FormattedStatBreakdown
  crit_rate?: FormattedStatBreakdown
  crit_dmg?: FormattedStatBreakdown
  attribute_dmg_bonus?: FormattedStatBreakdown
  anomaly_mastery?: FormattedStatBreakdown
  anomaly_proficiency?: FormattedStatBreakdown
  pen_ratio?: FormattedStatBreakdown
  pen_flat?: FormattedStatBreakdown
  energy_regen?: FormattedStatBreakdown
  sheer_force?: FormattedStatBreakdown
  sharp_crit_dmg?: FormattedStatBreakdown
}

export interface WEngine {
  id: number
  uid: string
  name: string
  level: number
  phase: number
  modification: number
  rarity: Rarity
  specialty: Specialty
  specialty_name: string
  icon_url: string
  main_stat: StatValue
  secondary_stat: StatValue
  passive_description: string
  formatted_html?: string
}

export interface DriveDiscSet {
  id: number
  name: string
}

export interface DriveDisc {
  id: number
  uid: string
  set: DriveDiscSet
  slot: number
  level: number
  rarity: Rarity
  icon_path: string
  main_stat: StatValue
  sub_stats: StatValue[]
}

export interface SetEffect {
  piece_count: number
  description: string
  formatted_html?: string
  is_active: boolean
}

export interface DriveDiscSetBonus {
  set: DriveDiscSet
  count: number
  effects: SetEffect[]
}

export interface DriveDiscs {
  slots: DriveDisc[]
  set_bonuses: DriveDiscSetBonus[]
}

export interface Agent {
  id: number
  name: string
  level: number
  promotion: number
  mindscape_cinema: number
  core_skill_enhancement: number
  attribute: Attribute
  attribute_name: string
  specialty: Specialty
  specialty_name: string
  rarity: Rarity
  skin: Skin | null
  splash_art_url: string
  skills: Skill[]
  grouped_skills?: SkillGroup[]
  mindscapes?: MindscapeNode[]
  potential_vision?: PotentialVision | null
  w_engine: WEngine | null
  drive_discs?: DriveDiscs
  highlight_props?: number[]
  recommended_sub_stats?: number[]
  base_stats?: Stats
  stats?: Stats
  ui_stats?: UIStats
}
