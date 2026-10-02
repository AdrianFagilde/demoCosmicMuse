import { describe, it, expect } from 'vitest'
import { parseDbDate, localDateKey, isOverdue, getUrgency } from '../dates'

describe('parseDbDate', () => {
  it('returns null for falsy', () => {
    expect(parseDbDate('')).toBeNull()
    expect(parseDbDate(null as any)).toBeNull()
    expect(parseDbDate(undefined as any)).toBeNull()
  })

  it('parses YYYY-MM-DD correctly', () => {
    const d = parseDbDate('2026-10-02')
    expect(d).not.toBeNull()
    expect(d?.getFullYear()).toBe(2026)
  })
})

describe('localDateKey', () => {
  it('returns key for date', () => {
    const d = new Date(2026, 9, 2)
    const key = localDateKey(d)
    expect(key).toMatch(/2026-10-02/)
  })
})

describe('isOverdue', () => {
  it('handles null', () => {
    expect(isOverdue(null)).toBe(false)
  })
})

describe('getUrgency', () => {
  it('returns none for null', () => {
    expect(getUrgency(null)).toBe('none')
  })
})
