import type { GameAccount } from './account'

export interface User {
  id: string
  discord_id: string
  username: string
  avatar_url: string | null
  created_at: string
}

export interface UserLimits {
  max_builds_per_agent: number
  max_teams_per_account: number
}

export interface MeResponse {
  user: User
  accounts: GameAccount[]
  limits?: UserLimits
  is_admin?: boolean
}
