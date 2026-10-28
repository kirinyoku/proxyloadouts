import type { PublicOwnerInfo } from './account'
import type { Agent } from './agent'
import type { Build } from './build'
import type { TeamSummary } from './team'

export type ShowcaseSource = 'fresh' | 'cached'

export interface ShowcaseResponse {
  uid: string
  nickname: string
  region: string
  interknot_level: number
  avatar_url?: string
  source: ShowcaseSource
  ttl_seconds: number
  fetched_at: string
  agent_count: number
  agents: Agent[]
  verified_owner?: PublicOwnerInfo | null
  has_public_roster?: boolean
}

export interface PublicShowcaseRosterResponse {
  owner: PublicOwnerInfo
  is_public_showcase: boolean
  builds: Build[]
  teams: TeamSummary[]
}
