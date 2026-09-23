import { describe, expect, it } from 'vitest'
import i18n, { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './index'
import ru from './locales/ru'
import en from './locales/en'

type JsonRecord = Record<string, unknown>

function collectKeysWithVars(obj: JsonRecord, prefix = ''): Map<string, string[]> {
  const result = new Map<string, string[]>()
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      const matches = Array.from(value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g))
        .map((m) => m[1])
        .filter((v): v is string => typeof v === 'string')
      if (matches.length > 0) {
        result.set(fullKey, matches.sort())
      }
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = collectKeysWithVars(value as JsonRecord, fullKey)
      for (const [k, v] of nested.entries()) {
        result.set(k, v)
      }
    }
  }
  return result
}

describe('i18n interpolation integrity', () => {
  it('has identical interpolation variables in Russian and English locales', () => {
    const ruInterpolated = collectKeysWithVars(ru as unknown as JsonRecord)
    const enInterpolated = collectKeysWithVars(en as unknown as JsonRecord)

    for (const [key, vars] of ruInterpolated.entries()) {
      const enVars = enInterpolated.get(key)
      expect(enVars, `Missing interpolated key in English: ${key}`).toBeDefined()
      expect(enVars, `Mismatched variables for key: ${key}`).toEqual(vars)
    }

    for (const key of enInterpolated.keys()) {
      expect(ruInterpolated.has(key), `Extra interpolated key in English not in Russian: ${key}`).toBe(true)
    }
  })

  it('correctly substitutes {{name}} in toasts.buildUpdated', () => {
    const ruResult = i18n.t('toasts.buildUpdated', { lng: 'ru', name: 'Моно-Эфир' })
    expect(ruResult).toBe('Сборка «Моно-Эфир» обновлена')

    const enResult = i18n.t('toasts.buildUpdated', { lng: 'en', name: 'Mono-Ether' })
    expect(enResult).toBe('Build “Mono-Ether” updated')
  })

  it('correctly substitutes {{name}} in toasts.buildSaved', () => {
    const ruResult = i18n.t('toasts.buildSaved', { lng: 'ru', name: 'Крит ДД' })
    expect(ruResult).toBe('Сборка «Крит ДД» сохранена в ростер')
  })

  it('correctly substitutes {{uid}} in toasts.accountLinked', () => {
    const ruResult = i18n.t('toasts.accountLinked', { lng: 'ru', uid: '1504687050' })
    expect(ruResult).toBe('Аккаунт Прокси 1504687050 привязан')
  })

  it('correctly substitutes {{name}} in toasts.teamSaved and teamUpdated', () => {
    const saved = i18n.t('toasts.teamSaved', { lng: 'ru', name: 'Отряд 1' })
    expect(saved).toBe('Отряд «Отряд 1» сохранён')

    const updated = i18n.t('toasts.teamUpdated', { lng: 'ru', name: 'Отряд 2' })
    expect(updated).toBe('Отряд «Отряд 2» обновлён')
  })

  it('configures English as the default base language', () => {
    expect(DEFAULT_LANGUAGE).toBe('en')
    expect(SUPPORTED_LANGUAGES[0]?.code).toBe('en')
    expect(i18n.options.fallbackLng).toEqual(['en'])
  })
})
