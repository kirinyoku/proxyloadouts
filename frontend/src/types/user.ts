import type { GameAccount } from './account'

export interface User {
  id: string
  discord_id: string
  username: string
  avatar_url: string | null
  created_at: string
}

export interface MeResponse {
  user: User
  accounts: GameAccount[]
}
