import { describe, expect, it, beforeEach } from 'vitest'
import {
  consumePostLoginRedirect,
  getPostLoginRedirect,
  isSafeRedirectPath,
  savePostLoginRedirect,
} from './auth-storage'

describe('auth-storage', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  describe('isSafeRedirectPath', () => {
    it('accepts safe internal paths', () => {
      expect(isSafeRedirectPath('/roster')).toBe(true)
      expect(isSafeRedirectPath('/teams/123')).toBe(true)
      expect(isSafeRedirectPath('/showcase?uid=1500000000')).toBe(true)
    })

    it('rejects external URLs and protocol-relative URLs', () => {
      expect(isSafeRedirectPath('//evil.com')).toBe(false)
      expect(isSafeRedirectPath('https://evil.com')).toBe(false)
      expect(isSafeRedirectPath('javascript:alert(1)')).toBe(false)
    })

    it('rejects auth loops and non-strings', () => {
      expect(isSafeRedirectPath('/login')).toBe(false)
      expect(isSafeRedirectPath('/auth/callback')).toBe(false)
      expect(isSafeRedirectPath(null)).toBe(false)
      expect(isSafeRedirectPath(undefined)).toBe(false)
      expect(isSafeRedirectPath(123)).toBe(false)
    })

    it('rejects paths with control characters', () => {
      expect(isSafeRedirectPath('/teams\n/test')).toBe(false)
      expect(isSafeRedirectPath('/teams\r/test')).toBe(false)
      expect(isSafeRedirectPath('/teams\\evil.com')).toBe(false)
    })
  })

  describe('savePostLoginRedirect and consumePostLoginRedirect', () => {
    it('saves and consumes a valid return path', () => {
      expect(savePostLoginRedirect('/teams/new')).toBe(true)
      expect(getPostLoginRedirect()).toBe('/teams/new')
      expect(consumePostLoginRedirect()).toBe('/teams/new')
      // Consumed: should return fallback now
      expect(consumePostLoginRedirect('/fallback')).toBe('/fallback')
    })

    it('ignores unsafe return paths and falls back to default', () => {
      expect(savePostLoginRedirect('https://malicious.site')).toBe(false)
      expect(getPostLoginRedirect('/fallback')).toBe('/fallback')
    })
  })
})
