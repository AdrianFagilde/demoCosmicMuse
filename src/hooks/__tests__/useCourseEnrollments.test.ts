import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useCourseEnrollments from '../useCourseEnrollments'

const course = { id: 'c1', course_enrollments: [{ student_id: 's1' }] }
const students = [
  { id: 's1', full_name: 'Ana García' },
  { id: 's2', full_name: 'Bea López' },
]

const setup = (overrides = {}) => {
  const saveEnrollments = vi.fn().mockResolvedValue(true)
  const onSaved = vi.fn().mockResolvedValue(undefined)
  const props = {
    course,
    students,
    saveEnrollments,
    actorId: 'admin',
    onSaved,
    reloadToken: 1,
    ...overrides,
  }
  return {
    ...renderHook((p) => useCourseEnrollments(p), { initialProps: props }),
    saveEnrollments,
    onSaved,
    props,
  }
}

describe('useCourseEnrollments', () => {
  it('derives checked state from the course enrollments', () => {
    const { result } = setup()
    expect(result.current.isChecked('s1')).toBe(true)
    expect(result.current.isChecked('s2')).toBe(false)
  })

  it('toggles an override', () => {
    const { result } = setup()
    act(() => result.current.toggle('s2', true))
    expect(result.current.isChecked('s2')).toBe(true)
    act(() => result.current.toggle('s1', false))
    expect(result.current.isChecked('s1')).toBe(false)
  })

  it('filters students by name, ignoring case and spacing', () => {
    const { result } = setup()
    act(() => result.current.setSearch('  bea '))
    expect(result.current.filteredStudents.map((s: { id: string }) => s.id)).toEqual(['s2'])
  })

  it('returns every student when the search is empty', () => {
    const { result } = setup()
    expect(result.current.filteredStudents).toEqual(students)
  })

  it('saves the checked ids, clears overrides and notifies the shell', async () => {
    const { result, saveEnrollments, onSaved } = setup()
    act(() => result.current.toggle('s2', true))

    let ok
    await act(async () => {
      ok = await result.current.save()
    })

    expect(ok).toBe(true)
    expect(saveEnrollments).toHaveBeenCalledWith(course, ['s1', 's2'], 'admin')
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(result.current.saving).toBe(false)
    // Overrides are cleared after a successful save; with the course prop
    // unchanged, checked state falls back to the persisted enrollments.
    expect(result.current.isChecked('s2')).toBe(false)
  })

  it('does not clear overrides when the save fails', async () => {
    const saveEnrollments = vi.fn().mockResolvedValue(false)
    const onSaved = vi.fn()
    const { result } = setup({ saveEnrollments, onSaved })
    act(() => result.current.toggle('s2', true))

    await act(async () => {
      await result.current.save()
    })

    expect(onSaved).not.toHaveBeenCalled()
    expect(result.current.isChecked('s2')).toBe(true)
  })

  it('discards overrides when the reload token changes', () => {
    const { result, rerender, props } = setup()
    act(() => result.current.toggle('s2', true))
    expect(result.current.isChecked('s2')).toBe(true)

    rerender({ ...props, reloadToken: 2 })
    expect(result.current.isChecked('s2')).toBe(false)
  })
})
