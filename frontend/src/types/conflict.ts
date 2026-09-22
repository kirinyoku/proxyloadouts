export type ConflictCode = 'DUPLICATE_AGENT' | 'ITEM_REUSE' | 'WEAPON_REUSE' | 'ACCOUNT_MISMATCH'

export type ConflictItemType = 'drive_disc' | 'w_engine'

export interface ConflictError {
  code: ConflictCode
  message: string
  agent_id?: number
  item_type?: ConflictItemType
  item_uid?: string
  slot?: number
  conflicting_builds?: string[]
}

export interface ConflictReport {
  is_valid: boolean
  errors: ConflictError[]
}
