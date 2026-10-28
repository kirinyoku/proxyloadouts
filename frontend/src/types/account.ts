export const REGIONS = ['Europe', 'America', 'Asia', 'TW/HK/MO'] as const

export type Region = (typeof REGIONS)[number]

/** Maximum number of game accounts (UIDs) a user can link. */
export const MAX_ACCOUNTS = 3

export interface GameAccount {
  id: string
  uid: string
  region: Region
  nickname?: string | null
  avatar_url?: string | null
  verified_at?: string | null
  is_public_showcase?: boolean
  show_discord?: boolean
  created_at: string
}

export interface PublicOwnerInfo {
  uid: string
  region: Region
  nickname: string | null
  avatar_url: string | null
  is_verified: boolean
  discord_username?: string | null
  discord_avatar_url?: string | null
}

export interface CreateAccountRequest {
  uid: string
  region?: Region
}
