import { useEffect, useState } from 'react'
import {
  type CornerStyle,
  getCornerStyle,
  setCornerStyle,
  toggleCornerStyle,
  applyCornerStyle,
  CORNER_STYLE_EVENT,
  CORNER_STYLE_STORAGE_KEY,
} from '@/lib/corner-style'

/**
 * Hook to read and toggle UI corner geometry style ('rounded' vs 'sharp').
 * Synchronizes across components and browser tabs.
 */
export function useCornerStyle() {
  const [cornerStyle, setLocalStyle] = useState<CornerStyle>(() => getCornerStyle())

  useEffect(() => {
    // Ensure DOM is in sync with storage on mount
    applyCornerStyle(getCornerStyle())

    function handleCustomEvent(event: Event) {
      const customEvent = event as CustomEvent<CornerStyle>
      setLocalStyle(customEvent.detail)
    }

    function handleStorageEvent(event: StorageEvent) {
      if (event.key === CORNER_STYLE_STORAGE_KEY) {
        const updated = getCornerStyle()
        setLocalStyle(updated)
        applyCornerStyle(updated)
      }
    }

    window.addEventListener(CORNER_STYLE_EVENT, handleCustomEvent)
    window.addEventListener('storage', handleStorageEvent)

    return () => {
      window.removeEventListener(CORNER_STYLE_EVENT, handleCustomEvent)
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [])

  return {
    cornerStyle,
    isSharp: cornerStyle === 'sharp',
    setCornerStyle,
    toggleCornerStyle,
  }
}
