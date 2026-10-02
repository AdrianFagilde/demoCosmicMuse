import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})

import useUsernameAvailability from '../useUsernameAvailability'
import { supabaseMock } from '../../test/supabaseMock'

beforeEach(() => {
  supabaseMock.reset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

const flushDebounce = async (ms = 300) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

describe('useUsernameAvailability', () => {
  it('ignores empty or too-short usernames', async () => {
    const { result } = renderHook(() => useUsernameAvailability(300))

    await act(async () => {
      await result.current.check('ab')
      await result.current.check('   ')
    })
    await flushDebounce()

    expect(result.current.available).toBeNull()
    expect(result.current.lastChecked).toBe('')
    expect(supabaseMock.calls.some((c) => c.table === 'profiles')).toBe(false)
  })

  it('reports availability when the username is free', async () => {
    supabaseMock.queue('profiles', { data: null, error: null })
    const { result } = renderHook(() => useUsernameAvailability(300))

    act(() => {
      void result.current.check('  Ana ')
    })
    expect(result.current.checking).toBe(true)
    await flushDebounce()

    expect(result.current.available).toBe(true)
    expect(result.current.checking).toBe(false)
    expect(result.current.lastChecked).toBe('ana')
    const eqCall = supabaseMock.calls.find((c) => c.method === 'eq')
    expect(eqCall?.args).toEqual(['username', 'ana'])
  })

  it('reports unavailability when a profile is found', async () => {
    supabaseMock.queue('profiles', { data: { id: 'u1' }, error: null })
    const { result } = renderHook(() => useUsernameAvailability(300))

    act(() => {
      void result.current.check('ana')
    })
    await flushDebounce()

    expect(result.current.available).toBe(false)
  })

  it('resets state', async () => {
    supabaseMock.queue('profiles', { data: null, error: null })
    const { result } = renderHook(() => useUsernameAvailability(300))

    act(() => {
      void result.current.check('ana')
    })
    await flushDebounce()
    expect(result.current.available).toBe(true)

    act(() => {
      result.current.reset()
    })
    expect(result.current.available).toBeNull()
    expect(result.current.checking).toBe(false)
    expect(result.current.lastChecked).toBe('')
  })

  it('sets availability to null when the request throws', async () => {
    let rejectRequest!: (reason?: unknown) => void
    const pending = new Promise((_resolve, reject) => {
      rejectRequest = reject
    })
    supabaseMock.queue('profiles', pending as never)
    const { result } = renderHook(() => useUsernameAvailability(300))

    act(() => {
      void result.current.check('ana')
    })
    await flushDebounce()
    await act(async () => {
      rejectRequest(new Error('network'))
      await Promise.resolve()
    })

    expect(result.current.available).toBeNull()
    expect(result.current.checking).toBe(false)
  })

  it('ignores a stale response from a previous call', async () => {
    let resolveFirst!: (value: unknown) => void
    const first = new Promise((resolve) => {
      resolveFirst = resolve
    })
    supabaseMock.queue('profiles', first as never, { data: { id: 'u1' }, error: null })

    const { result } = renderHook(() => useUsernameAvailability(300))

    act(() => {
      void result.current.check('aaa')
    })
    await flushDebounce()

    act(() => {
      void result.current.check('bbbb')
    })
    await flushDebounce()
    expect(result.current.available).toBe(false)
    expect(result.current.lastChecked).toBe('bbbb')

    await act(async () => {
      resolveFirst({ data: null, error: null })
      await Promise.resolve()
    })
    expect(result.current.available).toBe(false)
    expect(result.current.lastChecked).toBe('bbbb')
  })

  it('clears the pending timer on unmount', async () => {
    const { result, unmount } = renderHook(() => useUsernameAvailability(300))

    act(() => {
      void result.current.check('ana')
    })
    unmount()
    await flushDebounce()

    expect(supabaseMock.calls.some((c) => c.table === 'profiles')).toBe(false)
  })
})
