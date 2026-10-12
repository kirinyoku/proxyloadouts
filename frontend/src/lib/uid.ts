import type { Region } from '@/types'

export const UID_PATTERN = /^\d{9,10}$/
export const LAST_UID_KEY = 'pl-last-uid'

/**
 * Determines the game server Region from the prefix of a 10-digit ZZZ UID.
 * - '10' -> America
 * - '13' -> Asia
 * - '15' -> Europe
 * - '17' -> TW/HK/MO
 */
export function getRegionFromUID(uid: string): Region | null {
  const clean = uid.trim()
  if (clean.length === 10) {
    switch (clean.slice(0, 2)) {
      case '10':
        return 'America'
      case '13':
        return 'Asia'
      case '15':
        return 'Europe'
      case '17':
        return 'TW/HK/MO'
    }
  }
  return null
}

/**
 * Maps a server region name to its standardized short code abbreviation.
 * Examples:
 * - 'Europe' | 'EU' -> 'EU'
 * - 'America' | 'NA' | 'USA' -> 'NA'
 * - 'Asia' | 'ASIA' -> 'ASIA'
 * - 'TW/HK/MO' | 'TW/HK' | 'TW' -> 'TW/HK'
 * - 'China' | 'CN' -> 'CN'
 */
export function getRegionShortCode(region?: string | null): string {
  if (!region) return ''
  const trimmed = region.trim()
  switch (trimmed.toLowerCase()) {
    case 'europe':
    case 'eu':
      return 'EU'
    case 'america':
    case 'na':
    case 'usa':
      return 'NA'
    case 'asia':
      return 'ASIA'
    case 'tw/hk/mo':
    case 'tw/hk':
    case 'tw':
      return 'TW/HK'
    case 'cht':
      return 'CHT'
    case 'china':
    case 'cn':
      return 'CN'
    default:
      return trimmed.toUpperCase()
  }
}

/**
 * Best-effort region preview for a partially typed UID: delegates to
 * `getRegionFromUID` once 10 digits are present, otherwise reads the 2-digit
 * server prefix. Returns `null` while the prefix is not yet conclusive.
 */
export function previewRegionFromUID(uid: string): Region | null {
  const clean = uid.trim()
  if (clean.length === 10) {
    return getRegionFromUID(clean)
  }
  if (clean.length >= 2) {
    switch (clean.slice(0, 2)) {
      case '10':
        return 'America'
      case '13':
        return 'Asia'
      case '15':
        return 'Europe'
      case '17':
        return 'TW/HK/MO'
    }
  }
  return null
}

function getLocalStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage
    }
  } catch {
    return null
  }
  return null
}

export function readLastUid(): string {
  return getLocalStorage()?.getItem(LAST_UID_KEY) ?? ''
}

export function persistLastUid(uid: string) {
  try {
    getLocalStorage()?.setItem(LAST_UID_KEY, uid)
  } catch {
    // ignore storage errors
  }
}
