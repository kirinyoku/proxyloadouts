import { useSyncExternalStore } from 'react'

export const MOBILE_MEDIA_QUERY =
  '(max-width: 767px), ((max-height: 500px) and (orientation: landscape)), ((hover: none) and (pointer: coarse) and (max-width: 1024px))'

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }
  const mql = window.matchMedia(MOBILE_MEDIA_QUERY)
  mql.addEventListener('change', callback)
  return () => {
    mql.removeEventListener('change', callback)
  }
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches
}

function getServerSnapshot(): boolean {
  return getSnapshot()
}

/**
 * Returns true if the client viewport or device represents a mobile/touch form factor
 * (smartphones in portrait or landscape, coarse touch pointers up to 1024px).
 *
 * Used to conditionally disable heavy decorative background animations and save CPU/GPU/battery.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
