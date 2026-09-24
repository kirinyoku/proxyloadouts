import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import {
  getBgAnimationMode,
  setBgAnimationMode,
  toggleBgAnimationMode,
  applyBgAnimationMode,
  BG_ANIMATION_STORAGE_KEY,
  BG_ANIMATION_EVENT,
} from './bg-animation'

describe('bg-animation utility', () => {
  const originalDocument = globalThis.document
  const originalAddEventListener = globalThis.addEventListener
  const originalRemoveEventListener = globalThis.removeEventListener
  const originalDispatchEvent = globalThis.dispatchEvent

  const eventTarget = new EventTarget()

  const mockDocumentElement = {
    attributes: new Map<string, string>(),
    setAttribute(name: string, value: string) {
      this.attributes.set(name, value)
    },
    getAttribute(name: string) {
      return this.attributes.get(name) ?? null
    },
    removeAttribute(name: string) {
      this.attributes.delete(name)
    },
  }

  beforeAll(() => {
    Object.defineProperty(globalThis, 'document', {
      value: { documentElement: mockDocumentElement },
      writable: true,
      configurable: true,
    })
    globalThis.addEventListener = eventTarget.addEventListener.bind(eventTarget)
    globalThis.removeEventListener = eventTarget.removeEventListener.bind(eventTarget)
    globalThis.dispatchEvent = eventTarget.dispatchEvent.bind(eventTarget)
  })

  afterAll(() => {
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      writable: true,
      configurable: true,
    })
    globalThis.addEventListener = originalAddEventListener
    globalThis.removeEventListener = originalRemoveEventListener
    globalThis.dispatchEvent = originalDispatchEvent
  })

  beforeEach(() => {
    localStorage.clear()
    mockDocumentElement.attributes.clear()
  })

  it('returns default enabled mode when nothing is stored', () => {
    expect(getBgAnimationMode()).toBe('enabled')
  })

  it('reads disabled mode from localStorage', () => {
    localStorage.setItem(BG_ANIMATION_STORAGE_KEY, 'disabled')
    expect(getBgAnimationMode()).toBe('disabled')
  })

  it('sets disabled mode in localStorage and updates document attribute', () => {
    setBgAnimationMode('disabled')
    expect(localStorage.getItem(BG_ANIMATION_STORAGE_KEY)).toBe('disabled')
    expect(mockDocumentElement.getAttribute('data-bg-animation')).toBe('disabled')
  })

  it('removes data-bg-animation attribute when set to enabled', () => {
    mockDocumentElement.setAttribute('data-bg-animation', 'disabled')
    setBgAnimationMode('enabled')
    expect(mockDocumentElement.getAttribute('data-bg-animation')).toBeNull()
  })

  it('dispatches custom event on mode change', () => {
    let received: string | null = null
    const handler = (e: Event) => {
      received = (e as CustomEvent<string>).detail
    }
    window.addEventListener(BG_ANIMATION_EVENT, handler)

    setBgAnimationMode('disabled')
    expect(received).toBe('disabled')

    window.removeEventListener(BG_ANIMATION_EVENT, handler)
  })

  it('toggles mode back and forth', () => {
    expect(getBgAnimationMode()).toBe('enabled')
    const next1 = toggleBgAnimationMode()
    expect(next1).toBe('disabled')
    expect(getBgAnimationMode()).toBe('disabled')

    const next2 = toggleBgAnimationMode()
    expect(next2).toBe('enabled')
    expect(getBgAnimationMode()).toBe('enabled')
  })

  it('applies attribute via applyBgAnimationMode', () => {
    applyBgAnimationMode('disabled')
    expect(mockDocumentElement.getAttribute('data-bg-animation')).toBe('disabled')

    applyBgAnimationMode('enabled')
    expect(mockDocumentElement.getAttribute('data-bg-animation')).toBeNull()
  })
})
