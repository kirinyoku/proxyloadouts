import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import {
  getColorPalette,
  setColorPalette,
  toggleColorPalette,
  applyColorPalette,
  COLOR_PALETTE_STORAGE_KEY,
  COLOR_PALETTE_EVENT,
} from './color-palette'

describe('color-palette utility', () => {
  const originalDocument = globalThis.document
  const originalAddEventListener = globalThis.addEventListener
  const originalRemoveEventListener = globalThis.removeEventListener
  const originalDispatchEvent = globalThis.dispatchEvent

  const eventTarget = new EventTarget()

  const mockMetaTheme = {
    content: '#0b0e14',
    setAttribute(name: string, value: string) {
      if (name === 'content') this.content = value
    },
    getAttribute(name: string) {
      return name === 'content' ? this.content : null
    },
  }

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
      value: {
        documentElement: mockDocumentElement,
        querySelector: (selector: string) =>
          selector === 'meta[name="theme-color"]' ? mockMetaTheme : null,
      },
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
    mockMetaTheme.content = '#0b0e14'
  })

  it('returns default acid palette when nothing is stored', () => {
    expect(getColorPalette()).toBe('acid')
    expect(document.documentElement.getAttribute('data-palette')).toBeNull()
  })

  it('sets champagne palette in localStorage, on documentElement, and updates theme-color meta', () => {
    setColorPalette('champagne')
    expect(getColorPalette()).toBe('champagne')
    expect(localStorage.getItem(COLOR_PALETTE_STORAGE_KEY)).toBe('champagne')
    expect(document.documentElement.getAttribute('data-palette')).toBe('champagne')
    expect(mockMetaTheme.getAttribute('content')).toBe('#0c0b0a')
  })

  it('sets acid palette in localStorage and removes attribute on documentElement', () => {
    setColorPalette('champagne')
    setColorPalette('acid')
    expect(getColorPalette()).toBe('acid')
    expect(localStorage.getItem(COLOR_PALETTE_STORAGE_KEY)).toBe('acid')
    expect(document.documentElement.getAttribute('data-palette')).toBeNull()
    expect(mockMetaTheme.getAttribute('content')).toBe('#0b0e14')
  })

  it('toggles between acid and champagne', () => {
    expect(getColorPalette()).toBe('acid')
    const first = toggleColorPalette()
    expect(first).toBe('champagne')
    expect(getColorPalette()).toBe('champagne')
    expect(document.documentElement.getAttribute('data-palette')).toBe('champagne')

    const second = toggleColorPalette()
    expect(second).toBe('acid')
    expect(getColorPalette()).toBe('acid')
    expect(document.documentElement.getAttribute('data-palette')).toBeNull()
  })

  it('dispatches custom event on palette change', () => {
    let eventReceived: string | null = null
    const handler = (e: Event) => {
      eventReceived = (e as CustomEvent).detail
    }

    window.addEventListener(COLOR_PALETTE_EVENT, handler)
    setColorPalette('champagne')
    expect(eventReceived).toBe('champagne')

    window.removeEventListener(COLOR_PALETTE_EVENT, handler)
  })

  it('directly applies and removes documentElement attribute via applyColorPalette', () => {
    applyColorPalette('champagne')
    expect(document.documentElement.getAttribute('data-palette')).toBe('champagne')

    applyColorPalette('acid')
    expect(document.documentElement.getAttribute('data-palette')).toBeNull()
  })
})
