import type { Agent } from './agent'

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
}
