import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CHUNK_RELOAD_STORAGE_KEY,
  initVitePreloadErrorHandler,
  isChunkLoadError,
  isRecentChunkReload,
  lazyWithChunkRetry,
  reloadOnChunkError,
  resetChunkReloadForTests,
} from './chunk-reload'

describe('chunk-reload', () => {
  const originalLocation = window.location
  let reloadMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetChunkReloadForTests()
    reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    })
    resetChunkReloadForTests()
    vi.restoreAllMocks()
  })

  describe('isChunkLoadError', () => {
    it('detects WebKit / Safari module import failure', () => {
      const err = new TypeError('Importing a module script failed.')
      expect(isChunkLoadError(err)).toBe(true)
    })

    it('detects Chromium dynamic import failure', () => {
      const err = new TypeError(
        'Failed to fetch dynamically imported module: https://proxyloadouts.com/assets/SettingsPage-ByHNwng5.js',
      )
      expect(isChunkLoadError(err)).toBe(true)
    })

    it('detects Firefox dynamic import error', () => {
      const err = new TypeError('error loading dynamically imported module')
      expect(isChunkLoadError(err)).toBe(true)
    })

    it('detects webpack / rollup chunk loading error', () => {
      const err = new Error('Loading chunk 42 failed.')
      expect(isChunkLoadError(err)).toBe(true)
    })

    it('detects CSS preload error', () => {
      const err = new Error('Unable to preload CSS for /assets/index-D0as7yEW.css')
      expect(isChunkLoadError(err)).toBe(true)
    })

    it('returns false for unrelated application errors', () => {
      expect(isChunkLoadError(new Error('Network request failed with status 500'))).toBe(false)
      expect(isChunkLoadError(new TypeError('Cannot read properties of undefined'))).toBe(false)
      expect(isChunkLoadError(null)).toBe(false)
      expect(isChunkLoadError(undefined)).toBe(false)
    })
  })

  describe('reloadOnChunkError', () => {
    it('executes window.location.reload and sets timestamp when not throttled', () => {
      const reloaded = reloadOnChunkError(10_000)
      expect(reloaded).toBe(true)
      expect(reloadMock).toHaveBeenCalledTimes(1)
      expect(sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY)).toBeTruthy()
    })

    it('suppresses reload if called within cooldown window', () => {
      const first = reloadOnChunkError(10_000)
      expect(first).toBe(true)
      expect(reloadMock).toHaveBeenCalledTimes(1)

      const second = reloadOnChunkError(10_000)
      expect(second).toBe(false)
      expect(reloadMock).toHaveBeenCalledTimes(1)
    })

    it('allows reload again after cooldown has elapsed', () => {
      sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now() - 20_000))
      const reloaded = reloadOnChunkError(10_000)
      expect(reloaded).toBe(true)
      expect(reloadMock).toHaveBeenCalledTimes(1)
    })
  })

  describe('isRecentChunkReload', () => {
    it('returns false when no reload has been recorded', () => {
      expect(isRecentChunkReload(10_000)).toBe(false)
    })

    it('returns true when a reload happened recently', () => {
      sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now() - 2_000))
      expect(isRecentChunkReload(10_000)).toBe(true)
    })

    it('returns false when reload timestamp is older than window', () => {
      sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now() - 15_000))
      expect(isRecentChunkReload(10_000)).toBe(false)
    })
  })

  describe('lazyWithChunkRetry', () => {
    it('returns module component when import succeeds', async () => {
      const loader = lazyWithChunkRetry(async () => ({ default: 'TestPage' }))
      const result = await loader()
      expect(result).toEqual({ default: 'TestPage' })
    })

    it('triggers reload on chunk load error and returns pending promise without throwing', async () => {
      const loader = lazyWithChunkRetry(async () => {
        throw new TypeError('Importing a module script failed.')
      })

      const promise = loader()
      // Give promise microtask a moment to run catch block
      let resolvedOrRejected = false
      promise.then(
        () => {
          resolvedOrRejected = true
        },
        () => {
          resolvedOrRejected = true
        },
      )

      await new Promise((r) => setTimeout(r, 10))
      expect(resolvedOrRejected).toBe(false)
      expect(reloadMock).toHaveBeenCalledTimes(1)
    })

    it('re-throws if error is not a chunk load error', async () => {
      const loader = lazyWithChunkRetry(async () => {
        throw new Error('Database connection failed')
      })

      await expect(loader()).rejects.toThrow('Database connection failed')
      expect(reloadMock).not.toHaveBeenCalled()
    })

    it('re-throws chunk error if reload cooldown is active (preventing infinite loops)', async () => {
      // Simulate recent reload
      sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()))

      const loader = lazyWithChunkRetry(async () => {
        throw new TypeError('Importing a module script failed.')
      })

      await expect(loader()).rejects.toThrow('Importing a module script failed.')
      expect(reloadMock).not.toHaveBeenCalled()
    })
  })

  describe('initVitePreloadErrorHandler', () => {
    it('listens for vite:preloadError event and triggers reload', () => {
      const listeners: Record<string, EventListener> = {}
      const addEventListenerMock = vi.fn((event: string, handler: EventListener) => {
        listeners[event] = handler
      })
      const removeEventListenerMock = vi.fn((event: string) => {
        delete listeners[event]
      })

      window.addEventListener = addEventListenerMock as any
      window.removeEventListener = removeEventListenerMock as any

      const cleanup = initVitePreloadErrorHandler()
      expect(addEventListenerMock).toHaveBeenCalledWith('vite:preloadError', expect.any(Function))

      const preventDefaultMock = vi.fn()
      listeners['vite:preloadError']?.({
        preventDefault: preventDefaultMock,
      } as unknown as Event)

      expect(preventDefaultMock).toHaveBeenCalledTimes(1)
      expect(reloadMock).toHaveBeenCalledTimes(1)

      cleanup()
      expect(removeEventListenerMock).toHaveBeenCalledWith('vite:preloadError', expect.any(Function))
    })
  })
})
