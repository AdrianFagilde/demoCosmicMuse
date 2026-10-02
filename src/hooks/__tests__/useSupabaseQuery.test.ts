import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import useSupabaseQuery from '../useSupabaseQuery'

describe('useSupabaseQuery', () => {
  it('starts loading and fetches by default', async () => {
    const queryFn = vi.fn().mockResolvedValue(['a'])
    const { result } = renderHook(() => useSupabaseQuery(queryFn))

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toEqual([])

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(['a'])
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it('does not fetch when autoFetch is false', () => {
    const queryFn = vi.fn().mockResolvedValue(['a'])
    const { result } = renderHook(() => useSupabaseQuery(queryFn, false))

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual([])
    expect(queryFn).not.toHaveBeenCalled()
  })

  it('uses the provided empty value', () => {
    const queryFn = vi.fn().mockResolvedValue({})
    const { result } = renderHook(() => useSupabaseQuery(queryFn, false, { seed: true } as never))
    expect(result.current.data).toEqual({ seed: true })
  })

  it('stores the error and returns null when the query throws', async () => {
    const error = new Error('boom')
    const queryFn = vi.fn().mockRejectedValue(error)
    const { result } = renderHook(() => useSupabaseQuery(queryFn))

    await waitFor(() => expect(result.current.error).toBe(error))
    expect(result.current.loading).toBe(false)

    let returned
    await act(async () => {
      returned = await result.current.refetch()
    })
    expect(returned).toBeNull()
  })

  it('refetch resolves with the result and updates data', async () => {
    const queryFn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')
    const { result } = renderHook(() => useSupabaseQuery(queryFn, false))

    await act(async () => {
      await result.current.refetch()
    })
    expect(result.current.data).toBe('first')

    await act(async () => {
      await result.current.refetch()
    })
    expect(result.current.data).toBe('second')
  })

  it('lets the latest response win when two refetches overlap', async () => {
    const resolvers: Array<(value: string) => void> = []
    const queryFn = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolvers.push(resolve)
        }),
    )
    const { result } = renderHook(() => useSupabaseQuery(queryFn, false))

    let first: Promise<unknown>
    let second: Promise<unknown>
    act(() => {
      first = result.current.refetch()
      second = result.current.refetch()
    })

    await act(async () => {
      resolvers[1]?.('second')
      resolvers[0]?.('first')
      await Promise.all([first, second])
    })

    expect(result.current.data).toBe('second')
  })

  it('clears previous data when queryFn changes and refetches', async () => {
    const first = vi.fn().mockResolvedValue('first')
    const { result, rerender } = renderHook(({ fn }) => useSupabaseQuery(fn), {
      initialProps: { fn: first },
    })

    await waitFor(() => expect(result.current.data).toBe('first'))

    let resolveSecond: ((value: string) => void) | undefined
    const second = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveSecond = resolve
        }),
    )

    rerender({ fn: second })
    await waitFor(() => expect(result.current.data).toEqual([]))

    await act(async () => {
      resolveSecond?.('second')
      await Promise.resolve()
    })
    expect(result.current.data).toBe('second')
  })

  it('exposes setData for local mutations', async () => {
    const queryFn = vi.fn().mockResolvedValue([])
    const { result } = renderHook(() => useSupabaseQuery(queryFn))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => {
      result.current.setData(['manual'])
    })
    expect(result.current.data).toEqual(['manual'])
  })

  it('keeps a stable default empty value across renders (no fetch loop)', async () => {
    const queryFn = vi.fn().mockResolvedValue([])
    const { result, rerender } = renderHook(() => useSupabaseQuery(queryFn))
    await waitFor(() => expect(result.current.loading).toBe(false))

    rerender()
    rerender()
    expect(queryFn).toHaveBeenCalledTimes(1)
  })
})
