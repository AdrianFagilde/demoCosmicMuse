import { describe, it, expect } from 'vitest'
import { BUILD_VERSION, buildHash } from '../version'

describe('version', () => {
  it('falls back to dev when no build version is defined', () => {
    expect(typeof BUILD_VERSION).toBe('string')
    expect(BUILD_VERSION.length).toBeGreaterThan(0)
    expect(buildHash).toBe(`v${BUILD_VERSION}`)
  })
})
