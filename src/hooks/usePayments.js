import { useCallback, useEffect, useState } from 'react'
import { students, payments as seedPayments } from '../data/academy'

const STORAGE_KEY = 'cosmo-music-payments'

const loadFromStorage = (key, fallback) => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const usePayments = (user) => {
  const [payments, setPayments] = useState(() => loadFromStorage(STORAGE_KEY, seedPayments))

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payments))
    } catch {
      // ignore
    }
  }, [payments])

  const addPayment = useCallback(
    (paymentData) => {
      const student = students.find((s) => String(s.id) === String(paymentData.studentId))
      if (!student || !paymentData.amount || !paymentData.date) return
      const nextId = Math.max(0, ...payments.map((p) => p.id)) + 1
      setPayments((prev) => [
        ...prev,
        {
          id: nextId,
          studentId: Number(paymentData.studentId),
          studentName: student.name,
          amount: Number(paymentData.amount),
          date: paymentData.date,
          method: paymentData.method,
          frequency: paymentData.frequency,
          proof: paymentData.proof,
          notes: paymentData.notes,
          recordedBy: user?.name || 'Administrador',
        },
      ])
    },
    [payments, user],
  )

  const studentBalances = students.map((student) => {
    const studentPayments = payments.filter((p) => p.studentId === student.id)
    const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0)
    const lastPayment = studentPayments
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))[0]
    const lastPaidDate = lastPayment ? new Date(lastPayment.date) : null
    const isDelinquent = !lastPaidDate || (new Date() - lastPaidDate) / (1000 * 60 * 60 * 24) > 30
    return {
      ...student,
      totalPaid,
      paymentsCount: studentPayments.length,
      lastPaidDate,
      paymentStatus: isDelinquent ? 'Moroso' : 'Pagado',
    }
  })

  const delinquentStudents = studentBalances.filter((s) => s.paymentStatus === 'Moroso')
  const paidStudents = studentBalances.filter((s) => s.paymentStatus === 'Pagado')

  return {
    payments,
    addPayment,
    studentBalances,
    delinquentStudents,
    paidStudents,
  }
}

export default usePayments
