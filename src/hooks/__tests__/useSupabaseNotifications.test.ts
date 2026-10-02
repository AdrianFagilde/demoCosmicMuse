import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})

import useSupabaseNotifications from '../useSupabaseNotifications'
import { supabaseMock } from '../../test/supabaseMock'

beforeEach(() => {
  supabaseMock.reset()
})

const renderNotifications = async () => {
  const hook = renderHook(() => useSupabaseNotifications())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useSupabaseNotifications', () => {
  it('loads the notification log', async () => {
    supabaseMock.queue('notification_log', { data: [{ id: 'n1' }], error: null })

    const { result } = await renderNotifications()

    expect(result.current.entries).toHaveLength(1)
  })

  it('surfaces fetch errors', async () => {
    supabaseMock.queue('notification_log', { data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useSupabaseNotifications())
    await waitFor(() => expect(result.current.error).toBeTruthy())
  })

  it('normalizes aliases before inserting and refetches', async () => {
    supabaseMock.queue(
      'notification_log',
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
    )
    const { result } = await renderNotifications()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addEntries([
        { studentId: 's1', studentName: 'Ana', targetGroup: 'Todos', trigger: 'auto' },
      ])
    })

    expect(returned).toBe(true)
    const insert = supabaseMock.calls.find(
      (c) => c.table === 'notification_log' && c.method === 'insert',
    )
    expect(insert?.args[0][0]).toMatchObject({
      student_id: 's1',
      student_name: 'Ana',
      target_group: 'Todos',
      trigger_type: 'auto',
    })
  })

  it('returns false when inserting fails', async () => {
    supabaseMock.queue(
      'notification_log',
      { data: [], error: null },
      { data: null, error: { message: 'boom' } },
    )
    const { result } = await renderNotifications()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addEntries([{ message: 'x' }])
    })

    expect(returned).toBe(false)
  })
})
