export const DELINQUENCY_DAYS = 30

export const INSTRUMENT_OPTIONS = ['Piano', 'Guitarra', 'Violín', 'Saxofón', 'Batería', 'Otro']

export const LEVEL_OPTIONS = ['Principiante', 'Intermedio', 'Avanzado']

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
