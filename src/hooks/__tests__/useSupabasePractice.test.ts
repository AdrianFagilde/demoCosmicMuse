import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})

import useSupabasePractice from '../useSupabasePractice'
import { supabaseMock } from '../../test/supabaseMock'

beforeEach(() => {
  supabaseMock.reset()
})

const EMPTY_STREAK = { current_streak: 0, longest_streak: 0, last_practice_date: null }

const queueFetch = (sessions: unknown[] = [], streak: unknown = null) => {
  supabaseMock.queue('practice_sessions', { data: sessions, error: null })
  supabaseMock.queue('practice_streaks', { data: streak, error: null })
  supabaseMock.queue('rpc:get_weekly_practice_summary', { data: [], error: null })
}

const renderPractice = async (studentId = 's1') => {
  const hook = renderHook(() => useSupabasePractice(studentId))
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useSupabasePractice', () => {
  it('returns empty state without a student id', async () => {
    const { result } = await renderPractice('')

    expect(result.current.sessions).toEqual([])
    expect(result.current.streak).toEqual(EMPTY_STREAK)
    expect(supabaseMock.calls.some((c) => c.table === 'practice_sessions')).toBe(false)
  })

  it('loads sessions, streak and weekly summary', async () => {
    queueFetch([{ id: 'p1' }], { current_streak: 3, longest_streak: 5 })

    const { result } = await renderPractice()

    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.streak).toMatchObject({ current_streak: 3 })
  })

  it('falls back to an empty streak when there is no row', async () => {
    supabaseMock.queue('practice_sessions', { data: [], error: null })
    supabaseMock.queue('practice_streaks', {
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    })
    supabaseMock.queue('rpc:get_weekly_practice_summary', { data: null, error: null })

    const { result } = await renderPractice()

    expect(result.current.streak).toEqual(EMPTY_STREAK)
    expect(result.current.weeklySummary).toEqual([])
  })

  it('startPractice stops any open session then inserts a new one', async () => {
    supabaseMock.queue(
      'practice_sessions',
      { data: [{ id: 'p0' }], error: null },
      { data: null, error: null },
      { data: { id: 'p1', student_id: 's1' }, error: null },
    )
    supabaseMock.queue('practice_streaks', { data: null, error: null })
    supabaseMock.queue('rpc:get_weekly_practice_summary', { data: [], error: null })

    const { result } = await renderPractice()

    let session: unknown
    await act(async () => {
      session = await result.current.startPractice({ taskId: 't1' })
    })

    expect(session).toMatchObject({ id: 'p1' })
    expect(result.current.sessions[0]).toMatchObject({ id: 'p1' })
    const insert = supabaseMock.calls.find(
      (c) => c.table === 'practice_sessions' && c.method === 'insert',
    )
    expect(insert?.args[0]).toMatchObject({ student_id: 's1', task_id: 't1' })
  })

  it('startPractice returns null without a student or on insert error', async () => {
    const noStudent = await renderPractice('')
    expect(await noStudent.result.current.startPractice()).toBeNull()

    supabaseMock.queue(
      'practice_sessions',
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: { message: 'boom' } },
    )
    supabaseMock.queue('practice_streaks', { data: null, error: null })
    supabaseMock.queue('rpc:get_weekly_practice_summary', { data: [], error: null })
    const { result } = await renderPractice()

    let session: unknown
    await act(async () => {
      session = await result.current.startPractice()
    })
    expect(session).toBeNull()
  })

  it('stopPractice closes the most recent open session and refetches', async () => {
    supabaseMock.queue(
      'practice_sessions',
      { data: [{ id: 'p0' }], error: null },
      { data: { id: 'p0' }, error: null },
      { data: { id: 'p0', ended_at: 'now' }, error: null },
      { data: [{ id: 'p0', ended_at: 'now' }], error: null },
    )
    supabaseMock.queue('practice_streaks', { data: null, error: null })
    supabaseMock.queue('rpc:get_weekly_practice_summary', { data: [], error: null })

    const { result } = await renderPractice()

    let closed: unknown
    await act(async () => {
      closed = await result.current.stopPractice()
    })
    expect(closed).toMatchObject({ id: 'p0', ended_at: 'now' })
  })

  it('stopPractice returns null when there is no open session', async () => {
    supabaseMock.queue('practice_sessions', { data: [], error: null }, { data: null, error: null })
    supabaseMock.queue('practice_streaks', { data: null, error: null })
    supabaseMock.queue('rpc:get_weekly_practice_summary', { data: [], error: null })
    const { result } = await renderPractice()

    let closed: unknown
    await act(async () => {
      closed = await result.current.stopPractice()
    })
    expect(closed).toBeNull()
  })

  it('endPractice returns null on error', async () => {
    supabaseMock.queue(
      'practice_sessions',
      { data: [], error: null },
      { data: null, error: { message: 'boom' } },
    )
    supabaseMock.queue('practice_streaks', { data: null, error: null })
    supabaseMock.queue('rpc:get_weekly_practice_summary', { data: [], error: null })
    const { result } = await renderPractice()

    let ended: unknown
    await act(async () => {
      ended = await result.current.endPractice('p1')
    })
    expect(ended).toBeNull()
  })

  it('updatePracticeNotes and deletePractice patch local state', async () => {
    supabaseMock.queue(
      'practice_sessions',
      { data: [{ id: 'p1', notes: '' }], error: null },
      { data: null, error: null },
      { data: null, error: null },
    )
    supabaseMock.queue('practice_streaks', { data: null, error: null })
    supabaseMock.queue('rpc:get_weekly_practice_summary', { data: [], error: null })
    const { result } = await renderPractice()

    await act(async () => {
      await result.current.updatePracticeNotes('p1', 'hola')
    })
    expect(result.current.sessions[0]).toMatchObject({ notes: 'hola' })

    await act(async () => {
      await result.current.deletePractice('p1')
    })
    expect(result.current.sessions).toHaveLength(0)
  })

  it('reports failures for notes and delete', async () => {
    supabaseMock.queue(
      'practice_sessions',
      { data: [{ id: 'p1' }], error: null },
      { data: null, error: { message: 'boom' } },
      { data: null, error: { message: 'boom' } },
    )
    supabaseMock.queue('practice_streaks', { data: null, error: null })
    supabaseMock.queue('rpc:get_weekly_practice_summary', { data: [], error: null })
    const { result } = await renderPractice()

    let notes: unknown
    await act(async () => {
      notes = await result.current.updatePracticeNotes('p1', 'x')
    })
    expect(notes).toBe(false)

    let del: unknown
    await act(async () => {
      del = await result.current.deletePractice('p1')
    })
    expect(del).toBe(false)
  })
})
