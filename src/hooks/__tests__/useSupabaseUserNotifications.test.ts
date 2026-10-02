import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})

import useSupabaseUserNotifications from '../useSupabaseUserNotifications'
import { supabaseMock } from '../../test/supabaseMock'

beforeEach(() => {
  supabaseMock.reset()
  vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const renderNotifications = async (userId = 'u1') => {
  const hook = renderHook(() => useSupabaseUserNotifications(userId))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useSupabaseUserNotifications', () => {
  it('loads notifications and counts the unread ones', async () => {
    supabaseMock.queue('notifications', {
      data: [
        { id: 'n1', read: false },
        { id: 'n2', read: true },
      ],
      error: null,
    })

    const { result } = await renderNotifications()

    expect(result.current.notifications).toHaveLength(2)
    expect(result.current.unreadCount).toBe(1)
  })

  it('does not fetch without a user id', async () => {
    const { result } = await renderNotifications('')

    expect(result.current.notifications).toEqual([])
    expect(supabaseMock.calls.some((c) => c.table === 'notifications')).toBe(false)
    expect(supabaseMock.calls.some((c) => c.method === 'channel')).toBe(false)
  })

  it('subscribes to realtime changes and cleans up on unmount', async () => {
    supabaseMock.queue('notifications', { data: [], error: null })

    const { unmount } = await renderNotifications('u1')

    expect(supabaseMock.calls.some((c) => c.method === 'channel')).toBe(true)
    expect(supabaseMock.calls.some((c) => c.method === 'on')).toBe(true)
    expect(supabaseMock.calls.some((c) => c.method === 'subscribe')).toBe(true)

    unmount()
    expect(supabaseMock.calls.some((c) => c.method === 'removeChannel')).toBe(true)
  })

  it('surfaces fetch errors', async () => {
    supabaseMock.queue('notifications', { data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useSupabaseUserNotifications('u1'))
    await waitFor(() => expect(result.current.error).toBeTruthy())
  })

  it('marks a single notification as read', async () => {
    supabaseMock.queue(
      'notifications',
      { data: [{ id: 'n1', read: false }], error: null },
      { data: null, error: null },
    )
    const { result } = await renderNotifications()

    let returned: unknown
    await act(async () => {
      returned = await result.current.markAsRead('n1')
    })

    expect(returned).toBe(true)
    expect(result.current.notifications[0].read).toBe(true)
    expect(result.current.unreadCount).toBe(0)
  })

  it('returns false when marking as read fails', async () => {
    supabaseMock.queue(
      'notifications',
      { data: [{ id: 'n1', read: false }], error: null },
      { data: null, error: { message: 'boom' } },
    )
    const { result } = await renderNotifications()

    let returned: unknown
    await act(async () => {
      returned = await result.current.markAsRead('n1')
    })

    expect(returned).toBe(false)
    expect(result.current.notifications[0].read).toBe(false)
  })

  it('marks all notifications as read', async () => {
    supabaseMock.queue(
      'notifications',
      {
        data: [
          { id: 'n1', read: false },
          { id: 'n2', read: false },
        ],
        error: null,
      },
      { data: null, error: null },
    )
    const { result } = await renderNotifications()

    await act(async () => {
      await result.current.markAllAsRead()
    })

    expect(result.current.unreadCount).toBe(0)
  })

  it('returns false when marking all fails and no-ops without a user', async () => {
    supabaseMock.queue(
      'notifications',
      { data: [{ id: 'n1', read: false }], error: null },
      { data: null, error: { message: 'boom' } },
    )
    const { result } = await renderNotifications()

    let returned: unknown
    await act(async () => {
      returned = await result.current.markAllAsRead()
    })
    expect(returned).toBe(false)
    expect(result.current.unreadCount).toBe(1)

    const noUser = renderHook(() => useSupabaseUserNotifications(''))
    let silent: unknown
    await act(async () => {
      silent = await noUser.result.current.markAllAsRead()
    })
    expect(silent).toBeUndefined()
  })
})
