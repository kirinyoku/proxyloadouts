import { describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import type React from 'react'
import { ErrorBoundary, ErrorBoundaryClass } from './ErrorBoundary'
import * as errorReporter from '@/lib/error-reporter'
import * as chunkReload from '@/lib/chunk-reload'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'ru' },
  }),
}))

describe('ErrorBoundary component', () => {
  it('renders children when no error occurs', () => {
    const html = renderToString(
      <ErrorBoundary>
        <div>Normal Content</div>
      </ErrorBoundary>
    )
    expect(html).toContain('Normal Content')
    expect(html).not.toContain('role="alert"')
  })

  it('renders error card with Reload and Home buttons when state has error', () => {
    const boundary = new ErrorBoundaryClass({ children: <div>Child</div> })
    boundary.state = {
      hasError: true,
      error: new Error('Simulated runtime crash'),
    }

    const element = boundary.render()
    const html = renderToString(element as React.ReactElement)

    expect(html).toContain('role="alert"')
    expect(html).toContain('Simulated runtime crash')
    expect(html).toContain('Reload page')
    expect(html).toContain('Go to home')
    // Redundant tryAgain button must NOT exist
    expect(html).not.toContain('Try again')
    expect(html).not.toContain('Попробовать снова')
  })

  it('getDerivedStateFromError captures error', () => {
    const err = new Error('Crash')
    const state = ErrorBoundaryClass.getDerivedStateFromError(err)
    expect(state).toEqual({ hasError: true, error: err })
  })

  it('resets error state when resetKey changes in getDerivedStateFromProps', () => {
    const prevState = {
      hasError: true,
      error: new Error('Crash'),
      prevResetKey: 'route-a',
    }

    const nextState = ErrorBoundaryClass.getDerivedStateFromProps(
      { children: null, resetKey: 'route-b' },
      prevState
    )

    expect(nextState).toEqual({
      hasError: false,
      error: null,
      prevResetKey: 'route-b',
    })
  })

  it('does not reset error if resetKey is unchanged', () => {
    const prevState = {
      hasError: true,
      error: new Error('Crash'),
      prevResetKey: 'route-a',
    }

    const nextState = ErrorBoundaryClass.getDerivedStateFromProps(
      { children: null, resetKey: 'route-a' },
      prevState
    )

    expect(nextState).toBeNull()
  })

  it('renders specialized chunk error title and description when error is a chunk failure', () => {
    const boundary = new ErrorBoundaryClass({ children: <div>Child</div> })
    boundary.state = {
      hasError: true,
      error: new TypeError('Importing a module script failed.'),
    }

    const element = boundary.render()
    const html = renderToString(element as React.ReactElement)

    expect(html).toContain('Update Available')
    expect(html).toContain('A new version of the application is available')
  })

  it('componentDidCatch triggers reloadOnChunkError and skips reporting when chunk error occurs', () => {
    const boundary = new ErrorBoundaryClass({ children: null })
    const reloadSpy = vi.spyOn(chunkReload, 'reloadOnChunkError').mockReturnValue(true)
    const reportSpy = vi.spyOn(errorReporter, 'reportError').mockImplementation(() => {})

    const chunkErr = new TypeError('Importing a module script failed.')
    boundary.componentDidCatch(chunkErr, { componentStack: 'at Component' })

    expect(reloadSpy).toHaveBeenCalled()
    expect(reportSpy).not.toHaveBeenCalled()
  })

  it('componentDidCatch delegates to reportError when error is not a chunk error', () => {
    const boundary = new ErrorBoundaryClass({ children: null })
    const reportSpy = vi.spyOn(errorReporter, 'reportError').mockImplementation(() => {})

    const runtimeErr = new Error('Regular runtime error')
    boundary.componentDidCatch(runtimeErr, { componentStack: 'at Component' })

    expect(reportSpy).toHaveBeenCalledWith(runtimeErr, { componentStack: 'at Component' })
  })

  it('handleReload calls window.location.reload', () => {
    const boundary = new ErrorBoundaryClass({ children: null })
    const reloadMock = vi.fn()
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: { ...originalLocation, reload: reloadMock },
    })

    boundary.handleReload()
    expect(reloadMock).toHaveBeenCalledTimes(1)

    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    })
  })

  it('handleGoHome sets window.location.href to /', () => {
    const boundary = new ErrorBoundaryClass({ children: null })
    let href = ''
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: {
        ...originalLocation,
        set href(val: string) {
          href = val
        },
        get href() {
          return href
        },
      },
    })

    boundary.handleGoHome()
    expect(href).toBe('/')

    Object.defineProperty(window, 'location', {
      writable: true,
      configurable: true,
      value: originalLocation,
    })
  })
})
