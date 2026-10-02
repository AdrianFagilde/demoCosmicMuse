import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

const { authState } = vi.hoisted(() => ({
  authState: {
    user: { id: 'viewer' } as { id: string } | null,
    profile: { role: 'student' } as { role: string } | null,
  },
}))

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => authState,
}))

import useSupabaseTask from '../useSupabaseTask'
import { supabaseMock } from '../../test/supabaseMock'

beforeEach(() => {
  supabaseMock.reset()
  authState.user = { id: 'viewer' }
  authState.profile = { role: 'student' }
})

const taskRow = (overrides: Record<string, unknown> = {}) => ({
  id: 't1',
  course_id: 'c1',
  student_id: 's9',
  task_checklist_items: [
    { id: 'i1', position: 0 },
    { id: 'i2', position: 1 },
  ],
  ...overrides,
})

const renderTask = async (taskId: string | null = 't1') => {
  const hook = renderHook(() => useSupabaseTask(taskId))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useSupabaseTask', () => {
  it('does nothing without a task id', async () => {
    const { result } = await renderTask(null)

    expect(result.current.task).toBeNull()
    expect(supabaseMock.calls.some((c) => c.table === 'tasks')).toBe(false)
  })

  it('resolves student progress for a course task', async () => {
    supabaseMock.queue('tasks', { data: taskRow(), error: null })
    supabaseMock.queue('checklist_progress', { data: [{ item_id: 'i1' }], error: null })

    const { result } = await renderTask()

    expect(result.current.progressStudentId).toBe('viewer')
    expect(result.current.items).toHaveLength(2)
    expect(result.current.completedItems).toBe(1)
    expect(result.current.totalItems).toBe(2)
    expect(result.current.percent).toBe(50)
    expect(result.current.canEditProgress).toBe(true)
  })

  it('hides progress from an admin viewing a course task', async () => {
    authState.profile = { role: 'admin' }
    supabaseMock.queue('tasks', { data: taskRow(), error: null })

    const { result } = await renderTask()

    expect(result.current.progressStudentId).toBeNull()
    expect(result.current.canEditProgress).toBe(false)
    expect(supabaseMock.calls.some((c) => c.table === 'checklist_progress')).toBe(false)
  })

  it('uses the assignee for individual tasks', async () => {
    supabaseMock.queue('tasks', { data: taskRow({ course_id: null }), error: null })
    supabaseMock.queue('checklist_progress', { data: [], error: null })

    const { result } = await renderTask()

    expect(result.current.progressStudentId).toBe('s9')
    expect(result.current.canEditProgress).toBe(false)
  })

  it('returns null when the task does not exist', async () => {
    supabaseMock.queue('tasks', { data: null, error: null })

    const { result } = await renderTask()

    expect(result.current.task).toBeNull()
  })

  it('surfaces fetch and progress errors', async () => {
    supabaseMock.queue('tasks', { data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useSupabaseTask('t1'))
    await waitFor(() => expect(result.current.error).toBeTruthy())

    supabaseMock.queue('tasks', { data: taskRow(), error: null })
    supabaseMock.queue('checklist_progress', { data: null, error: { message: 'boom' } })
    const second = await renderTask()
    expect(second.result.current.doneSet.size).toBe(0)
  })

  it('toggles checklist items optimistically and rolls back on error', async () => {
    supabaseMock.queue('tasks', { data: taskRow(), error: null })
    supabaseMock.queue(
      'checklist_progress',
      { data: [{ item_id: 'i1' }], error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: { message: 'boom' } },
    )
    const { result } = await renderTask()

    await act(async () => {
      await result.current.toggleItem('i2', true)
    })
    expect([...result.current.doneSet].sort()).toEqual(['i1', 'i2'])

    await act(async () => {
      await result.current.toggleItem('i1', false)
    })
    expect([...result.current.doneSet]).toEqual(['i2'])

    let ok: unknown
    await act(async () => {
      ok = await result.current.toggleItem('i3', true)
    })
    expect(ok).toBe(false)
    expect([...result.current.doneSet]).toEqual(['i2'])
  })

  it('refuses to toggle without a progress student', async () => {
    authState.profile = { role: 'admin' }
    supabaseMock.queue('tasks', { data: taskRow(), error: null })
    const { result } = await renderTask()

    let ok: unknown
    await act(async () => {
      ok = await result.current.toggleItem('i1', true)
    })
    expect(ok).toBe(false)
  })

  it('updateTask cleans undefined values and patches the task', async () => {
    supabaseMock.queue('tasks', { data: taskRow(), error: null }, { data: null, error: null })
    const { result } = await renderTask()

    let ok: unknown
    await act(async () => {
      ok = await result.current.updateTask({ title: 'Nuevo', due_date: undefined })
    })
    expect(ok).toBe(true)
    expect((result.current.task as { title?: string } | null)?.title).toBe('Nuevo')
    const update = supabaseMock.calls.find((c) => c.table === 'tasks' && c.method === 'update')
    expect(update?.args[0]).not.toHaveProperty('due_date')

    supabaseMock.queue('tasks', { data: null, error: { message: 'boom' } })
    await act(async () => {
      ok = await result.current.updateTask({ title: 'x' })
    })
    expect(ok).toBe(false)
  })

  it('addChecklistItem appends and sorts items', async () => {
    supabaseMock.queue('tasks', {
      data: taskRow({ task_checklist_items: [{ id: 'i1', position: 0 }] }),
      error: null,
    })
    supabaseMock.queue('task_checklist_items', {
      data: { id: 'i0', label: 'nuevo', position: 0, created_at: 'now' },
      error: null,
    })
    const { result } = await renderTask()

    let item: unknown
    await act(async () => {
      item = await result.current.addChecklistItem('nuevo', 0)
    })
    expect(item).toMatchObject({ id: 'i0' })
    expect(result.current.items.map((i: { id: string }) => i.id)).toEqual(['i0', 'i1'])
  })

  it('addChecklistItem returns null on error', async () => {
    supabaseMock.queue('tasks', { data: taskRow(), error: null })
    supabaseMock.queue('task_checklist_items', { data: null, error: { message: 'boom' } })
    const { result } = await renderTask()

    let item: unknown
    await act(async () => {
      item = await result.current.addChecklistItem('nuevo', 0)
    })
    expect(item).toBeNull()
  })

  it('deleteChecklistItem removes locally and reports failures', async () => {
    supabaseMock.queue('tasks', { data: taskRow(), error: null })
    supabaseMock.queue(
      'task_checklist_items',
      { data: null, error: null },
      { data: null, error: { message: 'boom' } },
    )
    const { result } = await renderTask()

    let ok: unknown
    await act(async () => {
      ok = await result.current.deleteChecklistItem('i1')
    })
    expect(ok).toBe(true)
    expect(result.current.items.map((i: { id: string }) => i.id)).toEqual(['i2'])

    await act(async () => {
      ok = await result.current.deleteChecklistItem('i2')
    })
    expect(ok).toBe(false)
    expect(result.current.items).toHaveLength(1)
  })

  it('reorderChecklistItems reorders and reports failures', async () => {
    supabaseMock.queue('tasks', { data: taskRow(), error: null })
    supabaseMock.queue(
      'task_checklist_items',
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: { message: 'boom' } },
    )
    const { result } = await renderTask()

    let ok: unknown
    await act(async () => {
      ok = await result.current.reorderChecklistItems(['i2', 'i1'])
    })
    expect(ok).toBe(true)
    expect(result.current.items.map((i: { id: string }) => i.id)).toEqual(['i2', 'i1'])

    await act(async () => {
      ok = await result.current.reorderChecklistItems(['i1'])
    })
    expect(ok).toBe(false)
  })

  it('totalItems and percent are zero without a task', async () => {
    const { result } = await renderTask(null)
    expect(result.current.totalItems).toBe(0)
    expect(result.current.percent).toBe(0)
  })
})
