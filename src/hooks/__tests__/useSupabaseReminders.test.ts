import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})
vi.mock('../../utils/notifications', () => ({
  notifyInApp: vi.fn(async () => undefined),
}))
vi.mock('../../utils/students', () => ({
  computeStudentBalances: vi.fn(),
}))

import useSupabaseReminders from '../useSupabaseReminders'
import { notifyInApp } from '../../utils/notifications'
import { computeStudentBalances } from '../../utils/students'
import { supabaseMock } from '../../test/supabaseMock'

const notifyMock = vi.mocked(notifyInApp)
const balancesMock = vi.mocked(computeStudentBalances)

beforeEach(() => {
  supabaseMock.reset()
  notifyMock.mockClear()
  balancesMock.mockReset()
})

const renderReminders = async (userId = 'admin-1') => {
  const hook = renderHook(() => useSupabaseReminders(userId))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

const reminder = (overrides: Record<string, unknown> = {}) => ({
  id: 'r1',
  message: 'Paga ya',
  target_group: 'Todos',
  notify_whatsapp: false,
  schedule_at: '2026-03-01T10:00:00.000Z',
  interval_value: 0,
  interval_unit: 'Días',
  created_by: 'admin-1',
  ...overrides,
})

describe('useSupabaseReminders', () => {
  it('rejects addReminder with an invalid schedule', async () => {
    const { result } = await renderReminders()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addReminder({ scheduleAt: 'nope', targetGroup: 'Todos' })
    })

    expect(returned).toBe(false)
    expect(
      supabaseMock.calls.some((c) => c.table === 'payment_reminders' && c.method === 'insert'),
    ).toBe(false)
  })

  it('addReminder normalizes the schedule to UTC and defaults fields', async () => {
    const { result } = await renderReminders()

    await act(async () => {
      await result.current.addReminder({
        scheduleAt: '2026-10-01T14:30',
        targetGroup: 'Todos',
        message: 'hola',
      })
    })

    const insert = supabaseMock.calls.find(
      (c) => c.table === 'payment_reminders' && c.method === 'insert',
    )
    expect(insert?.args[0]).toMatchObject({
      schedule_at: new Date('2026-10-01T14:30').toISOString(),
      interval_value: 0,
      interval_unit: 'Días',
      target_group: 'Todos',
      active: true,
      student_id: null,
      created_by: 'admin-1',
    })
  })

  it('addReminder targets a single student for Individual reminders', async () => {
    const { result } = await renderReminders()

    await act(async () => {
      await result.current.addReminder({
        scheduleAt: '2026-10-01T14:30',
        targetGroup: 'Individual',
        studentId: 's1',
        message: 'hola',
        active: false,
      })
    })

    const insert = supabaseMock.calls.find(
      (c) => c.table === 'payment_reminders' && c.method === 'insert',
    )
    expect(insert?.args[0]).toMatchObject({ student_id: 's1', active: false })
  })

  it('updateReminder patches local state and returns false on error', async () => {
    supabaseMock.queue('payment_reminders', { data: [reminder()], error: null })
    const { result } = await renderReminders()

    await act(async () => {
      await result.current.updateReminder('r1', { message: 'nuevo' })
    })
    expect(result.current.reminders[0].message).toBe('nuevo')

    supabaseMock.queue('payment_reminders', { data: null, error: { message: 'boom' } })
    let returned: unknown
    await act(async () => {
      returned = await result.current.updateReminder('r1', { message: 'x' })
    })
    expect(returned).toBe(false)
  })

  it('deleteReminder removes the row and reports failures', async () => {
    supabaseMock.queue('payment_reminders', {
      data: [reminder({ id: 'r1' }), reminder({ id: 'r2' })],
      error: null,
    })
    const { result } = await renderReminders()

    await act(async () => {
      await result.current.deleteReminder('r1')
    })
    expect(result.current.reminders.map((r: { id: string }) => r.id)).toEqual(['r2'])

    supabaseMock.queue('payment_reminders', { data: null, error: { message: 'boom' } })
    let returned: unknown
    await act(async () => {
      returned = await result.current.deleteReminder('r2')
    })
    expect(returned).toBe(false)
  })

  it('sendReminder logs and notifies all students for Todos', async () => {
    const { result } = await renderReminders()

    let logs: Array<Record<string, unknown>> = []
    await act(async () => {
      logs = await result.current.sendReminder(reminder(), 'manual', [
        { id: 's1', name: 'Ana', email: 'a@x' },
        { id: 's2', name: 'Luis', email: 'l@x' },
      ])
    })

    expect(logs).toHaveLength(2)
    expect(notifyMock).toHaveBeenCalledTimes(1)
    const logInsert = supabaseMock.calls.find(
      (c) => c.table === 'notification_log' && c.method === 'insert',
    )
    expect(logInsert?.args[0]).toHaveLength(2)
  })

  it('sendReminder filters by student for Individual', async () => {
    const { result } = await renderReminders()

    let logs: Array<Record<string, unknown>> = []
    await act(async () => {
      logs = await result.current.sendReminder(
        reminder({ target_group: 'Individual', student_id: 's2' }),
        'manual',
        [
          { id: 's1', name: 'Ana', email: 'a@x' },
          { id: 's2', name: 'Luis', email: 'l@x' },
        ],
      )
    })

    expect(logs).toHaveLength(1)
    expect(logs[0]?.student_id).toBe('s2')
  })

  it('sendReminder filters Pagados recipients', async () => {
    const { result } = await renderReminders()

    let logs: Array<Record<string, unknown>> = []
    await act(async () => {
      logs = await result.current.sendReminder(reminder({ target_group: 'Pagados' }), 'manual', [
        { id: 's1', name: 'Ana', paymentStatus: 'Pagado' },
        { id: 's2', name: 'Luis', paymentStatus: 'Moroso' },
      ])
    })

    expect(logs).toHaveLength(1)
    expect(logs[0]?.student_id).toBe('s1')
  })

  it('sendReminder fetches profiles and computes balances for Morosos', async () => {
    supabaseMock.queue('profiles', {
      data: [
        { id: 's1', full_name: 'Ana', email: 'a@x' },
        { id: 's2', full_name: 'Luis', email: 'l@x' },
      ],
      error: null,
    })
    supabaseMock.queue('payments', { data: [{ student_id: 's1' }], error: null })
    balancesMock.mockReturnValue([
      { id: 's1', full_name: 'Ana', email: 'a@x', paymentStatus: 'Pagado' },
      { id: 's2', full_name: 'Luis', email: 'l@x', paymentStatus: 'Moroso' },
    ])
    const { result } = await renderReminders()

    let logs: Array<Record<string, unknown>> = []
    await act(async () => {
      logs = await result.current.sendReminder(reminder({ target_group: 'Morosos' }), 'auto')
    })

    expect(balancesMock).toHaveBeenCalledTimes(1)
    expect(logs).toHaveLength(1)
    expect(logs[0]?.student_id).toBe('s2')
  })

  it('sendReminder returns all profiles from the DB for Todos', async () => {
    supabaseMock.queue('profiles', {
      data: [{ id: 's1', full_name: 'Ana', email: 'a@x' }],
      error: null,
    })
    const { result } = await renderReminders()

    let logs: Array<Record<string, unknown>> = []
    await act(async () => {
      logs = await result.current.sendReminder(reminder({ target_group: 'Todos' }), 'auto')
    })

    expect(logs).toHaveLength(1)
    expect(logs[0]?.contact).toBe('a@x')
  })

  it('sendReminder sends nothing when the payments query fails', async () => {
    supabaseMock.queue('profiles', {
      data: [{ id: 's1', full_name: 'Ana', email: 'a@x' }],
      error: null,
    })
    supabaseMock.queue('payments', { data: null, error: { message: 'boom' } })
    const { result } = await renderReminders()

    let logs: Array<Record<string, unknown>> = []
    await act(async () => {
      logs = await result.current.sendReminder(reminder({ target_group: 'Morosos' }), 'auto')
    })

    expect(logs).toEqual([])
    expect(balancesMock).not.toHaveBeenCalled()
  })

  it('sendReminder deactivates a one-off reminder after sending', async () => {
    const { result } = await renderReminders()

    await act(async () => {
      await result.current.sendReminder(reminder(), 'auto', [{ id: 's1', name: 'Ana' }])
    })

    const update = supabaseMock.calls
      .filter((c) => c.table === 'payment_reminders' && c.method === 'update')
      .pop()
    expect(update?.args[0]).toMatchObject({ active: false })
    expect(update?.args[0]).toHaveProperty('last_sent')
  })

  it('sendReminder advances the schedule for recurring reminders', async () => {
    const { result } = await renderReminders()
    const past = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()

    await act(async () => {
      await result.current.sendReminder(
        reminder({ interval_value: 2, interval_unit: 'Días', schedule_at: past }),
        'auto',
        [{ id: 's1', name: 'Ana' }],
      )
    })

    const update = supabaseMock.calls
      .filter((c) => c.table === 'payment_reminders' && c.method === 'update')
      .pop()
    const nextSchedule = update?.args[0]?.schedule_at as string
    expect(new Date(nextSchedule).getTime()).toBeGreaterThan(Date.now())
    expect(update?.args[0]).not.toHaveProperty('active')
  })

  it('sendReminder uses hours when interval_unit is Horas', async () => {
    const { result } = await renderReminders()
    const past = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString()

    await act(async () => {
      await result.current.sendReminder(
        reminder({ interval_value: 3, interval_unit: 'Horas', schedule_at: past }),
        'auto',
        [{ id: 's1', name: 'Ana' }],
      )
    })

    const update = supabaseMock.calls
      .filter((c) => c.table === 'payment_reminders' && c.method === 'update')
      .pop()
    expect(new Date(update?.args[0]?.schedule_at as string).getTime()).toBeGreaterThan(Date.now())
  })

  it('sendReminder deactivates a reminder with a corrupt schedule instead of crashing', async () => {
    const { result } = await renderReminders()

    let logs: Array<Record<string, unknown>> = []
    await act(async () => {
      logs = await result.current.sendReminder(
        reminder({ interval_value: 2, schedule_at: 'not-a-date' }),
        'auto',
        [{ id: 's1', name: 'Ana' }],
      )
    })

    expect(logs).toHaveLength(1)
    const update = supabaseMock.calls
      .filter((c) => c.table === 'payment_reminders' && c.method === 'update')
      .pop()
    expect(update?.args[0]).toMatchObject({ active: false })
  })

  it('exposes only active reminders sorted by schedule', async () => {
    supabaseMock.queue('payment_reminders', {
      data: [
        { id: 'r1', active: true, schedule_at: '2026-02-01T00:00:00.000Z' },
        { id: 'r2', active: false, schedule_at: '2026-01-01T00:00:00.000Z' },
        { id: 'r3', active: true, schedule_at: '2026-01-15T00:00:00.000Z' },
      ],
      error: null,
    })
    const { result } = await renderReminders()

    expect(result.current.upcomingReminders.map((r: { id: string }) => r.id)).toEqual(['r3', 'r1'])
  })
})
