import { describe, expect, it, beforeEach } from 'vitest'
import {
  getRegionFromUID,
  getRegionShortCode,
  LAST_UID_KEY,
  persistLastUid,
  previewRegionFromUID,
  readLastUid,
  UID_PATTERN,
} from './uid'

describe('uid utilities', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('UID_PATTERN', () => {
    it('validates 9 and 10 digit UIDs', () => {
      expect(UID_PATTERN.test('1500000000')).toBe(true)
      expect(UID_PATTERN.test('100000000')).toBe(true)
      expect(UID_PATTERN.test('12345678')).toBe(false)
      expect(UID_PATTERN.test('12345678901')).toBe(false)
      expect(UID_PATTERN.test('150000000a')).toBe(false)
      expect(UID_PATTERN.test('')).toBe(false)
    })
  })

  describe('getRegionFromUID', () => {
    it('detects regions accurately from 10-digit UID prefixes', () => {
      expect(getRegionFromUID('1000000001')).toBe('America')
      expect(getRegionFromUID('1300000001')).toBe('Asia')
      expect(getRegionFromUID('1500000001')).toBe('Europe')
      expect(getRegionFromUID('1700000001')).toBe('TW/HK/MO')
      expect(getRegionFromUID('9900000001')).toBeNull()
      expect(getRegionFromUID('150000000')).toBeNull() // 9 digits
    })
  })

  describe('previewRegionFromUID', () => {
    it('previews the server from a 2-digit prefix while typing', () => {
      expect(previewRegionFromUID('10')).toBe('America')
      expect(previewRegionFromUID('13')).toBe('Asia')
      expect(previewRegionFromUID('15046870')).toBe('Europe')
      expect(previewRegionFromUID('17')).toBe('TW/HK/MO')
    })

    it('falls back to a full 10-digit lookup and rejects unknown prefixes', () => {
      expect(previewRegionFromUID('1504687050')).toBe('Europe')
      expect(previewRegionFromUID('99000000')).toBeNull()
      expect(previewRegionFromUID('9900000001')).toBeNull()
    })

    it('returns null for empty or single-character input', () => {
      expect(previewRegionFromUID('')).toBeNull()
      expect(previewRegionFromUID('1')).toBeNull()
    })
  })

  describe('getRegionShortCode', () => {
    it('maps known server regions to standardized short codes', () => {
      expect(getRegionShortCode('Europe')).toBe('EU')
      expect(getRegionShortCode('europe')).toBe('EU')
      expect(getRegionShortCode('EU')).toBe('EU')
      expect(getRegionShortCode('America')).toBe('NA')
      expect(getRegionShortCode('america')).toBe('NA')
      expect(getRegionShortCode('USA')).toBe('NA')
      expect(getRegionShortCode('NA')).toBe('NA')
      expect(getRegionShortCode('Asia')).toBe('ASIA')
      expect(getRegionShortCode('asia')).toBe('ASIA')
      expect(getRegionShortCode('TW/HK/MO')).toBe('TW/HK')
      expect(getRegionShortCode('tw/hk')).toBe('TW/HK')
      expect(getRegionShortCode('TW')).toBe('TW/HK')
      expect(getRegionShortCode('China')).toBe('CN')
      expect(getRegionShortCode('china')).toBe('CN')
      expect(getRegionShortCode('CN')).toBe('CN')
    })

    it('handles empty or unrecognized values safely', () => {
      expect(getRegionShortCode('')).toBe('')
      expect(getRegionShortCode(null)).toBe('')
      expect(getRegionShortCode(undefined)).toBe('')
      expect(getRegionShortCode('global')).toBe('GLOBAL')
    })
  })

  describe('persistLastUid and readLastUid', () => {
    it('stores and retrieves last UID in localStorage', () => {
      expect(readLastUid()).toBe('')
      persistLastUid('1501234567')
      expect(readLastUid()).toBe('1501234567')
      expect(localStorage.getItem(LAST_UID_KEY)).toBe('1501234567')
    })
  })
})
