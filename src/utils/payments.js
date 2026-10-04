export const EMPTY_PAYMENT_FILTERS = {
  text: '',
  studentId: '',
  method: '',
  frequency: '',
  dateFrom: '',
  dateTo: '',
  minAmount: '',
  maxAmount: '',
}

const normalize = (value) =>
  (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export const hasActivePaymentFilters = (filters) =>
  Object.entries(filters || {}).some(([key, value]) => {
    if (key === 'text') return (value || '').trim() !== ''
    return value !== '' && value != null
  })

export const countActivePaymentFilters = (filters) =>
  Object.entries(filters || {}).filter(([key, value]) => {
    if (key === 'text') return (value || '').trim() !== ''
    return value !== '' && value != null
  }).length

// La fecha de pago se guarda como texto "YYYY-MM-DD": comparar por texto evita
// los saltos de zona horaria que introduce new Date() sobre fechas sin hora.
export const filterPayments = (payments, filters) => {
  const f = { ...EMPTY_PAYMENT_FILTERS, ...(filters || {}) }
  const text = normalize(f.text)
  const min = f.minAmount === '' ? null : Number(f.minAmount)
  const max = f.maxAmount === '' ? null : Number(f.maxAmount)
  const hasMin = min != null && Number.isFinite(min)
  const hasMax = max != null && Number.isFinite(max)

  return (payments || []).filter((payment) => {
    if (f.studentId && payment.student_id !== f.studentId) return false
    if (f.method && payment.method !== f.method) return false
    if (f.frequency && payment.frequency !== f.frequency) return false

    const date = String(payment.payment_date || '')
    if (f.dateFrom && date && date < f.dateFrom) return false
    if (f.dateTo && date && date > f.dateTo) return false

    if (hasMin || hasMax) {
      const amount = Number(payment.amount)
      // Un monto no numerico no puede compararse. Sin esta guarda, NaN hace que
      // todas las comparaciones sean false y la fila atravesaria el filtro
      // presentandose como si cumpliera el rango.
      if (!Number.isFinite(amount)) return false
      if (hasMin && amount < min) return false
      if (hasMax && amount > max) return false
    }

    if (text) {
      const haystack = normalize(
        [
          payment.profiles?.full_name,
          payment.recorder?.full_name,
          payment.method,
          payment.frequency,
          payment.notes,
          payment.proof_name,
        ].join(' '),
      )
      if (!haystack.includes(text)) return false
    }

    return true
  })
}

export const PAYMENT_SORT_COLUMNS = {
  date: { label: 'Fecha', value: (p) => String(p.payment_date || '') },
  student: { label: 'Estudiante', value: (p) => p.profiles?.full_name || '' },
  amount: { label: 'Monto', value: (p) => Number(p.amount) || 0 },
  method: { label: 'Método', value: (p) => p.method || '' },
}

export const sortPayments = (payments, sortKey = 'date', direction = 'desc') => {
  const column = PAYMENT_SORT_COLUMNS[sortKey]
  if (!column) return payments || []
  const factor = direction === 'asc' ? 1 : -1

  return [...(payments || [])].sort((a, b) => {
    const va = column.value(a)
    const vb = column.value(b)
    if (typeof va === 'number' && typeof vb === 'number') {
      return (va - vb) * factor
    }
    const cmp = String(va).localeCompare(String(vb), 'es', { sensitivity: 'base' })
    return cmp * factor
  })
}

export const summarizePayments = (payments, today = new Date()) => {
  const list = payments || []
  const year = today.getFullYear()
  const month = today.getMonth()
  const totalAll = list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
  const totalMonth = list
    .filter((p) => {
      if (!p.payment_date) return false
      const d = new Date(p.payment_date)
      return d.getFullYear() === year && d.getMonth() === month
    })
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  return { count: list.length, totalAll, totalMonth }
}
