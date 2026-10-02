import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})
vi.mock('../../utils/notifications', () => ({
  notifyInApp: vi.fn(async () => undefined),
}))

import useSupabaseForms from '../useSupabaseForms'
import { notifyInApp } from '../../utils/notifications'
import { supabaseMock } from '../../test/supabaseMock'

const notifyMock = vi.mocked(notifyInApp)

beforeEach(() => {
  supabaseMock.reset()
  notifyMock.mockClear()
})

const formCourse = (overrides: Record<string, unknown> = {}) => ({
  id: 'c1',
  title: 'Curso',
  course_forms: [{ position: 0 }, { position: 1 }],
  enrolled_profiles: [{ id: 's1' }],
  ...overrides,
})

describe('useSupabaseForms', () => {
  it('createForm inserts with the next position and notifies enrolled students', async () => {
    supabaseMock.queue('course_forms', { data: { id: 'f1' }, error: null })
    const { result } = renderHook(() => useSupabaseForms())

    let created: unknown
    await act(async () => {
      created = await result.current.createForm(formCourse(), { title: 'Test' }, 'admin-1')
    })

    expect(created).toEqual({ id: 'f1' })
    const insert = supabaseMock.calls.find(
      (c) => c.table === 'course_forms' && c.method === 'insert',
    )
    expect(insert?.args[0]).toMatchObject({ course_id: 'c1', title: 'Test', position: 2 })
    expect(notifyMock).toHaveBeenCalledTimes(1)
  })

  it('createForm skips notifications when there are no enrolled students', async () => {
    supabaseMock.queue('course_forms', { data: { id: 'f1' }, error: null })
    const { result } = renderHook(() => useSupabaseForms())

    await act(async () => {
      await result.current.createForm(formCourse({ enrolled_profiles: [] }), { title: 'Test' })
    })

    expect(notifyMock).not.toHaveBeenCalled()
  })

  it('createForm returns null and toggles loading off on error', async () => {
    supabaseMock.queue('course_forms', { data: null, error: { message: 'boom' } })
    const { result } = renderHook(() => useSupabaseForms())

    let created: unknown
    await act(async () => {
      created = await result.current.createForm(formCourse(), { title: 'Test' })
    })

    expect(created).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('updateForm and deleteForm report success and failure', async () => {
    supabaseMock.queue('course_forms', { data: null, error: null }, { data: null, error: null })
    const { result } = renderHook(() => useSupabaseForms())

    let ok: unknown
    await act(async () => {
      ok = await result.current.updateForm('f1', { title: 'x' })
    })
    expect(ok).toBe(true)

    await act(async () => {
      ok = await result.current.deleteForm('f1')
    })
    expect(ok).toBe(true)

    supabaseMock.queue('course_forms', { data: null, error: { message: 'boom' } })
    await act(async () => {
      ok = await result.current.updateForm('f1', { title: 'y' })
    })
    expect(ok).toBe(false)
  })

  it('reorderForms succeeds and reports failures', async () => {
    supabaseMock.queue('course_forms', { data: null, error: null }, { data: null, error: null })
    const { result } = renderHook(() => useSupabaseForms())

    let ok: unknown
    await act(async () => {
      ok = await result.current.reorderForms(['f1', 'f2'])
    })
    expect(ok).toBe(true)

    supabaseMock.queue('course_forms', { data: null, error: { message: 'boom' } })
    await act(async () => {
      ok = await result.current.reorderForms(['f1'])
    })
    expect(ok).toBe(false)
  })

  it('saveFormQuestions normalizes the payload through the RPC', async () => {
    supabaseMock.queue('rpc:save_form_questions', { data: [{ id: 'q9' }], error: null })
    const { result } = renderHook(() => useSupabaseForms())

    let saved: unknown
    await act(async () => {
      saved = await result.current.saveFormQuestions('f1', [
        { id: 'temp-1', question_text: 'nueva', type: 'short_text' },
        { id: 'q9', question_text: 'A', type: 'short_text', required: true },
        { question_text: 'B', type: 'single_choice', options: ['x', '', 'y'] },
        { question_text: 'C', type: 'scale', options: ['x'] },
      ] as never)
    })

    expect(saved).toEqual([{ id: 'q9' }])
    const rpc = supabaseMock.calls.find((c) => c.method === 'save_form_questions')
    const pQuestions = rpc?.args[0].p_questions
    expect(pQuestions[0]).toMatchObject({ id: null, position: 0 })
    expect(pQuestions[1]).toMatchObject({ id: 'q9', required: true, position: 1 })
    expect(pQuestions[2]).toMatchObject({ options: ['x', 'y'], position: 2 })
    expect(pQuestions[3]).toMatchObject({ options: [], position: 3 })
  })

  it('saveFormQuestions returns null on RPC error', async () => {
    supabaseMock.queue('rpc:save_form_questions', { data: null, error: { message: 'boom' } })
    const { result } = renderHook(() => useSupabaseForms())

    let saved: unknown
    await act(async () => {
      saved = await result.current.saveFormQuestions('f1', [])
    })
    expect(saved).toBeNull()
  })

  it('fetchFormResponses returns rows or an empty list on error', async () => {
    supabaseMock.queue('form_submissions', { data: [{ id: 'sub1' }], error: null })
    const { result } = renderHook(() => useSupabaseForms())

    let rows: unknown
    await act(async () => {
      rows = await result.current.fetchFormResponses('f1')
    })
    expect(rows).toEqual([{ id: 'sub1' }])

    supabaseMock.queue('form_submissions', { data: null, error: { message: 'boom' } })
    await act(async () => {
      rows = await result.current.fetchFormResponses('f1')
    })
    expect(rows).toEqual([])
  })

  it('fetchFormForStudent attaches ordered questions and tolerates missing questions', async () => {
    supabaseMock.queue('course_forms', { data: { id: 'f1' }, error: null })
    supabaseMock.queue('form_questions', { data: [{ id: 'q1' }], error: null })
    const { result } = renderHook(() => useSupabaseForms())

    let form: Record<string, unknown> = {}
    await act(async () => {
      form = await result.current.fetchFormForStudent('f1')
    })
    expect(form).toMatchObject({ id: 'f1', form_questions: [{ id: 'q1' }] })

    supabaseMock.queue('course_forms', { data: { id: 'f1' }, error: null })
    supabaseMock.queue('form_questions', { data: null, error: { message: 'boom' } })
    await act(async () => {
      form = await result.current.fetchFormForStudent('f1')
    })
    expect(form).toMatchObject({ id: 'f1', form_questions: [] })
  })

  it('fetchMySubmissions skips empty input, indexes by form and handles errors', async () => {
    supabaseMock.queue('form_submissions', {
      data: [
        { form_id: 'f1', updated_at: 'a' },
        { form_id: 'f2', updated_at: 'b' },
      ],
      error: null,
    })
    const { result } = renderHook(() => useSupabaseForms())

    let empty: unknown
    await act(async () => {
      empty = await result.current.fetchMySubmissions('s1', [])
    })
    expect(empty).toEqual({})

    let map: Record<string, unknown> = {}
    await act(async () => {
      map = await result.current.fetchMySubmissions('s1', ['f1', 'f2'])
    })
    expect(Object.keys(map)).toEqual(['f1', 'f2'])

    supabaseMock.queue('form_submissions', { data: null, error: { message: 'boom' } })
    await act(async () => {
      map = await result.current.fetchMySubmissions('s1', ['f1'])
    })
    expect(map).toEqual({})
  })

  it('fetchMySubmissionDetail returns submission answers or empty shapes', async () => {
    supabaseMock.queue('form_submissions', { data: { id: 'sub1' }, error: null })
    supabaseMock.queue('form_answers', { data: [{ question_id: 'q1' }], error: null })
    const { result } = renderHook(() => useSupabaseForms())

    let detail: Record<string, unknown> = {}
    await act(async () => {
      detail = await result.current.fetchMySubmissionDetail('f1', 's1')
    })
    expect(detail.submission).toEqual({ id: 'sub1' })
    expect(Object.keys(detail.answersByQuestionId as object)).toEqual(['q1'])

    supabaseMock.queue('form_submissions', { data: null, error: null })
    await act(async () => {
      detail = await result.current.fetchMySubmissionDetail('f1', 's1')
    })
    expect(detail).toEqual({ submission: null, answersByQuestionId: {} })

    supabaseMock.queue('form_submissions', { data: { id: 'sub1' }, error: null })
    supabaseMock.queue('form_answers', { data: null, error: { message: 'boom' } })
    await act(async () => {
      detail = await result.current.fetchMySubmissionDetail('f1', 's1')
    })
    expect(detail).toEqual({ submission: { id: 'sub1' }, answersByQuestionId: {} })
  })

  it('submitForm maps answers by type and notifies the creator', async () => {
    supabaseMock.queue('rpc:submit_form', { data: null, error: null })
    const { result } = renderHook(() => useSupabaseForms())

    const form = { id: 'f1', title: 'F', created_by: 'admin-1' }
    const questions = [
      { id: 'q1', type: 'short_text' },
      { id: 'q2', type: 'single_choice' },
      { id: 'q3', type: 'scale' },
      { id: 'q4', type: 'file_upload' },
    ]
    const answers = {
      q1: { value_text: 'hi', value_options: ['x'] },
      q2: { value_options: ['a'] },
      q3: { value_number: 4 },
      q4: { file_path: 'p', file_name: 'n' },
    }

    let ok: unknown
    await act(async () => {
      ok = await result.current.submitForm(form as never, questions as never, answers, 's1')
    })

    expect(ok).toBe(true)
    const rpc = supabaseMock.calls.find((c) => c.method === 'submit_form')
    const pAnswers = rpc?.args[0].p_answers
    expect(pAnswers[0]).toMatchObject({ value_text: 'hi', value_options: null })
    expect(pAnswers[1]).toMatchObject({ value_options: ['a'] })
    expect(pAnswers[2]).toMatchObject({ value_number: 4 })
    expect(pAnswers[3]).toMatchObject({ file_path: 'p', file_name: 'n' })
    expect(notifyMock).toHaveBeenCalledTimes(1)
  })

  it('submitForm does not notify the author themselves and reports RPC errors', async () => {
    supabaseMock.queue('rpc:submit_form', { data: null, error: null })
    const { result } = renderHook(() => useSupabaseForms())

    await act(async () => {
      await result.current.submitForm(
        { id: 'f1', title: 'F', created_by: 's1' } as never,
        [] as never,
        {},
        's1',
      )
    })
    expect(notifyMock).not.toHaveBeenCalled()

    supabaseMock.queue('rpc:submit_form', { data: null, error: { message: 'boom' } })
    let ok: unknown
    await act(async () => {
      ok = await result.current.submitForm({ id: 'f1', title: 'F' } as never, [], {}, 's1')
    })
    expect(ok).toBe(false)
  })
})
