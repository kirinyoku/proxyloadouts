import { describe, expect, it } from 'vitest'
import type { Build } from '@/types'
import { generateTeamName } from './teams'

function createStubBuild(agentName: string, fallbackName?: string): Build {
  return {
    id: `build-${agentName}`,
    game_account_id: 'acc-1',
    agent_id: 1000,
    agent_name: agentName,
    name: 'Standard Build',
    description: null,
    weapon_uid: null,
    weapon_id: null,
    disc_uids: [],
    build_data: {
      id: 1000,
      name: fallbackName || agentName,
      level: 60,
      rarity: 'S',
      attribute: 'Ice',
      specialty: 'Attack',
    } as unknown as Build['build_data'],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('generateTeamName', () => {
  it('returns an empty string when builds array is empty', () => {
    expect(generateTeamName([])).toBe('')
  })

  it('returns an empty string when all slots are null or undefined', () => {
    expect(generateTeamName([null, null, null])).toBe('')
    expect(generateTeamName([undefined, null])).toBe('')
  })

  it('generates a single name for 1 agent', () => {
    const aria = createStubBuild('Ария')
    expect(generateTeamName([aria, null, null])).toBe('Ария')
  })

  it('joins 2 agents with a slash', () => {
    const aria = createStubBuild('Ария')
    const nangong = createStubBuild('Наньгун Юй')
    expect(generateTeamName([aria, nangong, null])).toBe('Ария/Наньгун Юй')
  })

  it('joins 3 agents with slashes matching user requirement format', () => {
    const aria = createStubBuild('Ария')
    const nangong = createStubBuild('Наньгун Юй')
    const sanna = createStubBuild('Санна')
    expect(generateTeamName([aria, nangong, sanna])).toBe('Ария/Наньгун Юй/Санна')
  })

  it('handles empty middle slot correctly', () => {
    const aria = createStubBuild('Ария')
    const sanna = createStubBuild('Санна')
    expect(generateTeamName([aria, null, sanna])).toBe('Ария/Санна')
  })

  it('falls back to build_data.name if agent_name is empty', () => {
    const fallbackBuild = createStubBuild('', 'Хосими Мияби')
    expect(generateTeamName([fallbackBuild])).toBe('Хосими Мияби')
  })

  it('trims whitespace around names and skips completely empty names', () => {
    const b1 = createStubBuild('  Ария  ')
    const b2 = createStubBuild('   ')
    const b3 = createStubBuild('Санна')
    expect(generateTeamName([b1, b2, b3])).toBe('Ария/Санна')
  })

  it('truncates at 100 characters if names exceed max length', () => {
    const long1 = createStubBuild('A'.repeat(60))
    const long2 = createStubBuild('B'.repeat(60))
    const result = generateTeamName([long1, long2])
    expect(result.length).toBe(100)
    expect(result.startsWith('A'.repeat(60) + '/' + 'B'.repeat(39))).toBe(true)
  })
})
