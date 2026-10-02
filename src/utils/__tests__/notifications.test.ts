import { describe, it, expect, vi, beforeEach } from 'vitest'

const insert = vi.fn()

vi.mock('../../lib/supabase', () => ({
  default: { from: vi.fn(() => ({ insert })) },
}))

import { notifyInApp } from '../notifications'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notifyInApp', () => {
  it('does nothing without recipients', async () => {
    expect(await notifyInApp({ title: 't', message: 'm' } as never)).toBe(false)
    expect(insert).not.toHaveBeenCalled()
  })

  it('maps recipient ids and defaults', async () => {
    insert.mockResolvedValue({ error: null })
    const ok = await notifyInApp({
      senderId: 'admin',
      recipients: [{ id: 'u1' }, { studentId: 'u2' }],
      title: 'Tarea',
      message: 'Nueva tarea',
      referenceType: 'task',
      referenceId: 't1',
    } as never)
    expect(ok).toBe(true)
    expect(insert).toHaveBeenCalledWith([
      {
        sender_id: 'admin',
        recipient_id: 'u1',
        title: 'Tarea',
        message: 'Nueva tarea',
        reference_type: 'task',
        reference_id: 't1',
      },
      {
        sender_id: 'admin',
        recipient_id: 'u2',
        title: 'Tarea',
        message: 'Nueva tarea',
        reference_type: 'task',
        reference_id: 't1',
      },
    ])
  })

  it('lets each recipient override the reference', async () => {
    insert.mockResolvedValue({ error: null })
    await notifyInApp({
      recipients: [{ recipientId: 'u1', referenceType: 'task', referenceId: 't9' }],
      title: 't',
      message: 'm',
      referenceType: 'task',
      referenceId: 't0',
    } as never)
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({ recipient_id: 'u1', reference_id: 't9' }),
    ])
  })

  it('returns false when the insert fails', async () => {
    insert.mockResolvedValue({ error: { message: 'boom' } })
    const ok = await notifyInApp({ recipients: [{ id: 'u1' }], title: 't', message: 'm' } as never)
    expect(ok).toBe(false)
  })
})
