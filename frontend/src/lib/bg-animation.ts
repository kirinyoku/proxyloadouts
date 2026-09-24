export type BgAnimationMode = 'enabled' | 'disabled'

export const BG_ANIMATION_STORAGE_KEY = 'proxyloadouts_bg_animation'
export const BG_ANIMATION_EVENT = 'proxyloadouts_bg_animation_change'
export const DEFAULT_BG_ANIMATION: BgAnimationMode = 'enabled'

/**
 * Reads the current background animation mode from localStorage or returns default ('enabled').
 */
export function getBgAnimationMode(): BgAnimationMode {
  if (typeof window === 'undefined') return DEFAULT_BG_ANIMATION
  try {
    const saved = window.localStorage.getItem(BG_ANIMATION_STORAGE_KEY)
    return saved === 'disabled' ? 'disabled' : DEFAULT_BG_ANIMATION
  } catch {
    return DEFAULT_BG_ANIMATION
  }
}

/**
 * Applies the background animation attribute to the <html> documentElement.
 */
export function applyBgAnimationMode(mode: BgAnimationMode): void {
  if (typeof document === 'undefined') return
  if (mode === 'disabled') {
    document.documentElement.setAttribute('data-bg-animation', 'disabled')
  } else {
    document.documentElement.removeAttribute('data-bg-animation')
  }
}

/**
 * Saves background animation mode to localStorage, updates the DOM, and notifies listeners.
 */
export function setBgAnimationMode(mode: BgAnimationMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BG_ANIMATION_STORAGE_KEY, mode)
  } catch {
    // localStorage unavailable — ignore
  }

  applyBgAnimationMode(mode)

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<BgAnimationMode>(BG_ANIMATION_EVENT, { detail: mode })
    )
  }
}

/**
 * Toggles between 'enabled' and 'disabled'.
 */
export function toggleBgAnimationMode(): BgAnimationMode {
  const current = getBgAnimationMode()
  const next: BgAnimationMode = current === 'disabled' ? 'enabled' : 'disabled'
  setBgAnimationMode(next)
  return next
}
