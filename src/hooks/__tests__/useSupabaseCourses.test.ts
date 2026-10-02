import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'

vi.mock('../../lib/supabase', async () => {
  const { client } = await import('../../test/supabaseMock')
  return { default: client }
})
vi.mock('../../utils/notifications', () => ({
  notifyInApp: vi.fn(async () => undefined),
}))
vi.mock('../../utils/forms', () => ({
  uploadMaterialFile: vi.fn(),
  deleteCourseFile: vi.fn(),
}))

import useSupabaseCourses from '../useSupabaseCourses'
import { notifyInApp } from '../../utils/notifications'
import { uploadMaterialFile, deleteCourseFile } from '../../utils/forms'
import { supabaseMock } from '../../test/supabaseMock'

const notifyMock = vi.mocked(notifyInApp)
const uploadMock = vi.mocked(uploadMaterialFile)
const deleteFileMock = vi.mocked(deleteCourseFile)

type CourseDetailResult = {
  detail: {
    course_tasks: Array<{ id: string; task_checklist_items: Array<{ id: string }> }>
    course_materials: Array<{ id: string }>
    enrolled_profiles: Array<{ full_name: string }>
  } | null
  error: { message: string } | null
}

beforeEach(() => {
  supabaseMock.reset()
  notifyMock.mockClear()
  uploadMock.mockReset()
  deleteFileMock.mockReset()
})

const renderCourses = async () => {
  const hook = renderHook(() => useSupabaseCourses())
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  return hook
}

