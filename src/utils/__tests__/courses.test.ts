import { describe, it, expect } from 'vitest'
import { computeStats } from '../courses'

const tasks = [
  {
    id: 't1',
    task_checklist_items: [{ id: 'i1' }, { id: 'i2' }],
  },
  {
    id: 't2',
    task_checklist_items: [{ id: 'i3' }],
  },
]

describe('computeStats', () => {
  it('counts all items when no student filter is given', () => {
    const stats = computeStats(tasks, [{ item_id: 'i1' }, { item_id: 'i3' }])
    expect(stats.totalItems).toBe(3)
    expect(stats.doneItems).toBe(2)
    expect(stats.percent).toBe(67)
    expect(stats.doneByTask).toEqual({ t1: 1, t2: 1 })
  })

  it('filters progress rows by student', () => {
    const stats = computeStats(
      tasks,
      [
        { item_id: 'i1', student_id: 'a' },
        { item_id: 'i2', student_id: 'b' },
        { item_id: 'i3', student_id: 'a' },
      ],
      'b' as never,
    )
    expect(stats.doneItems).toBe(1)
    expect(stats.doneByTask).toEqual({ t1: 1, t2: 0 })
  })

  it('returns zero percent when there are no items', () => {
    const stats = computeStats([], [])
    expect(stats.totalItems).toBe(0)
    expect(stats.percent).toBe(0)
    expect(stats.doneByTask).toEqual({})
  })

  it('tolerates tasks without checklist items', () => {
    const stats = computeStats([{ id: 't1' }], [])
    expect(stats.totalItems).toBe(0)
    expect(stats.doneByTask).toEqual({ t1: 0 })
  })
})
