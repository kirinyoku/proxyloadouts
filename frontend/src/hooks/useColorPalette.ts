import { useEffect, useState } from 'react'
import {
  type ColorPalette,
  getColorPalette,
  setColorPalette,
  toggleColorPalette,
  applyColorPalette,
  COLOR_PALETTE_EVENT,
  COLOR_PALETTE_STORAGE_KEY,
} from '@/lib/color-palette'

/**
 * Hook to read and switch UI color palette ('acid' vs 'champagne').
 * Synchronizes across components and browser tabs.
 */
export function useColorPalette() {
  const [colorPalette, setLocalPalette] = useState<ColorPalette>(() => getColorPalette())

  useEffect(() => {
    // Ensure DOM is in sync with storage on mount
    applyColorPalette(getColorPalette())

    function handleCustomEvent(event: Event) {
      const customEvent = event as CustomEvent<ColorPalette>
      setLocalPalette(customEvent.detail)
    }

    function handleStorageEvent(event: StorageEvent) {
      if (event.key === COLOR_PALETTE_STORAGE_KEY) {
        const updated = getColorPalette()
        setLocalPalette(updated)
        applyColorPalette(updated)
      }
    }

    window.addEventListener(COLOR_PALETTE_EVENT, handleCustomEvent)
    window.addEventListener('storage', handleStorageEvent)

    return () => {
      window.removeEventListener(COLOR_PALETTE_EVENT, handleCustomEvent)
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [])

  return {
    colorPalette,
    isChampagne: colorPalette === 'champagne',
    setColorPalette,
    toggleColorPalette,
  }
}
