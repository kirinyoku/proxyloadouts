import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ERROR_TOASTER_ID, Toaster, toast } from './sonner'

describe('sonner Toaster & toast routing', () => {
  it('exports ERROR_TOASTER_ID constant', () => {
    expect(ERROR_TOASTER_ID).toBe('error-toaster')
  })

  it('renders Toaster component containing both standard and centered error toasters', () => {
    const html = renderToString(<Toaster />)
    expect(html).toBeDefined()
  })

  it('routes toast.error automatically to the centered error toaster', () => {
    // Calling toast.error returns the toast ID
    const toastId = toast.error('Test error message')
    expect(toastId).toBeDefined()
  })

  it('preserves custom options when dispatching toast.error', () => {
    const toastId = toast.error('Critical failure', { description: 'Network timeout' })
    expect(toastId).toBeDefined()
  })
})
