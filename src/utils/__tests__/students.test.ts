import { describe, it, expect } from 'vitest'
import { normalizeUsername, isDelinquentSince } from '../students'

describe('normalizeUsername', () => {
  it('normalizes names correctly', () => {
    expect(normalizeUsername('Juan Pérez')).toBe('juan.perez')
    expect(normalizeUsername('María-José López')).toBe('mariajose.lopez')
    expect(normalizeUsername('  Ana   García  ')).toBe('ana.garcia')
  })
})

describe('isDelinquentSince', () => {
  it('returns true if no last payment', () => {
    expect(isDelinquentSince(null)).toBe(true)
  })

  it('returns false if recent payment', () => {
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    expect(isDelinquentSince(recent)).toBe(false)
  })
})
