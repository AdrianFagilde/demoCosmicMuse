import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})
vi.mock('../../utils/notifications', () => ({
  notifyInApp: vi.fn(async () => undefined),
}))

import useSupabasePayments from '../useSupabasePayments'
import { notifyInApp } from '../../utils/notifications'
import { supabaseMock } from '../../test/supabaseMock'

const notifyMock = vi.mocked(notifyInApp)

beforeEach(() => {
  supabaseMock.reset()
  notifyMock.mockClear()
})

const renderPayments = async (userId = 'admin-1') => {
  const hook = renderHook(() => useSupabasePayments(userId))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

const basePayment = {
  studentId: 's1',
  amount: '120.5',
  date: '2026-02-01',
  method: 'Efectivo',
  frequency: 'Mensual',
  notes: '',
}

describe('useSupabasePayments', () => {
  it('loads payments on mount', async () => {
    supabaseMock.queue('payments', { data: [{ id: 'p1', amount: 10 }], error: null })

    const { result } = await renderPayments()

    expect(result.current.payments).toHaveLength(1)
    expect(result.current.error).toBeNull()
  })

  it('stores fetch errors', async () => {
    supabaseMock.queue('payments', { data: null, error: { message: 'boom' } })

    const { result } = await renderPayments()

    expect(result.current.error).toBeTruthy()
    expect(result.current.payments).toEqual([])
  })

  it('registers a payment without proof', async () => {
    supabaseMock.queue(
      'payments',
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
    )
    const { result } = await renderPayments()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addPayment(basePayment, null)
    })

    expect(returned).toBe(true)
    const insertCall = supabaseMock.calls.find(
      (c) => c.table === 'payments' && c.method === 'insert',
    )
    expect(insertCall?.args[0]).toMatchObject({
      student_id: 's1',
      amount: 120.5,
      method: 'Efectivo',
      recorded_by: 'admin-1',
      proof_url: '',
    })
    expect(supabaseMock.calls.some((c) => c.method === 'upload')).toBe(false)
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('$120.50') }),
    )
  })

  it('uploads the proof, sanitizes the name and stores its path', async () => {
    supabaseMock.queue(
      'payments',
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
    )
    const { result } = await renderPayments()

    const file = { name: 'Comprob ante-2026.pdf' }
    await act(async () => {
      await result.current.addPayment(basePayment, file as never)
    })

    const uploadCall = supabaseMock.calls.find((c) => c.method === 'upload')
    const path = uploadCall?.args[0] as string
    expect(path.startsWith('s1/')).toBe(true)
    expect(path.endsWith('-Comprob_ante-2026.pdf')).toBe(true)

    const insertCall = supabaseMock.calls.find(
      (c) => c.table === 'payments' && c.method === 'insert',
    )
    expect(insertCall?.args[0]).toMatchObject({
      proof_url: path,
      proof_name: 'Comprob_ante-2026.pdf',
    })
  })

  it('aborts when the proof upload fails', async () => {
    supabaseMock.setStorage({ upload: { data: null, error: { message: 'upload failed' } } })
    supabaseMock.queue('payments', { data: [], error: null })
    const { result } = await renderPayments()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addPayment(basePayment, { name: 'a.pdf' } as never)
    })

    expect(returned).toBe(false)
    expect(supabaseMock.calls.some((c) => c.table === 'payments' && c.method === 'insert')).toBe(
      false,
    )
  })

  it('rolls back the uploaded file when the insert fails', async () => {
    supabaseMock.queue(
      'payments',
      { data: [], error: null },
      { data: null, error: { message: 'insert failed' } },
    )
    const { result } = await renderPayments()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addPayment(basePayment, { name: 'a.pdf' } as never)
    })

    expect(returned).toBe(false)
    const removeCall = supabaseMock.calls.find((c) => c.method === 'remove')
    expect(removeCall?.args[0]).toHaveLength(1)
  })

  it('handles signed proof URLs', async () => {
    supabaseMock.queue('payments', { data: [], error: null })
    const { result } = await renderPayments()

    let url: unknown
    await act(async () => {
      url = await result.current.getPaymentProofUrl('')
    })
    expect(url).toBeNull()

    await act(async () => {
      url = await result.current.getPaymentProofUrl('s1/a.pdf')
    })
    expect(url).toBe('signed-url')

    supabaseMock.setStorage({ createSignedUrl: { data: null, error: { message: 'nope' } } })
    await act(async () => {
      url = await result.current.getPaymentProofUrl('s1/a.pdf')
    })
    expect(url).toBeNull()
  })
})
