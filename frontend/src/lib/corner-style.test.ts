import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import {
  getCornerStyle,
  setCornerStyle,
  toggleCornerStyle,
  applyCornerStyle,
  CORNER_STYLE_STORAGE_KEY,
  CORNER_STYLE_EVENT,
} from './corner-style'

describe('corner-style utility', () => {
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

  it('returns default rounded style when nothing is stored', () => {
    expect(getCornerStyle()).toBe('rounded')
    expect(document.documentElement.getAttribute('data-corners')).toBeNull()
  })

  it('sets sharp style in localStorage and on documentElement', () => {
    setCornerStyle('sharp')
    expect(getCornerStyle()).toBe('sharp')
    expect(localStorage.getItem(CORNER_STYLE_STORAGE_KEY)).toBe('sharp')
    expect(document.documentElement.getAttribute('data-corners')).toBe('sharp')
  })

  it('sets rounded style in localStorage and removes attribute on documentElement', () => {
    setCornerStyle('sharp')
    setCornerStyle('rounded')
    expect(getCornerStyle()).toBe('rounded')
    expect(localStorage.getItem(CORNER_STYLE_STORAGE_KEY)).toBe('rounded')
    expect(document.documentElement.getAttribute('data-corners')).toBeNull()
  })

  it('toggles between rounded and sharp', () => {
    expect(getCornerStyle()).toBe('rounded')
    const first = toggleCornerStyle()
    expect(first).toBe('sharp')
    expect(getCornerStyle()).toBe('sharp')
    expect(document.documentElement.getAttribute('data-corners')).toBe('sharp')

    const second = toggleCornerStyle()
    expect(second).toBe('rounded')
    expect(getCornerStyle()).toBe('rounded')
    expect(document.documentElement.getAttribute('data-corners')).toBeNull()
  })

  it('dispatches custom event on style change', () => {
    let eventReceived: string | null = null
    const handler = (e: Event) => {
      eventReceived = (e as CustomEvent).detail
    }

    window.addEventListener(CORNER_STYLE_EVENT, handler)
    setCornerStyle('sharp')
    expect(eventReceived).toBe('sharp')

    window.removeEventListener(CORNER_STYLE_EVENT, handler)
  })

  it('directly applies and removes documentElement attribute via applyCornerStyle', () => {
    applyCornerStyle('sharp')
    expect(document.documentElement.getAttribute('data-corners')).toBe('sharp')

    applyCornerStyle('rounded')
    expect(document.documentElement.getAttribute('data-corners')).toBeNull()
  })
})
