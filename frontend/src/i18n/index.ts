import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ru from './locales/ru'
import en from './locales/en'

export type SupportedLanguage = 'ru' | 'en'

export interface LanguageOption {
  code: SupportedLanguage
  label: string
  short: string
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'ru', label: 'Русский', short: 'RU' },
] as const

export const DEFAULT_LANGUAGE: SupportedLanguage = 'en'
export const LANGUAGE_STORAGE_KEY = 'pl-lang'

// Both dictionaries ship in the initial bundle on purpose.
//
// They were measured as separate lazy chunks: it only moved ~2.5-5.5 kB gzip
// off the critical path (1-2.5%), because the code displaced from the entry
// chunk reappears in sibling chunks that are still statically imported — and it
// cost an extra blocking request before the first render, which shows up as a
// flash of untranslated keys. Not worth it; revisit if the dictionaries grow
// substantially or a real lazy-loading transport (i18next-http-backend) lands.
export const resources = {
  en: { translation: en },
  ru: { translation: ru },
} as const

function getInitialLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (saved === 'ru' || saved === 'en') {
      return saved
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      if (navigator.language.toLowerCase().startsWith('ru')) {
        return 'ru'
      }
      return 'en'
    }
  } catch {
    // fallback if localStorage access fails
  }
  return DEFAULT_LANGUAGE
}

const initialLang = getInitialLanguage()

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLang,
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false, // React already protects against XSS
  },
})

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLang
}

i18n.on('languageChanged', (lang) => {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)
  } catch {
    // ignore
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang
  }
})

export function changeLanguage(lang: SupportedLanguage): Promise<unknown> {
  return i18n.changeLanguage(lang)
}

export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language as SupportedLanguage) || DEFAULT_LANGUAGE
}

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation'
    resources: {
      translation: typeof ru
    }
  }
}

export default i18n
