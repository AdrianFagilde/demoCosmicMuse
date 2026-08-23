import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'
import { notifyInApp } from '../utils/notifications'

const useSupabasePayments = (userId) => {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPayments = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('payments')
      .select(
        '*, profiles!payments_student_id_fkey(full_name), recorder:profiles!payments_recorded_by_fkey(full_name)',
      )
      .order('created_at', { ascending: false })
    if (fetchError) {
      setError(fetchError)
      console.error('[Payments] Error:', fetchError.message, fetchError)
    } else {
      setError(null)
      setPayments(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      await fetchPayments()
    })()
  }, [fetchPayments])

  const addPayment = useCallback(
    async (paymentData, proofFile) => {
      let proofUrl = ''
      let proofName = ''

      if (proofFile) {
        proofName = proofFile.name
        const filePath = `${paymentData.studentId}/${Date.now()}-${proofFile.name}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(filePath, proofFile)
        if (!uploadError && uploadData) {
          const { data: urlData } = supabase.storage.from('payment-proofs').getPublicUrl(filePath)
          proofUrl = urlData?.publicUrl || ''
        } else if (uploadError) {
          console.warn('[Payments] Upload comprobante falló:', uploadError.message)
        }
      }

      const { error } = await supabase.from('payments').insert({
        student_id: paymentData.studentId,
        amount: Number(paymentData.amount),
        payment_date: paymentData.date,
        method: paymentData.method,
        frequency: paymentData.frequency,
        proof_url: proofUrl,
        proof_name: proofName,
        notes: paymentData.notes || '',
        recorded_by: userId,
      })
      if (!error) {
        await notifyInApp({
          senderId: userId,
          recipients: [{ id: paymentData.studentId }],
          title: 'Pago registrado',
          message: `Se registró un pago de $${Number(paymentData.amount).toFixed(2)} (${paymentData.method})`,
        })
        await fetchPayments()
      }
      return !error
    },
    [fetchPayments, userId],
  )

  const getStudentBalances = useCallback(async (students) => {
    const { data: allPayments } = await supabase
      .from('payments')
      .select('student_id, amount, payment_date')

    return students.map((student) => {
      const studentPayments = (allPayments || []).filter((p) => p.student_id === student.id)
      const totalPaid = studentPayments.reduce((sum, p) => sum + Number(p.amount), 0)
      const sorted = studentPayments
        .slice()
        .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
      const lastPaidDate = sorted[0] ? new Date(sorted[0].payment_date) : null
      const isDelinquent = !lastPaidDate || (new Date() - lastPaidDate) / (1000 * 60 * 60 * 24) > 30

      return {
        ...student,
        name: student.full_name,
        totalPaid,
        paymentsCount: studentPayments.length,
        lastPaidDate,
        paymentStatus: isDelinquent ? 'Moroso' : 'Pagado',
      }
    })
  }, [])

  return { payments, loading, error, addPayment, getStudentBalances, refetch: fetchPayments }
}

export default useSupabasePayments
