export type CornerStyle = 'rounded' | 'sharp'

export const CORNER_STYLE_STORAGE_KEY = 'proxyloadouts_corner_style'
export const CORNER_STYLE_EVENT = 'proxyloadouts_corner_style_change'
export const DEFAULT_CORNER_STYLE: CornerStyle = 'rounded'

/**
 * Reads the current corner style from localStorage or returns default ('rounded').
 */
export function getCornerStyle(): CornerStyle {
  if (typeof window === 'undefined') return DEFAULT_CORNER_STYLE
  try {
    const saved = window.localStorage.getItem(CORNER_STYLE_STORAGE_KEY)
    return saved === 'sharp' ? 'sharp' : DEFAULT_CORNER_STYLE
  } catch {
    return DEFAULT_CORNER_STYLE
  }
}

/**
 * Applies the corner style attribute to the <html> documentElement.
 */
export function applyCornerStyle(style: CornerStyle): void {
  if (typeof document === 'undefined') return
  if (style === 'sharp') {
    document.documentElement.setAttribute('data-corners', 'sharp')
  } else {
    document.documentElement.removeAttribute('data-corners')
  }
}

/**
 * Saves corner style to localStorage, updates the DOM, and notifies listeners.
 */
export function setCornerStyle(style: CornerStyle): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CORNER_STYLE_STORAGE_KEY, style)
  } catch {
    // localStorage unavailable — ignore
  }

  applyCornerStyle(style)

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<CornerStyle>(CORNER_STYLE_EVENT, { detail: style })
    )
  }
}

/**
 * Toggles between 'rounded' and 'sharp'.
 */
export function toggleCornerStyle(): CornerStyle {
  const current = getCornerStyle()
  const next: CornerStyle = current === 'sharp' ? 'rounded' : 'sharp'
  setCornerStyle(next)
  return next
}