describe('useSupabaseCourses', () => {
  it('maps embedded tasks to course_tasks when loading the list', async () => {
    supabaseMock.queue('courses', {
      data: [{ id: 'c1', tasks: [{ id: 't1', position: 0 }] }],
      error: null,
    })

    const { result } = await renderCourses()

    const courses = result.current.courses as Array<{ course_tasks: unknown }>
    expect(courses[0]?.course_tasks).toEqual([{ id: 't1', position: 0 }])
  })

  it('surfaces list errors', async () => {
    supabaseMock.queue('courses', { data: null, error: { message: 'boom' } })

    const { result } = renderHook(() => useSupabaseCourses())
    await waitFor(() => expect(result.current.error).toBeTruthy())
  })

  it('fetchCourseDetail validates the id without hitting the network', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    let detail: Record<string, unknown> = {}
    await act(async () => {
      detail = (await result.current.fetchCourseDetail(undefined)) as never
    })

    expect(detail.error).toMatchObject({ message: expect.stringContaining('identificador') })
    expect(detail.detail).toBeNull()
  })

  it('fetchCourseDetail sorts, groups and enriches the course', async () => {
    supabaseMock.queue(
      'courses',
      { data: [], error: null },
      {
        data: {
          id: 'c1',
          tasks: [
            { id: 't2', position: 1 },
            { id: 't1', position: 0 },
          ],
          course_materials: [
            { id: 'm2', position: 1 },
            { id: 'm1', position: 0 },
          ],
          course_forms: [
            { id: 'f2', position: 1 },
            { id: 'f1', position: 0 },
          ],
          course_enrollments: [{ student_id: 's1' }, { student_id: 's2' }],
        },
        error: null,
      },
    )
    supabaseMock.queue('task_checklist_items', {
      data: [
        { id: 'i2', task_id: 't1', position: 1 },
        { id: 'i1', task_id: 't1', position: 0 },
      ],
      error: null,
    })
    supabaseMock.queue('profiles', {
      data: [
        { id: 's2', full_name: 'Luis' },
        { id: 's1', full_name: 'Ana' },
      ],
      error: null,
    })
    const { result } = await renderCourses()

    let detail: CourseDetailResult = { detail: null, error: null }
    await act(async () => {
      detail = await result.current.fetchCourseDetail('c1')
    })

    expect(detail.detail!.course_tasks.map((t: { id: string }) => t.id)).toEqual(['t1', 't2'])
    expect(
      detail.detail!.course_tasks[0]?.task_checklist_items.map((i: { id: string }) => i.id),
    ).toEqual(['i1', 'i2'])
    expect(detail.detail!.course_materials.map((m: { id: string }) => m.id)).toEqual(['m1', 'm2'])
    expect(detail.detail!.enrolled_profiles.map((p: { full_name: string }) => p.full_name)).toEqual(
      ['Ana', 'Luis'],
    )
  })

  it('fetchCourseDetail tolerates a checklist-items error', async () => {
    supabaseMock.queue(
      'courses',
      { data: [], error: null },
      { data: { id: 'c1', tasks: [{ id: 't1' }], course_enrollments: [] }, error: null },
    )
    supabaseMock.queue('task_checklist_items', { data: null, error: { message: 'boom' } })
    const { result } = await renderCourses()

    let detail: CourseDetailResult = { detail: null, error: null }
    await act(async () => {
      detail = await result.current.fetchCourseDetail('c1')
    })

    expect(detail.detail!.course_tasks[0]?.task_checklist_items).toEqual([])
  })

  it('createCourse, updateCourse and deleteCourse refresh the list', async () => {
    supabaseMock.queue(
      'courses',
      { data: [], error: null },
      { data: { id: 'c1' }, error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
    )
    const { result } = await renderCourses()

    let created: unknown
    await act(async () => {
      created = await result.current.createCourse({ title: 'Nuevo' })
    })
    expect(created).toEqual({ id: 'c1' })

    await act(async () => {
      await result.current.updateCourse('c1', { title: 'x' })
    })
    expect(supabaseMock.calls.some((c) => c.table === 'courses' && c.method === 'update')).toBe(
      true,
    )

    await act(async () => {
      await result.current.deleteCourse('c1')
    })
    expect(supabaseMock.calls.some((c) => c.table === 'courses' && c.method === 'delete')).toBe(
      true,
    )
  })

  it('createCourse returns null on error', async () => {
    supabaseMock.queue(
      'courses',
      { data: [], error: null },
      { data: null, error: { message: 'boom' } },
    )
    const { result } = await renderCourses()

    let created: unknown
    await act(async () => {
      created = await result.current.createCourse({ title: 'x' })
    })
    expect(created).toBeNull()
  })

  it('saveEnrollments inserts, notifies and deletes the diff', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()
    supabaseMock.queue('course_enrollments', { data: null, error: null })

    const course = {
      id: 'c1',
      title: 'Curso',
      course_enrollments: [{ student_id: 'old' }],
    }
    let ok: unknown
    await act(async () => {
      ok = await result.current.saveEnrollments(course, ['new'], 'admin-1')
    })

    expect(ok).toBe(true)
    expect(notifyMock).toHaveBeenCalledTimes(1)
    const remove = supabaseMock.calls.find(
      (c) => c.table === 'course_enrollments' && c.method === 'delete',
    )
    expect(remove).toBeTruthy()
  })

  it('saveEnrollments reports insert and delete failures', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    supabaseMock.queue('course_enrollments', { data: null, error: { message: 'boom' } })
    let ok: unknown
    await act(async () => {
      ok = await result.current.saveEnrollments({ id: 'c1', title: 'C', course_enrollments: [] }, [
        's1',
      ])
    })
    expect(ok).toBe(false)

    supabaseMock.queue('course_enrollments', { data: null, error: { message: 'boom' } })
    await act(async () => {
      ok = await result.current.saveEnrollments(
        { id: 'c1', title: 'C', course_enrollments: [{ student_id: 's1' }] },
        [],
      )
    })
    expect(ok).toBe(false)
  })

  it('saveEnrollments is a no-op when nothing changes', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    let ok: unknown
    await act(async () => {
      ok = await result.current.saveEnrollments(
        { id: 'c1', title: 'C', course_enrollments: [{ student_id: 's1' }] },
        ['s1'],
      )
    })
    expect(ok).toBe(true)
    expect(supabaseMock.calls.some((c) => c.table === 'course_enrollments')).toBe(false)
  })

  it('addTask computes the next position and notifies enrolled students', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()
    supabaseMock.queue('tasks', { data: { id: 't9' }, error: null })

    const course = {
      id: 'c1',
      title: 'Curso',
      course_tasks: [{ position: 0 }, { position: 3 }],
      enrolled_profiles: [{ id: 's1' }],
    }
    let created: unknown
    await act(async () => {
      created = await result.current.addTask(course, { title: 'T' })
    })

    expect(created).toEqual({ id: 't9' })
    const insert = supabaseMock.calls.find((c) => c.table === 'tasks' && c.method === 'insert')
    expect(insert?.args[0]).toMatchObject({ course_id: 'c1', position: 4 })
    expect(notifyMock).toHaveBeenCalledTimes(1)
  })

  it('addTask returns null on error and skips notify without students', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    supabaseMock.queue('tasks', { data: { id: 't9' }, error: null })
    await act(async () => {
      await result.current.addTask({ id: 'c1', title: 'C', enrolled_profiles: [] }, { title: 'T' })
    })
    expect(notifyMock).not.toHaveBeenCalled()

    supabaseMock.queue('tasks', { data: null, error: { message: 'boom' } })
    let created: unknown
    await act(async () => {
      created = await result.current.addTask({ id: 'c1', title: 'C' }, { title: 'T' })
    })
    expect(created).toBeNull()
  })

  it('updateTask, deleteTask and reorders report success and failure', async () => {
    supabaseMock.queue(
      'tasks',
      { data: [], error: null },
      { data: null, error: null },
      { data: null, error: null },
      { data: null, error: null },
    )
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    let ok: unknown
    await act(async () => {
      ok = await result.current.updateTask('t1', { title: 'x' })
    })
    expect(ok).toBe(true)

    await act(async () => {
      ok = await result.current.deleteTask('t1')
    })
    expect(ok).toBe(true)

    await act(async () => {
      ok = await result.current.reorderTasks(['t1', 't2'])
    })
    expect(ok).toBe(true)

    supabaseMock.queue('tasks', { data: null, error: { message: 'boom' } })
    await act(async () => {
      ok = await result.current.updateTask('t1', { title: 'y' })
    })
    expect(ok).toBe(false)
    await act(async () => {
      ok = await result.current.deleteTask('t1')
    })
    expect(ok).toBe(false)
    await act(async () => {
      ok = await result.current.reorderTasks(['t1'])
    })
    expect(ok).toBe(false)
  })

  it('handles checklist item CRUD', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    supabaseMock.queue('task_checklist_items', { data: { id: 'i1' }, error: null })
    let item: unknown
    await act(async () => {
      item = await result.current.addChecklistItem('t1', 'Paso', 0)
    })
    expect(item).toEqual({ id: 'i1' })

    supabaseMock.queue('task_checklist_items', { data: null, error: null })
    let ok: unknown
    await act(async () => {
      ok = await result.current.deleteChecklistItem('i1')
    })
    expect(ok).toBe(true)

    await act(async () => {
      ok = await result.current.reorderChecklistItems([{ id: 'i1' }, { id: 'i2' }])
    })
    expect(ok).toBe(true)

    supabaseMock.queue('task_checklist_items', { data: null, error: { message: 'boom' } })
    await act(async () => {
      item = await result.current.addChecklistItem('t1', 'Paso', 0)
    })
    expect(item).toBeNull()
    await act(async () => {
      ok = await result.current.deleteChecklistItem('i1')
    })
    expect(ok).toBe(false)
  })

  it('manages course progress fetching and toggling', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    let rows: unknown
    await act(async () => {
      rows = await result.current.fetchCourseProgress([])
    })
    expect(rows).toEqual([])

    supabaseMock.queue('checklist_progress', { data: [{ item_id: 'i1' }], error: null })
    await act(async () => {
      rows = await result.current.fetchCourseProgress(['i1'])
    })
    expect(rows).toEqual([{ item_id: 'i1' }])

    await act(async () => {
      await result.current.fetchStudentCourseProgress('s1')
    })
    expect(
      supabaseMock.calls.some((c) => c.table === 'checklist_progress' && c.method === 'eq'),
    ).toBe(true)

    supabaseMock.queue('checklist_progress', { data: null, error: null })
    let ok: unknown
    await act(async () => {
      ok = await result.current.toggleProgressItem('i1', 's1', true)
    })
    expect(ok).toBe(true)

    await act(async () => {
      ok = await result.current.toggleProgressItem('i1', 's1', false)
    })
    expect(ok).toBe(true)

    supabaseMock.queue('checklist_progress', { data: null, error: { message: 'boom' } })
    await act(async () => {
      ok = await result.current.toggleProgressItem('i1', 's1', false)
    })
    expect(ok).toBe(false)
    await act(async () => {
      rows = await result.current.fetchStudentCourseProgress('s1')
    })
    expect(rows).toEqual([])
  })

  it('addMaterial handles text, link and file materials', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    supabaseMock.queue('course_materials', { data: { id: 'm1' }, error: null })
    let material: unknown
    await act(async () => {
      material = await result.current.addMaterial(
        { id: 'c1' },
        { type: 'text', title: 'T', body: 'b' },
        'admin',
      )
    })
    expect(material).toEqual({ id: 'm1' })

    supabaseMock.queue('course_materials', { data: { id: 'm2' }, error: null })
    await act(async () => {
      await result.current.addMaterial(
        { id: 'c1' },
        { type: 'link', title: 'L', url: 'http://x' },
        'admin',
      )
    })

    uploadMock.mockResolvedValue({ path: 'p', fileName: 'f' } as never)
    supabaseMock.queue('course_materials', { data: { id: 'm3' }, error: null })
    await act(async () => {
      await result.current.addMaterial(
        { id: 'c1' },
        { type: 'file', title: 'F', file: {} },
        'admin',
      )
    })
    expect(uploadMock).toHaveBeenCalledTimes(1)
  })

  it('addMaterial bails when a file is missing or uploads fail', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    let material: unknown
    await act(async () => {
      material = await result.current.addMaterial({ id: 'c1' }, { type: 'file', title: 'F' })
    })
    expect(material).toBeNull()

    uploadMock.mockResolvedValue(null as never)
    await act(async () => {
      material = await result.current.addMaterial(
        { id: 'c1' },
        { type: 'file', title: 'F', file: {} },
      )
    })
    expect(material).toBeNull()
  })

  it('addMaterial rolls back the uploaded file when the insert fails', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    uploadMock.mockResolvedValue({ path: 'p', fileName: 'f' } as never)
    supabaseMock.queue('course_materials', { data: null, error: { message: 'boom' } })

    await act(async () => {
      await result.current.addMaterial(
        { id: 'c1', course_materials: [] },
        { type: 'file', title: 'F', file: {} },
      )
    })

    expect(deleteFileMock).toHaveBeenCalledWith('p')
  })

  it('deleteMaterial removes the file and handles errors', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    supabaseMock.queue('course_materials', { data: null, error: null })
    let ok: unknown
    await act(async () => {
      ok = await result.current.deleteMaterial({ id: 'm1', file_path: 'p' })
    })
    expect(ok).toBe(true)
    expect(deleteFileMock).toHaveBeenCalledWith('p')

    supabaseMock.queue('course_materials', { data: null, error: { message: 'boom' } })
    await act(async () => {
      ok = await result.current.deleteMaterial({ id: 'm1' })
    })
    expect(ok).toBe(false)
  })

  it('reorderMaterials succeeds and reports failures', async () => {
    supabaseMock.queue('courses', { data: [], error: null })
    const { result } = await renderCourses()

    supabaseMock.queue('course_materials', { data: null, error: null }, { data: null, error: null })
    let ok: unknown
    await act(async () => {
      ok = await result.current.reorderMaterials(['m1', 'm2'])
    })
    expect(ok).toBe(true)

    supabaseMock.queue('course_materials', { data: null, error: { message: 'boom' } })
    await act(async () => {
      ok = await result.current.reorderMaterials(['m1'])
    })
    expect(ok).toBe(false)
  })
})
