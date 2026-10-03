import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  DELINQUENCY_DAYS,
  UNASSIGNED_INSTRUMENT_LABEL,
  isActiveStudent,
  byFullName,
  buildAssignmentGroups,
  normalizeUsername,
  isDelinquentSince,
  computeStudentBalances,
  getInstrumentEmoji,
  formatInstrument,
} from '../students'

afterEach(() => {
  vi.useRealTimers()
})

describe('normalizeUsername', () => {
  it('lowercases and removes diacritics', () => {
    expect(normalizeUsername('Juan Pérez')).toBe('juan.perez')
  })

  it('joins words with a dot', () => {
    expect(normalizeUsername('Ana Maria García')).toBe('ana.maria.garcia')
  })

  it('removes symbols and non alphanumeric characters', () => {
    expect(normalizeUsername('María-José López')).toBe('mariajose.lopez')
  })

  it('trims surrounding whitespace', () => {
    expect(normalizeUsername('  Ana   García  ')).toBe('ana.garcia')
  })

  it('returns empty string for falsy input', () => {
    expect(normalizeUsername(null)).toBe('')
    expect(normalizeUsername(undefined)).toBe('')
  })
})

describe('isActiveStudent', () => {
  it('is case and accent insensitive', () => {
    expect(isActiveStudent({ status: 'Activo' })).toBe(true)
    expect(isActiveStudent({ status: 'ACTIVO' })).toBe(true)
  })

  it('is false for other statuses or missing student', () => {
    expect(isActiveStudent({ status: 'Inactivo' })).toBe(false)
    expect(isActiveStudent(undefined)).toBe(false)
  })
})

describe('byFullName', () => {
  it('sorts by full name ignoring accents', () => {
    const names = ['Zoe', 'Álvaro', 'beatriz']
    const sorted = [...names].map((full_name) => ({ full_name })).sort(byFullName)
    expect(sorted.map((s) => s.full_name)).toEqual(['Álvaro', 'beatriz', 'Zoe'])
  })
})

describe('buildAssignmentGroups', () => {
  it('groups students by canonical instrument and sorts members', () => {
    const students = [
      { id: 1, full_name: 'Zoe', instrument: 'piano' },
      { id: 2, full_name: 'Bea', instrument: 'Piano' },
      { id: 3, full_name: 'Ana', instrument: 'Guitarra' },
    ]
    const groups = buildAssignmentGroups(students)
    const piano = groups.find((g) => g.instrument === 'Piano')
    expect(piano?.members.map((m) => m.full_name)).toEqual(['Bea', 'Zoe'])
    expect(groups.map((g) => g.instrument)).toEqual(['Piano', 'Guitarra'])
  })

  it('keeps unknown instruments in their own group', () => {
    const groups = buildAssignmentGroups([
      { id: 1, full_name: 'Ana', instrument: 'Theremin' },
      { id: 2, full_name: 'Bea', instrument: null },
    ])
    const theremin = groups.find((g) => g.instrument === 'Theremin')
    const unassigned = groups.find((g) => g.instrument === UNASSIGNED_INSTRUMENT_LABEL)
    expect(theremin?.members.map((m) => m.full_name)).toEqual(['Ana'])
    expect(unassigned?.members.map((m) => m.full_name)).toEqual(['Bea'])
  })

  it('handles non-array input', () => {
    expect(buildAssignmentGroups(null)).toEqual([])
  })
})

describe('getInstrumentEmoji', () => {
  it('resolves the emoji ignoring case and accents', () => {
    expect(getInstrumentEmoji('piano')).toBe('🎹')
    expect(getInstrumentEmoji('violin')).toBe('🎻')
    expect(getInstrumentEmoji('VIOLÍN')).toBe('🎻')
    expect(getInstrumentEmoji('Cuatro')).toBe('🇻🇪')
  })

  it('returns an empty string for empty or unknown instruments', () => {
    expect(getInstrumentEmoji('')).toBe('')
    expect(getInstrumentEmoji(null)).toBe('')
    expect(getInstrumentEmoji('Theremin')).toBe('')
  })
})

describe('formatInstrument', () => {
  it('prefixes the emoji for known instruments', () => {
    expect(formatInstrument('Cuatro')).toBe('🇻🇪 Cuatro')
    expect(formatInstrument('Flauta')).toBe('🪈 Flauta')
  })

  it('keeps unknown instruments as plain text', () => {
    expect(formatInstrument('Theremin')).toBe('Theremin')
  })

  it('returns an empty string for empty input', () => {
    expect(formatInstrument('   ')).toBe('')
    expect(formatInstrument(null)).toBe('')
  })
})

describe('isDelinquentSince', () => {
  it('returns true when there is no payment date', () => {
    expect(isDelinquentSince(null)).toBe(true)
  })

  it('returns false for a recent payment', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2))
    expect(isDelinquentSince('2026-10-01')).toBe(false)
  })

  it('returns true when older than the delinquency window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2))
    const old = new Date(2026, 9, 2)
    old.setDate(old.getDate() - (DELINQUENCY_DAYS + 1))
    expect(isDelinquentSince(old.toISOString())).toBe(true)
  })
})

describe('computeStudentBalances', () => {
  it('aggregates payments, last date and payment status', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 2))
    const students = [
      { id: 1, full_name: 'Ana' },
      { id: 2, full_name: 'Bea' },
    ]
    const payments = [
      { student_id: 1, amount: '10', payment_date: '2026-10-01' },
      { student_id: 1, amount: 20, payment_date: '2026-09-01' },
    ]
    const result = computeStudentBalances(students, payments)
    const ana = result[0]!
    const bea = result[1]!
    expect(ana.totalPaid).toBe(30)
    expect(ana.paymentsCount).toBe(2)
    expect(ana.lastPaidDate).toBe('2026-10-01')
    expect(ana.paymentStatus).toBe('Pagado')
    expect(bea.totalPaid).toBe(0)
    expect(bea.paymentStatus).toBe('Moroso')
  })

  it('handles empty inputs', () => {
    expect(computeStudentBalances([], [])).toEqual([])
    expect(computeStudentBalances(null, null)).toEqual([])
  })
})
