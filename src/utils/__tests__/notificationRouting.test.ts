import { describe, it, expect } from 'vitest'
import { getNotificationTarget, isNavigableNotification } from '../notificationRouting'

describe('getNotificationTarget', () => {
  it('routes task notifications to the task page', () => {
    expect(getNotificationTarget({ reference_type: 'task', reference_id: 'abc' })).toBe(
      '/tasks/abc',
    )
  })

  it('returns null when the type is not task', () => {
    expect(getNotificationTarget({ reference_type: 'course', reference_id: 'abc' })).toBeNull()
  })

  it('returns null when the reference id is missing', () => {
    expect(getNotificationTarget({ reference_type: 'task', reference_id: null })).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(getNotificationTarget(null)).toBeNull()
    expect(getNotificationTarget(undefined)).toBeNull()
  })
})

describe('isNavigableNotification', () => {
  it('matches the presence of a target', () => {
    expect(isNavigableNotification({ reference_type: 'task', reference_id: '1' })).toBe(true)
    expect(isNavigableNotification({ reference_type: null })).toBe(false)
  })
})
