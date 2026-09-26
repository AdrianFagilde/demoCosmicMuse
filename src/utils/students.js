export const DELINQUENCY_DAYS = 30

export const INSTRUMENT_OPTIONS = ['Piano', 'Guitarra', 'Violín', 'Saxofón', 'Batería', 'Otro']

export const LEVEL_OPTIONS = ['Principiante', 'Intermedio', 'Avanzado']

export const UNASSIGNED_INSTRUMENT_LABEL = 'Sin instrumento'

const INSTRUMENT_RANK = new Map(INSTRUMENT_OPTIONS.map((name, index) => [name, index]))

const normalizedText = (value) =>
  (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const CANONICAL_INSTRUMENT = new Map(INSTRUMENT_OPTIONS.map((name) => [normalizedText(name), name]))

const instrumentRank = (name) => {
  if (name === UNASSIGNED_INSTRUMENT_LABEL) return Number.MAX_SAFE_INTEGER
  return INSTRUMENT_RANK.get(name) ?? INSTRUMENT_OPTIONS.length
}

export const isActiveStudent = (student) => normalizedText(student?.status) === 'activo'

export const byFullName = (a, b) =>
  (a?.full_name || '').localeCompare(b?.full_name || '', 'es', { sensitivity: 'base' })

export const buildAssignmentGroups = (students) => {
  const list = (Array.isArray(students) ? students : []).filter(Boolean)
  const buckets = new Map()

  INSTRUMENT_OPTIONS.forEach((name) => buckets.set(name, []))
  list.forEach((student) => {
    const raw = normalizedText(student?.instrument)
    const key =
      CANONICAL_INSTRUMENT.get(raw) || student?.instrument?.trim() || UNASSIGNED_INSTRUMENT_LABEL
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(student)
  })

  return [...buckets.entries()]
    .map(([instrument, members]) => ({ instrument, members: [...members].sort(byFullName) }))
    .filter((group) => group.members.length > 0)
    .sort(
      (a, b) =>
        instrumentRank(a.instrument) - instrumentRank(b.instrument) ||
        a.instrument.localeCompare(b.instrument, 'es', { sensitivity: 'base' }),
    )
}

export const normalizeUsername = (fullName) =>
  fullName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '')

export const isDelinquentSince = (lastPaymentDate) => {
  if (!lastPaymentDate) return true
  const elapsedDays = (Date.now() - new Date(lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24)
  return elapsedDays > DELINQUENCY_DAYS
}

export const computeStudentBalances = (students, payments) => {
  const paymentsByStudent = new Map()
  ;(payments || []).forEach((payment) => {
    const list = paymentsByStudent.get(payment.student_id) || []
    list.push(payment)
    paymentsByStudent.set(payment.student_id, list)
  })

  return (students || []).map((student) => {
    const studentPayments = paymentsByStudent.get(student.id) || []
    const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const lastPaidDate = studentPayments.reduce((latest, p) => {
      if (!p.payment_date) return latest
      return !latest || new Date(p.payment_date) > new Date(latest) ? p.payment_date : latest
    }, null)

    return {
      ...student,
      name: student.full_name,
      totalPaid,
      paymentsCount: studentPayments.length,
      lastPaidDate,
      paymentStatus: isDelinquentSince(lastPaidDate) ? 'Moroso' : 'Pagado',
    }
  })
}
