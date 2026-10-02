import { describe, it, expect } from 'vitest'
import { formatDateTime } from '../format'

describe('formatDateTime', () => {
  it('returns placeholder for falsy values', () => {
    expect(formatDateTime(null)).toBe('--')
    expect(formatDateTime('')).toBe('--')
    expect(formatDateTime(undefined)).toBe('--')
  })

  it('formats an ISO string in es-ES', () => {
    const out = formatDateTime('2026-10-02T15:30:00.000Z')
    expect(typeof out).toBe('string')
    expect(out).not.toBe('--')
    expect(out).toMatch(/\d{1,2}\/\d{1,2}\/\d{2}/)
  })
})
