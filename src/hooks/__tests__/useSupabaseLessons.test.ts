import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})
vi.mock('../../utils/notifications', () => ({
  notifyInApp: vi.fn(async () => undefined),
}))

import useSupabaseLessons from '../useSupabaseLessons'
import { notifyInApp } from '../../utils/notifications'
import { supabaseMock } from '../../test/supabaseMock'

const notifyMock = vi.mocked(notifyInApp)

beforeEach(() => {
  supabaseMock.reset()
  notifyMock.mockClear()
})

const renderLessons = async (studentId?: string) => {
  const hook = renderHook(() => useSupabaseLessons(studentId))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useSupabaseLessons', () => {
  it('loads every lesson when no student is given', async () => {
    supabaseMock.queue('lessons', { data: [{ id: 'l1' }], error: null })

    const { result } = await renderLessons()

    expect(result.current.lessons).toHaveLength(1)
    expect(supabaseMock.calls.some((c) => c.table === 'lessons' && c.method === 'eq')).toBe(false)
  })

  it('filters by student when an id is given', async () => {
    supabaseMock.queue('lessons', { data: [{ id: 'l1', student_id: 's1' }], error: null })

    await renderLessons('s1')

    const eqCall = supabaseMock.calls.find((c) => c.table === 'lessons' && c.method === 'eq')
    expect(eqCall?.args).toEqual(['student_id', 's1'])
  })

  it('surfaces fetch errors', async () => {
    supabaseMock.queue('lessons', { data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useSupabaseLessons())
    await waitFor(() => expect(result.current.error).toBeTruthy())
  })

  it('addLesson inserts, notifies and refetches', async () => {
    supabaseMock.queue(
      'lessons',
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
    )
    const { result } = await renderLessons()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addLesson({
        studentId: 's1',
        instrument: 'Piano',
        lessonStart: '2026-04-02T15:00:00.000Z',
        duration: 60,
        teacher: 'Ana',
        createdBy: 'admin-1',
      })
    })

    expect(returned).toBe(true)
    const insert = supabaseMock.calls.find((c) => c.table === 'lessons' && c.method === 'insert')
    expect(insert?.args[0]).toMatchObject({ student_id: 's1', instrument: 'Piano', duration: 60 })
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Nueva clase programada', senderId: 'admin-1' }),
    )
  })

  it('addLesson handles a missing date', async () => {
    supabaseMock.queue(
      'lessons',
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
    )
    const { result } = await renderLessons()

    await act(async () => {
      await result.current.addLesson({ studentId: 's1', instrument: 'Piano' })
    })

    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('fecha pendiente') }),
    )
  })

  it('addLesson returns false when the insert fails', async () => {
    supabaseMock.queue(
      'lessons',
      { data: [], error: null },
      { data: null, error: { message: 'boom' } },
    )
    const { result } = await renderLessons()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addLesson({ studentId: 's1', instrument: 'Piano' })
    })

    expect(returned).toBe(false)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('updateLesson reports success and failures', async () => {
    supabaseMock.queue(
      'lessons',
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
    )
    const { result } = await renderLessons()

    let returned: unknown
    await act(async () => {
      returned = await result.current.updateLesson('l1', { teacher: 'Luis' })
    })
    expect(returned).toBe(true)

    supabaseMock.queue('lessons', { data: null, error: { message: 'boom' } })
    await act(async () => {
      returned = await result.current.updateLesson('l1', { teacher: 'X' })
    })
    expect(returned).toBe(false)
  })

  it('deleteLesson removes the row locally and reports failures', async () => {
    supabaseMock.queue('lessons', {
      data: [{ id: 'l1' }, { id: 'l2' }],
      error: null,
    })
    const { result } = await renderLessons()

    await act(async () => {
      await result.current.deleteLesson('l1')
    })
    expect(result.current.lessons.map((l: { id: string }) => l.id)).toEqual(['l2'])

    supabaseMock.queue('lessons', { data: null, error: { message: 'boom' } })
    let returned: unknown
    await act(async () => {
      returned = await result.current.deleteLesson('l2')
    })
    expect(returned).toBe(false)
    expect(result.current.lessons).toHaveLength(1)
  })
})
