export type ColorPalette = 'acid' | 'champagne'

export const COLOR_PALETTE_STORAGE_KEY = 'proxyloadouts_color_palette'
export const COLOR_PALETTE_EVENT = 'proxyloadouts_color_palette_change'
export const DEFAULT_COLOR_PALETTE: ColorPalette = 'acid'

const THEME_COLOR_BY_PALETTE: Record<ColorPalette, string> = {
  acid: '#0b0e14',
  champagne: '#0c0b0a',
}

/**
 * Reads the current color palette from localStorage or returns default ('acid').
 */
export function getColorPalette(): ColorPalette {
  if (typeof window === 'undefined') return DEFAULT_COLOR_PALETTE
  try {
    const saved = window.localStorage.getItem(COLOR_PALETTE_STORAGE_KEY)
    return saved === 'champagne' ? 'champagne' : DEFAULT_COLOR_PALETTE
  } catch {
    return DEFAULT_COLOR_PALETTE
  }
}

/**
 * Applies the color palette attribute to the <html> documentElement
 * and updates the <meta name="theme-color"> tag when present.
 */
export function applyColorPalette(palette: ColorPalette): void {
  if (typeof document === 'undefined') return
  if (palette === 'champagne') {
    document.documentElement.setAttribute('data-palette', 'champagne')
  } else {
    document.documentElement.removeAttribute('data-palette')
  }

  if (typeof document.querySelector === 'function') {
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', THEME_COLOR_BY_PALETTE[palette])
    }
  }
}

/**
 * Saves color palette to localStorage, updates the DOM, and notifies listeners.
 */
export function setColorPalette(palette: ColorPalette): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COLOR_PALETTE_STORAGE_KEY, palette)
  } catch {
    // localStorage unavailable — ignore
  }

  applyColorPalette(palette)

  if (
    typeof window !== 'undefined' &&
    typeof window.dispatchEvent === 'function' &&
    typeof CustomEvent !== 'undefined'
  ) {
    window.dispatchEvent(
      new CustomEvent<ColorPalette>(COLOR_PALETTE_EVENT, { detail: palette })
    )
  }
}

/**
 * Toggles between 'acid' and 'champagne'.
 */
export function toggleColorPalette(): ColorPalette {
  const current = getColorPalette()
  const next: ColorPalette = current === 'champagne' ? 'acid' : 'champagne'
  setColorPalette(next)
  return next
}
