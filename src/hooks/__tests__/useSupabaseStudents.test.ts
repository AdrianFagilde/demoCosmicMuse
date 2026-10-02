import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})

import useSupabaseStudents from '../useSupabaseStudents'
import { supabaseMock } from '../../test/supabaseMock'

beforeEach(() => {
  supabaseMock.reset()
})

const renderStudents = async () => {
  const hook = renderHook(() => useSupabaseStudents())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useSupabaseStudents', () => {
  it('loads the roster with an explicit column list', async () => {
    supabaseMock.queue('profiles_with_metrics', {
      data: [{ id: 's1', full_name: 'Ana' }],
      error: null,
    })

    const { result } = await renderStudents()

    expect(result.current.students).toHaveLength(1)
    const select = supabaseMock.calls.find(
      (c) => c.table === 'profiles_with_metrics' && c.method === 'select',
    )
    expect(select?.args[0]).not.toBe('*')
  })

  it('surfaces roster errors', async () => {
    supabaseMock.queue('profiles_with_metrics', { data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useSupabaseStudents())
    await waitFor(() => expect(result.current.error).toBeTruthy())
  })

  it('finds a student by string id', async () => {
    supabaseMock.queue('profiles_with_metrics', {
      data: [{ id: '1', full_name: 'Ana' }],
      error: null,
    })
    const { result } = await renderStudents()

    expect(result.current.getStudent('1')).toMatchObject({ full_name: 'Ana' })
    expect(result.current.getStudent('999')).toBeUndefined()
  })

  it('updates student metrics locally on success', async () => {
    supabaseMock.queue('profiles_with_metrics', {
      data: [{ id: 's1', progress: 10, attendance: 20 }],
      error: null,
    })
    const { result } = await renderStudents()

    let returned: unknown
    await act(async () => {
      returned = await result.current.updateStudentMetrics('s1', '55', '60')
    })

    expect(returned).toBe(true)
    expect(result.current.students[0]).toMatchObject({ progress: 55, attendance: 60 })
    expect(
      supabaseMock.calls.some((c) => c.table === 'student_metrics' && c.method === 'upsert'),
    ).toBe(true)
  })

  it('returns false when updating metrics fails', async () => {
    supabaseMock.queue(
      'profiles_with_metrics',
      { data: [{ id: 's1', progress: 10, attendance: 20 }], error: null },
      { data: null, error: null },
    )
    supabaseMock.queue('student_metrics', { data: null, error: { message: 'boom' } })
    const { result } = await renderStudents()

    let returned: unknown
    await act(async () => {
      returned = await result.current.updateStudentMetrics('s1', 55, 60)
    })

    expect(returned).toBe(false)
  })

  it('builds the dashboard summary', async () => {
    supabaseMock.queue('profiles_with_metrics', { data: [], error: null })
    supabaseMock.queue('profiles', { count: 3, data: null, error: null })
    supabaseMock.queue('instruments', {
      data: [{ name: 'Piano' }, { name: 'Guitarra' }],
      error: null,
    })
    supabaseMock.queue(
      'lessons',
      { count: 2, data: null, error: null },
      { data: [{ teacher: 'A' }, { teacher: 'B' }, { teacher: 'A' }, { teacher: null }] },
    )
    const { result } = await renderStudents()

    let summary: Record<string, unknown> | undefined
    await act(async () => {
      summary = await result.current.getSummary()
    })

    expect(summary).toEqual({
      activeStudents: 3,
      lessonsThisWeek: 2,
      teachers: 2,
      availableInstruments: ['Piano', 'Guitarra'],
    })
  })
})
