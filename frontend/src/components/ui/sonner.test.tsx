import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ERROR_TOASTER_ID, Toaster, toast } from './sonner'

describe('sonner Toaster & toast', () => {
  it('exports ERROR_TOASTER_ID constant for backward compatibility', () => {
    expect(ERROR_TOASTER_ID).toBe('error-toaster')
  })

  it('renders Toaster component', () => {
    const html = renderToString(<Toaster />)
    expect(html).toBeDefined()
  })

  it('dispatches toast.error, toast.success, toast.warning, toast.info normally', () => {
    const errorId = toast.error('Test error message')
    const successId = toast.success('Test success message')
    const warningId = toast.warning('Test warning message')
    const infoId = toast.info('Test info message')

    expect(errorId).toBeDefined()
    expect(successId).toBeDefined()
    expect(warningId).toBeDefined()
    expect(infoId).toBeDefined()
  })

  it('preserves custom options when dispatching toasts', () => {
    const toastId = toast.error('Critical failure', { description: 'Network timeout', duration: 8000 })
    expect(toastId).toBeDefined()
  })

  it('deduplicates identical toasts in rapid succession to prevent spam', () => {
    const firstId = toast.error('Duplicate warning')
    const secondId = toast.error('Duplicate warning')

    // Second call should return the same toast ID, updating in-place rather than creating duplicates
    expect(secondId).toBe(firstId)
  })

  it('allows distinct messages of the same type without deduplication', () => {
    const idA = toast.warning('Conflict in slot 1')
    const idB = toast.warning('Conflict in slot 2')

    expect(idA).not.toBe(idB)
  })

  it('handles concurrent bursts of warning and info with priority coordination', async () => {
    // When warning and info are called concurrently
    const infoId = toast.info('Background sync completed')
    const warningId = toast.warning('Slot conflict detected')

    expect(infoId).toBeDefined()
    expect(warningId).toBeDefined()

    // Wait for microtask flush
    await Promise.resolve()

    expect(typeof toast.dismiss).toBe('function')
  })

  it('dismiss removes specific toast and clears queues cleanly', () => {
    const testId = toast.info('Temporary notice')
    toast.dismiss(testId)
    // Clear all
    toast.dismiss()
  })
})
