import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})
vi.mock('../../utils/notifications', () => ({
  notifyInApp: vi.fn(async () => undefined),
}))

import useSupabaseTasks from '../useSupabaseTasks'
import { notifyInApp } from '../../utils/notifications'
import { supabaseMock } from '../../test/supabaseMock'

const notifyMock = vi.mocked(notifyInApp)

beforeEach(() => {
  supabaseMock.reset()
  notifyMock.mockClear()
})

const renderTasks = async () => {
  const hook = renderHook(() => useSupabaseTasks())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useSupabaseTasks', () => {
  it('loads tasks without checklist items and skips auth', async () => {
    supabaseMock.queue('tasks', {
      data: [{ id: 't1', title: 'A', task_checklist_items: [] }],
      error: null,
    })

    const { result } = await renderTasks()

    expect(result.current.tasks).toHaveLength(1)
    expect(supabaseMock.calls.some((c) => c.table === 'auth')).toBe(false)
  })

  it('computes checklist progress for course tasks', async () => {
    supabaseMock.queue('tasks', {
      data: [
        {
          id: 't1',
          course_id: 'c1',
          task_checklist_items: [{ id: 'i1' }, { id: 'i2' }],
        },
      ],
      error: null,
    })
    supabaseMock.setSession({ user: { id: 's1' } })
    supabaseMock.queue('checklist_progress', { data: [{ item_id: 'i1' }], error: null })

    const { result } = await renderTasks()

    expect(result.current.tasks[0].checklist_total).toBe(2)
    expect(result.current.tasks[0].checklist_completed).toBe(1)
    expect(result.current.tasks[0].checklist_percent).toBe(50)
  })

  it('skips progress when there is no logged in user', async () => {
    supabaseMock.queue('tasks', {
      data: [{ id: 't1', course_id: 'c1', task_checklist_items: [{ id: 'i1' }] }],
      error: null,
    })

    const { result } = await renderTasks()

    expect(result.current.tasks[0].checklist_total).toBeUndefined()
    expect(supabaseMock.calls.some((c) => c.table === 'checklist_progress')).toBe(false)
  })

  it('keeps rows untouched when progress fails', async () => {
    supabaseMock.queue('tasks', {
      data: [{ id: 't1', course_id: 'c1', task_checklist_items: [{ id: 'i1' }] }],
      error: null,
    })
    supabaseMock.setSession({ user: { id: 's1' } })
    supabaseMock.queue('checklist_progress', { data: null, error: { message: 'boom' } })

    const { result } = await renderTasks()

    expect(result.current.tasks[0].checklist_total).toBeUndefined()
  })

  it('does not augment standalone tasks with no course', async () => {
    supabaseMock.queue('tasks', {
      data: [{ id: 't1', course_id: null, task_checklist_items: [{ id: 'i1' }] }],
      error: null,
    })
    supabaseMock.setSession({ user: { id: 's1' } })
    supabaseMock.queue('checklist_progress', { data: [{ item_id: 'i1' }], error: null })

    const { result } = await renderTasks()

    expect(result.current.tasks[0].checklist_total).toBeUndefined()
  })

  it('surfaces fetch errors', async () => {
    supabaseMock.queue('tasks', { data: null, error: { message: 'nope' } })

    const { result } = renderHook(() => useSupabaseTasks())
    await waitFor(() => expect(result.current.error).toBeTruthy())
  })

  it('addTasks returns false with no student ids', async () => {
    supabaseMock.queue('tasks', { data: [], error: null })
    const { result } = await renderTasks()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addTasks({ title: 'x', studentIds: [] })
    })

    expect(returned).toBe(false)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('addTasks inserts one row per student and notifies each with its reference', async () => {
    supabaseMock.queue(
      'tasks',
      { data: [], error: null },
      {
        data: [
          { id: 't1', student_id: 's1' },
          { id: 't2', student_id: 's2' },
        ],
        error: null,
      },
      { data: [], error: null },
    )
    const { result } = await renderTasks()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addTasks({
        title: 'Tarea',
        studentIds: ['s1', 's2'],
        assignedBy: 'admin',
        dueDate: '2026-01-01',
      })
    })

    expect(returned).toBe(true)
    const insertCall = supabaseMock.calls.find((c) => c.table === 'tasks' && c.method === 'insert')
    expect(insertCall?.args[0]).toHaveLength(2)
    expect(notifyMock).toHaveBeenCalledTimes(1)
    expect(notifyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        senderId: 'admin',
        referenceType: 'task',
        recipients: [
          { id: 's1', referenceId: 't1' },
          { id: 's2', referenceId: 't2' },
        ],
      }),
    )
  })

  it('addTasks returns false when the insert fails', async () => {
    supabaseMock.queue(
      'tasks',
      { data: [], error: null },
      { data: null, error: { message: 'insert failed' } },
    )
    const { result } = await renderTasks()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addTasks({ title: 'x', studentIds: ['s1'] })
    })

    expect(returned).toBe(false)
    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('addTask wraps a single student', async () => {
    supabaseMock.queue(
      'tasks',
      { data: [], error: null },
      { data: [{ id: 't1', student_id: 's1' }], error: null },
      { data: [], error: null },
    )
    const { result } = await renderTasks()

    let returned: unknown
    await act(async () => {
      returned = await result.current.addTask({ title: 'Uno', studentId: 's1' })
    })

    expect(returned).toBe(true)
    const insertCall = supabaseMock.calls.find((c) => c.table === 'tasks' && c.method === 'insert')
    expect(insertCall?.args[0]).toHaveLength(1)
  })

  it('updateTask cleans undefined values and patches local state', async () => {
    supabaseMock.queue(
      'tasks',
      { data: [{ id: 't1', title: 'Vieja', status: 'Pendiente' }], error: null },
      { data: null, error: null },
    )
    const { result } = await renderTasks()

    let returned: unknown
    await act(async () => {
      returned = await result.current.updateTask('t1', { title: 'Nueva', due_date: undefined })
    })

    expect(returned).toBe(true)
    expect(result.current.tasks[0].title).toBe('Nueva')
    const updateCall = supabaseMock.calls.find((c) => c.table === 'tasks' && c.method === 'update')
    expect(updateCall?.args[0]).not.toHaveProperty('due_date')
    expect(updateCall?.args[0]).toHaveProperty('updated_at')
  })

  it('updateTask returns false on error', async () => {
    supabaseMock.queue(
      'tasks',
      { data: [{ id: 't1', title: 'Vieja' }], error: null },
      { data: null, error: { message: 'boom' } },
    )
    const { result } = await renderTasks()

    let returned: unknown
    await act(async () => {
      returned = await result.current.updateTask('t1', { title: 'Nueva' })
    })

    expect(returned).toBe(false)
    expect(result.current.tasks[0].title).toBe('Vieja')
  })

  it('deleteTask removes the row locally and reports failures', async () => {
    supabaseMock.queue(
      'tasks',
      { data: [{ id: 't1' }, { id: 't2' }], error: null },
      { data: null, error: null },
    )
    const { result } = await renderTasks()

    await act(async () => {
      await result.current.deleteTask('t1')
    })
    expect(result.current.tasks.map((t: { id: string }) => t.id)).toEqual(['t2'])

    supabaseMock.queue('tasks', { data: null, error: { message: 'boom' } })
    let returned: unknown
    await act(async () => {
      returned = await result.current.deleteTask('t2')
    })
    expect(returned).toBe(false)
    expect(result.current.tasks).toHaveLength(1)
  })

  it('changeTaskStatus marks completion at 100 progress', async () => {
    supabaseMock.queue(
      'tasks',
      { data: [{ id: 't1', status: 'Pendiente', progress: 0 }], error: null },
      { data: null, error: null },
    )
    const { result } = await renderTasks()

    await act(async () => {
      await result.current.changeTaskStatus('t1', 'Completado')
    })

    const updateCall = supabaseMock.calls
      .filter((c) => c.table === 'tasks' && c.method === 'update')
      .pop()
    expect(updateCall?.args[0]).toMatchObject({ status: 'Completado', progress: 100 })
  })

  it('changeTaskProgress clamps values and rejects NaN', async () => {
    supabaseMock.queue(
      'tasks',
      { data: [{ id: 't1', status: 'Pendiente' }], error: null },
      { data: null, error: null },
    )
    const { result } = await renderTasks()

    let invalid: unknown
    await act(async () => {
      invalid = await result.current.changeTaskProgress('t1', 'abc')
    })
    expect(invalid).toBe(false)

    await act(async () => {
      await result.current.changeTaskProgress('t1', 150)
    })
    const updateCall = supabaseMock.calls
      .filter((c) => c.table === 'tasks' && c.method === 'update')
      .pop()
    expect(updateCall?.args[0]).toMatchObject({ progress: 100, status: 'Completado' })
  })
})
