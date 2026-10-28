import type { PublicOwnerInfo } from './account'
import type { Build } from './build'
import type { ConflictReport } from './conflict'

export interface Team {
  id: string
  game_account_id: string
  name: string
  description: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface TeamMember {
  slot_number: number
  build: Build
}

export interface TeamDetail {
  team: Team
  members: TeamMember[]
}

export interface TeamSummary {
  team: Team
  report: ConflictReport
  members: TeamMember[]
}

export interface TeamCountResponse {
  count: number
  max?: number
}

export interface CreateTeamRequest {
  game_account_id: string
  name?: string
  description?: string | null
  is_public?: boolean
  build_ids: string[]
}

export interface UpdateTeamRequest {
  id: string
  game_account_id: string
  name?: string
  description?: string | null
  is_public?: boolean
  build_ids: string[]
}

export interface PublicTeamResponse {
  team: Team
  report: ConflictReport
  members: TeamMember[]
  owner: PublicOwnerInfo
}
