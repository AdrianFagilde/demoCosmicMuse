import { describe, it, expect, vi, afterEach } from 'vitest'
import { startOfLocalDay, parseDbDate, localDateKey, isOverdue, getUrgency } from '../dates'

afterEach(() => {
  vi.useRealTimers()
})

describe('startOfLocalDay', () => {
  it('returns local midnight', () => {
    const d = startOfLocalDay(new Date(2026, 9, 2, 15, 30, 45))
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
    expect(d.getMilliseconds()).toBe(0)
  })

  it('defaults to today', () => {
    const d = startOfLocalDay()
    expect(d.getHours()).toBe(0)
  })
})

describe('parseDbDate', () => {
  it('returns null for falsy values', () => {
    expect(parseDbDate('')).toBeNull()
    expect(parseDbDate(null)).toBeNull()
    expect(parseDbDate(undefined)).toBeNull()
  })

  it('parses YYYY-MM-DD as local midnight', () => {
    const d = parseDbDate('2026-10-02')
    expect(d).not.toBeNull()
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(9)
    expect(d?.getDate()).toBe(2)
    expect(d?.getHours()).toBe(0)
  })

  it('passes through Date instances', () => {
    const input = new Date(2026, 0, 1)
    expect(parseDbDate(input)).toBe(input)
  })

  it('parses ISO timestamps', () => {
    const d = parseDbDate('2026-10-02T12:00:00.000Z')
    expect(d?.toISOString()).toBe('2026-10-02T12:00:00.000Z')
  })

  it('returns null for invalid strings', () => {
    expect(parseDbDate('not-a-date')).toBeNull()
  })
})

describe('localDateKey', () => {
  it('returns YYYY-MM using local components', () => {
    expect(localDateKey('2026-10-02')).toBe('2026-10')
  })

  it('returns null when date is invalid', () => {
    expect(localDateKey(null)).toBeNull()
  })
})

describe('isOverdue', () => {
  it('returns false for null', () => {
    expect(isOverdue(null)).toBe(false)
  })

  it('is false for today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0))
    expect(isOverdue('2026-10-02')).toBe(false)
  })

  it('is true for yesterday', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0))
    expect(isOverdue('2026-10-01')).toBe(true)
  })

  it('is false for tomorrow', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0))
    expect(isOverdue('2026-10-03')).toBe(false)
  })
})

describe('getUrgency', () => {
  it('returns none variant for null', () => {
    const result = getUrgency(null)
    expect(result.variant).toBe('none')
    expect(result.label).toBe('Sin fecha')
    expect(result.diffDays).toBeUndefined()
  })

  it('classifies an overdue date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0))
    const result = getUrgency('2026-10-01')
    expect(result.variant).toBe('urgent-overdue')
    expect(result.diffDays).toBe(-1)
  })

  it('classifies today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0))
    const result = getUrgency('2026-10-02')
    expect(result.variant).toBe('urgent-today')
    expect(result.diffDays).toBe(0)
  })

  it('classifies the coming week', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0))
    const result = getUrgency('2026-10-04')
    expect(result.variant).toBe('urgent-week')
    expect(result.label).toBe('2d')
  })

  it('classifies the future', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0))
    const result = getUrgency('2026-10-20')
    expect(result.variant).toBe('urgent-future')
    expect(result.diffDays).toBe(18)
  })
})
