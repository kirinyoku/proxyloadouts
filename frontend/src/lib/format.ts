import i18n from '@/i18n'
import type { StatValue } from '@/types'

export function formatStatValue(value?: StatValue | null): string {
  if (!value) return ''
  if (value.is_percent) {
    return `${(value.value * 100).toFixed(1)}%`
  }
  const rounded = Math.round(value.value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function getIntlLocale(): string {
  const lang = i18n.language || 'ru'
  return lang.startsWith('en') ? 'en-US' : 'ru-RU'
}

/**
 * Formats stat display name for compact card layout.
 * - For elemental damage, strips redundant attribute name ("Ether DMG Bonus" -> "DMG Bonus"),
 *   as the element is already visually represented by the badge/icon.
 * - For percentage base stats ("Percent ATK", "Percent DEF", "Percent HP" / "Процент атаки", etc.),
 *   normalizes them to match the in-game UI ("ATK", "DEF", "HP" / "Сила атаки", "Защита", "HP"),
 *   because the "%" symbol is already rendered next to the value.
 */
export function formatStatName(name?: string, propertyId?: number): string {
  const isEn = (i18n.language || '').startsWith('en')

  if (
    (propertyId && ((propertyId >= 31500 && propertyId < 32000) || (propertyId >= 32300 && propertyId < 32400))) ||
    (name && /dmg bonus|damage bonus|бонус.*урона/i.test(name))
  ) {
    return isEn ? 'DMG Bonus' : 'Бонус урона'
  }

  // ATK% (Property 12102: Atk_Ratio)
  if (
    propertyId === 12102 ||
    propertyId === 12104 ||
    (name && /^(percent\s+atk|процент\s+атаки)$/i.test(name.trim()))
  ) {
    return isEn ? 'ATK' : 'Сила атаки'
  }

  // DEF% (Property 13102: Def_Ratio)
  if (
    propertyId === 13102 ||
    propertyId === 13104 ||
    (name && /^(percent\s+def|процент\s+защиты)$/i.test(name.trim()))
  ) {
    return isEn ? 'DEF' : 'Защита'
  }

  // HP% (Property 11102: HpMax_Ratio)
  if (
    propertyId === 11102 ||
    propertyId === 11104 ||
    (name && /^(percent\s+hp|процент\s+hp)$/i.test(name.trim()))
  ) {
    return 'HP'
  }

  // CRIT Rate (properties 20101, 20103: "CRIT Rate" / "Крит. шанс").
  // Shortens "Шанс крит. попадания" (20 chars) down to "Крит. шанс" (10 chars)
  // so it fits in compact card rows without truncation.
  if (
    (propertyId === 20101 ||
      propertyId === 20103 ||
      propertyId === 20105 ||
      propertyId === 201 ||
      propertyId === 1201) &&
    !isEn
  ) {
    return 'Крит. шанс'
  }
  if (name && /шанс\s+крит/i.test(name)) {
    return isEn ? 'CRIT Rate' : 'Крит. шанс'
  }

  return name ?? ''
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getIntlLocale(), { maximumFractionDigits: 0 }).format(value)
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(getIntlLocale(), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(getIntlLocale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function pluralizeRu(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

export function pluralize(count: number, forms: { one: string; few?: string; many?: string; other: string }): string {
  const lang = i18n.language || 'ru'
  if (lang.startsWith('en')) {
    return count === 1 ? forms.one : forms.other
  }
  return pluralizeRu(count, forms.one, forms.few ?? forms.other, forms.many ?? forms.other)
}
