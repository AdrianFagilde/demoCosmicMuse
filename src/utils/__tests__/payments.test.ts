import { describe, it, expect } from 'vitest'
import {
  EMPTY_PAYMENT_FILTERS,
  countActivePaymentFilters,
  filterPayments,
  hasActivePaymentFilters,
  sortPayments,
  summarizePayments,
} from '../payments'

const payment = (overrides = {}) => ({
  id: crypto.randomUUID(),
  student_id: 's1',
  amount: 50,
  payment_date: '2026-10-01',
  method: 'Pago móvil',
  frequency: 'Mensual',
  notes: '',
  profiles: { full_name: 'Ana Pérez' },
  recorder: { full_name: 'Admin' },
  ...overrides,
})

describe('filterPayments', () => {
  const list = [
    payment({ student_id: 's1', amount: 50, payment_date: '2026-10-01', method: 'Efectivo' }),
    payment({
      student_id: 's2',
      amount: 120,
      payment_date: '2026-09-15',
      method: 'Transferencia',
      notes: 'Septiembre',
      profiles: { full_name: 'Luis Gómez' },
    }),
    payment({
      student_id: 's2',
      amount: 30,
      payment_date: '2026-08-02',
      method: 'Pago móvil',
      profiles: { full_name: 'Luis Gómez' },
    }),
  ]

  it('returns everything when no filter is set', () => {
    expect(filterPayments(list, EMPTY_PAYMENT_FILTERS)).toHaveLength(3)
    expect(filterPayments(list, undefined)).toHaveLength(3)
  })

  it('filters by student, method and frequency', () => {
    expect(filterPayments(list, { studentId: 's2' })).toHaveLength(2)
    expect(filterPayments(list, { method: 'Efectivo' })).toHaveLength(1)
    expect(filterPayments(list, { frequency: 'Pago móvil' })).toHaveLength(0)
    expect(filterPayments(list, { frequency: 'Mensual' })).toHaveLength(3)
  })

  it('filters by inclusive date range', () => {
    expect(filterPayments(list, { dateFrom: '2026-09-01' })).toHaveLength(2)
    expect(filterPayments(list, { dateTo: '2026-09-15' })).toHaveLength(2)
    expect(filterPayments(list, { dateFrom: '2026-09-01', dateTo: '2026-09-30' })).toHaveLength(1)
  })

  it('filters by amount range', () => {
    expect(filterPayments(list, { minAmount: '50' })).toHaveLength(2)
    expect(filterPayments(list, { maxAmount: '50' })).toHaveLength(2)
    expect(filterPayments(list, { minAmount: '40', maxAmount: '100' })).toHaveLength(1)
  })

  it('searches text ignoring case and accents', () => {
    expect(filterPayments(list, { text: 'luis' })).toHaveLength(2)
    // "Gómez" debe encontrar "Gomez" sin depender de la tilde.
    expect(filterPayments(list, { text: 'Gómez' })).toHaveLength(2)
    expect(filterPayments(list, { text: 'septiembre' })).toHaveLength(1)
    expect(filterPayments(list, { text: 'nada de esto' })).toHaveLength(0)
  })

  it('combines filters', () => {
    expect(
      filterPayments(list, { studentId: 's2', dateFrom: '2026-09-01', method: 'Transferencia' }),
    ).toHaveLength(1)
  })

  it('tolerates missing lists and malformed amounts', () => {
    expect(filterPayments(undefined, EMPTY_PAYMENT_FILTERS)).toEqual([])
    expect(filterPayments([payment({ amount: 'n/d' })], { maxAmount: '10' })).toHaveLength(0)
  })
})

describe('hasActivePaymentFilters / countActivePaymentFilters', () => {
  it('ignores blank text as an inactive filter', () => {
    expect(hasActivePaymentFilters(EMPTY_PAYMENT_FILTERS)).toBe(false)
    expect(countActivePaymentFilters({ ...EMPTY_PAYMENT_FILTERS, text: '   ' })).toBe(0)
  })

  it('counts each active field', () => {
    expect(countActivePaymentFilters({ ...EMPTY_PAYMENT_FILTERS, method: 'Efectivo' })).toBe(1)
    expect(
      countActivePaymentFilters({ ...EMPTY_PAYMENT_FILTERS, method: 'Efectivo', minAmount: '10' }),
    ).toBe(2)
  })
})

describe('sortPayments', () => {
  const list = [
    payment({ id: 'a', amount: 30, payment_date: '2026-08-01', profiles: { full_name: 'Zoe' } }),
    payment({ id: 'b', amount: 90, payment_date: '2026-10-01', profiles: { full_name: 'Ana' } }),
    payment({ id: 'c', amount: 60, payment_date: '2026-09-01', profiles: { full_name: 'Luis' } }),
  ]
  // La inferencia de TS no entra en los callbacks que encadenan con sortPayments,
  // asi que el tipo de la fila se declara una vez y se reutiliza.
  type Row = (typeof list)[number]
  const ids = (rows: Row[]) => rows.map((p) => p.id)
  const amounts = (rows: Row[]) => rows.map((p) => p.amount)

  it('sorts by date in both directions', () => {
    expect(ids(sortPayments(list, 'date', 'desc'))).toEqual(['b', 'c', 'a'])
    expect(ids(sortPayments(list, 'date', 'asc'))).toEqual(['a', 'c', 'b'])
  })

  it('sorts numbers numerically, not as strings', () => {
    expect(amounts(sortPayments(list, 'amount', 'asc'))).toEqual([30, 60, 90])
    expect(amounts(sortPayments(list, 'amount', 'desc'))).toEqual([90, 60, 30])
  })

  it('sorts text with locale rules and is case-insensitive', () => {
    expect(sortPayments(list, 'student', 'asc').map((p: Row) => p.profiles.full_name)).toEqual([
      'Ana',
      'Luis',
      'Zoe',
    ])
  })

  it('does not mutate the input', () => {
    const original = ids(list)
    sortPayments(list, 'amount', 'desc')
    expect(ids(list)).toEqual(original)
  })

  it('returns the input untouched for an unknown column', () => {
    expect(sortPayments(list, 'nope', 'asc')).toBe(list)
  })
})

describe('summarizePayments', () => {
  const today = new Date('2026-10-15T12:00:00')
  const list = [
    payment({ amount: 50, payment_date: '2026-10-02' }),
    payment({ amount: 25, payment_date: '2026-10-10' }),
    payment({ amount: 100, payment_date: '2026-09-30' }),
    payment({ amount: 999, payment_date: null }),
  ]

  it('adds up only the payments of the current month', () => {
    expect(summarizePayments(list, today).totalMonth).toBe(75)
  })

  it('adds up everything, ignoring entries with no amount', () => {
    expect(summarizePayments(list, today).totalAll).toBe(1174)
    expect(summarizePayments(list, today).count).toBe(4)
  })

  it('handles an empty list', () => {
    expect(summarizePayments([], today)).toEqual({ count: 0, totalAll: 0, totalMonth: 0 })
    expect(summarizePayments(undefined, today).totalMonth).toBe(0)
  })
})
