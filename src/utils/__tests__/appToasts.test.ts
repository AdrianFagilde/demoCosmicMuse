import { describe, it, expect, vi } from 'vitest'
import { showAppToast, onAppToast } from '../appToasts'

describe('appToasts', () => {
  it('dispatches a custom event with defaults', () => {
    const handler = vi.fn()
    const unsubscribe = onAppToast(handler)
    showAppToast({ title: 'Guardado' })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({
      title: 'Guardado',
      body: '',
      placement: 'top-end',
      delay: 7000,
      persistent: false,
      actions: [],
    })
    unsubscribe()
  })

  it('forwards explicit options', () => {
    const handler = vi.fn()
    const unsubscribe = onAppToast(handler)
    const actions = [{ label: 'Deshacer' }] as never
    showAppToast({ title: 'T', body: 'B', placement: 'bottom-end', persistent: true, actions })
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ placement: 'bottom-end', persistent: true, actions }),
    )
    unsubscribe()
  })

  it('stops receiving events after unsubscribe', () => {
    const handler = vi.fn()
    const unsubscribe = onAppToast(handler)
    unsubscribe()
    showAppToast({ title: 'x' })
    expect(handler).not.toHaveBeenCalled()
  })
})
