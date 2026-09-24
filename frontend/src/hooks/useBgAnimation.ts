import { useEffect, useState } from 'react'
import {
  type BgAnimationMode,
  getBgAnimationMode,
  setBgAnimationMode,
  toggleBgAnimationMode,
  applyBgAnimationMode,
  BG_ANIMATION_EVENT,
  BG_ANIMATION_STORAGE_KEY,
} from '@/lib/bg-animation'

/**
 * Hook to read and toggle background animation ('enabled' vs 'disabled').
 * Synchronizes across components and browser tabs.
 */
export function useBgAnimation() {
  const [bgAnimation, setLocalMode] = useState<BgAnimationMode>(() => getBgAnimationMode())

  useEffect(() => {
    // Ensure DOM is in sync with storage on mount
    applyBgAnimationMode(getBgAnimationMode())

    function handleCustomEvent(event: Event) {
      const customEvent = event as CustomEvent<BgAnimationMode>
      setLocalMode(customEvent.detail)
    }

    function handleStorageEvent(event: StorageEvent) {
      if (event.key === BG_ANIMATION_STORAGE_KEY) {
        const updated = getBgAnimationMode()
        setLocalMode(updated)
        applyBgAnimationMode(updated)
      }
    }

    window.addEventListener(BG_ANIMATION_EVENT, handleCustomEvent)
    window.addEventListener('storage', handleStorageEvent)

    return () => {
      window.removeEventListener(BG_ANIMATION_EVENT, handleCustomEvent)
      window.removeEventListener('storage', handleStorageEvent)
    }
  }, [])

  return {
    bgAnimation,
    isEnabled: bgAnimation === 'enabled',
    setBgAnimationMode,
    toggleBgAnimationMode,
  }
}
