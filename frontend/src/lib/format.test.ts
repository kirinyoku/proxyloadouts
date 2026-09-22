import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatNumber,
  formatStatName,
  formatStatValue,
  pluralize,
} from './format'

import i18n from '@/i18n'

describe('format utilities', () => {
  describe('formatStatValue', () => {
    it('returns empty string for nullish values', () => {
      expect(formatStatValue(null)).toBe('')
      expect(formatStatValue(undefined)).toBe('')
    })

    it('formats percentages correctly', () => {
      expect(formatStatValue({ property_id: 1, name: 'CRIT Rate', value: 0.245, is_percent: true, rolls: 0, icon_url: '' })).toBe('24.5%')
      expect(formatStatValue({ property_id: 1, name: 'CRIT Rate', value: 0.5, is_percent: true, rolls: 0, icon_url: '' })).toBe('50.0%')
    })

    it('formats flat numbers correctly', () => {
      expect(formatStatValue({ property_id: 1, name: 'ATK', value: 314, is_percent: false, rolls: 0, icon_url: '' })).toBe('314')
      expect(formatStatValue({ property_id: 1, name: 'Anomaly Proficiency', value: 30.4, is_percent: false, rolls: 0, icon_url: '' })).toBe('30.4')
    })
  })

  describe('formatStatName', () => {
    it('simplifies elemental damage bonus names based on active language', async () => {
      await i18n.changeLanguage('ru')
      expect(formatStatName('Ether DMG Bonus', 31501)).toBe('Бонус урона')
      expect(formatStatName('Fire Damage Bonus')).toBe('Бонус урона')

      await i18n.changeLanguage('en')
      expect(formatStatName('Ether DMG Bonus', 31501)).toBe('DMG Bonus')
      expect(formatStatName('Fire Damage Bonus')).toBe('DMG Bonus')
    })

    it('preserves other stat names', () => {
      expect(formatStatName('CRIT Rate', 20101)).toBe('CRIT Rate')
      expect(formatStatName('ATK', 12101)).toBe('ATK')
    })

    it('normalizes percentage stat names to match in-game UI', async () => {
      await i18n.changeLanguage('en')
      expect(formatStatName('Percent ATK', 12102)).toBe('ATK')
      expect(formatStatName('Percent ATK')).toBe('ATK')
      expect(formatStatName('Percent DEF', 13102)).toBe('DEF')
      expect(formatStatName('Percent DEF')).toBe('DEF')
      expect(formatStatName('Percent HP', 11102)).toBe('HP')
      expect(formatStatName('Percent HP')).toBe('HP')

      await i18n.changeLanguage('ru')
      expect(formatStatName('Процент атаки', 12102)).toBe('Сила атаки')
      expect(formatStatName('Процент атаки')).toBe('Сила атаки')
      expect(formatStatName('Процент защиты', 13102)).toBe('Защита')
      expect(formatStatName('Процент защиты')).toBe('Защита')
      expect(formatStatName('Процент HP', 11102)).toBe('HP')
      expect(formatStatName('Процент HP')).toBe('HP')
    })

    it('shortens "Шанс крит. попадания" to "Крит. шанс" in Russian to prevent truncation', async () => {
      await i18n.changeLanguage('ru')
      expect(formatStatName('Шанс крит. попадания', 20101)).toBe('Крит. шанс')
      expect(formatStatName('Шанс крит. попадания', 20103)).toBe('Крит. шанс')
      expect(formatStatName('Шанс крит. попадания')).toBe('Крит. шанс')

      await i18n.changeLanguage('en')
      expect(formatStatName('CRIT Rate', 20101)).toBe('CRIT Rate')
      expect(formatStatName('CRIT Rate', 20103)).toBe('CRIT Rate')
      expect(formatStatName('Шанс крит. попадания', 20101)).toBe('CRIT Rate')
    })
  })

  describe('formatNumber', () => {
    it('formats numbers with commas/separators', () => {
      const formatted = formatNumber(1234567)
      expect(formatted).toBeDefined()
      expect(formatted.length).toBeGreaterThan(0)
    })
  })

  describe('formatDate and formatDateTime', () => {
    it('formats valid ISO dates', () => {
      const iso = '2026-09-13T12:00:00.000Z'
      expect(formatDate(iso)).toBeDefined()
      expect(formatDateTime(iso)).toBeDefined()
    })
  })

  describe('pluralize', () => {
    it('handles plural forms', () => {
      expect(pluralize(1, { one: 'build', other: 'builds' })).toBe('build')
      expect(pluralize(5, { one: 'build', other: 'builds' })).toBe('builds')
    })
  })
})
