export const REGIONS = ['Europe', 'America', 'Asia', 'TW/HK/MO'] as const

export type Region = (typeof REGIONS)[number]

/** Maximum number of game accounts (UIDs) a user can link. */
export const MAX_ACCOUNTS = 3

export interface GameAccount {
  id: string
  uid: string
  region: Region
  created_at: string
}

export interface CreateAccountRequest {
  uid: string
  region?: Region
}
