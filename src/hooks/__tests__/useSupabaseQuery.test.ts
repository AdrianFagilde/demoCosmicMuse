import { describe, it, expect, vi } from 'vitest'
import useSupabaseQuery from '../useSupabaseQuery'

describe('useSupabaseQuery', () => {
  it('exports default function', () => {
    expect(typeof useSupabaseQuery).toBe('function')
  })
})
