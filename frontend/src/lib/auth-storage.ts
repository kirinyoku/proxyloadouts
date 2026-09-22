const RETURN_PATH_KEY = 'proxyloadouts_return_path'
const LEGACY_RETURN_PATH_KEY = 'return_path'
const DEFAULT_FALLBACK_PATH = '/showcase'

/**
 * Validates that a redirect path is safe and local to the application:
 * - Must start with a single '/'
 * - Must not start with '//' (protocol-relative URL)
 * - Must not contain control characters, backslashes, or URI schemes (e.g. javascript:)
 * - Must not point to login or auth callback loops
 */
export function isSafeRedirectPath(path: unknown): path is string {
  if (typeof path !== 'string') return false
  const trimmed = path.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return false
  if (trimmed === '/login' || trimmed === '/auth/callback') return false
  if (/[\r\n\t\0\\]/.test(trimmed)) return false
  return true
}

/**
 * Persists a safe return path to sessionStorage for restoration after authentication.
 */
export function savePostLoginRedirect(path: string | undefined | null): boolean {
  if (!isSafeRedirectPath(path)) return false
  try {
    sessionStorage.setItem(RETURN_PATH_KEY, path)
    return true
  } catch {
    return false
  }
}

/**
 * Reads the stored return path without clearing it.
 */
export function getPostLoginRedirect(fallback = DEFAULT_FALLBACK_PATH): string {
  try {
    const path = sessionStorage.getItem(RETURN_PATH_KEY) ?? sessionStorage.getItem(LEGACY_RETURN_PATH_KEY)
    if (isSafeRedirectPath(path)) {
      return path
    }
  } catch {
    // sessionStorage unavailable
  }
  return fallback
}

/**
 * Reads and removes the stored return path from sessionStorage.
 */
export function consumePostLoginRedirect(fallback = DEFAULT_FALLBACK_PATH): string {
  try {
    const path = sessionStorage.getItem(RETURN_PATH_KEY) ?? sessionStorage.getItem(LEGACY_RETURN_PATH_KEY)
    sessionStorage.removeItem(RETURN_PATH_KEY)
    sessionStorage.removeItem(LEGACY_RETURN_PATH_KEY)
    if (isSafeRedirectPath(path)) {
      return path
    }
  } catch {
    // sessionStorage unavailable
  }
  return fallback
}

