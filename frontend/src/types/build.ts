import type { PublicOwnerInfo } from './account'
import type { Agent } from './agent'

export interface Build {
  id: string
  game_account_id: string
  agent_id: number
  agent_name: string
  name: string
  description: string | null
  weapon_uid: string | null
  weapon_id: number | null
  disc_uids: string[]
  build_data: Agent
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface CreateBuildRequest {
  game_account_id: string
  raw_agent_payload: Agent
  raw_data?: unknown
  name?: string
  description?: string | null
  is_public?: boolean
}

export interface UpdateBuildRequest {
  name?: string
  description?: string | null
  is_public?: boolean
}

export interface PublicBuildResponse {
  build: Build
  owner: PublicOwnerInfo
}
