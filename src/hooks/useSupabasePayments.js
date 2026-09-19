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
      let proofPath = ''
      let proofName = ''

      if (proofFile) {
        proofName = proofFile.name
        proofPath = `${paymentData.studentId}/${Date.now()}-${proofFile.name}`
        const { error: uploadError } = await supabase.storage
          .from('payment-proofs')
          .upload(proofPath, proofFile)
        if (uploadError) {
          // Sin comprobante subido no se registra el pago para evitar
          // registros financieros incompletos sin aviso.
          console.error('[Payments] Upload comprobante falló:', uploadError.message, uploadError)
          return false
        }
      }

      const { error } = await supabase.from('payments').insert({
        student_id: paymentData.studentId,
        amount: Number(paymentData.amount),
        payment_date: paymentData.date,
        method: paymentData.method,
        frequency: paymentData.frequency,
        // proof_url guarda el PATH dentro del bucket privado; la URL de
        // descarga se genera firmada bajo demanda (ver getPaymentProofUrl)
        proof_url: proofPath,
        proof_name: proofName,
        notes: paymentData.notes || '',
        recorded_by: userId,
      })
      if (error) {
        // Rollback del archivo subido si el registro del pago falló
        if (proofPath) {
          await supabase.storage.from('payment-proofs').remove([proofPath])
        }
        console.error('[Payments] Error al registrar pago:', error.message, error)
        return false
      }

      await notifyInApp({
        senderId: userId,
        recipients: [{ id: paymentData.studentId }],
        title: 'Pago registrado',
        message: `Se registró un pago de $${Number(paymentData.amount).toFixed(2)} (${paymentData.method})`,
      })
      await fetchPayments()
      return true
    },
    [fetchPayments, userId],
  )

  // URL firmada de corta duración para ver un comprobante (bucket privado)
  const getPaymentProofUrl = useCallback(async (proofPath) => {
    if (!proofPath) return null
    const { data, error } = await supabase.storage
      .from('payment-proofs')
      .createSignedUrl(proofPath, 300)
    if (error) {
      console.error('[Payments] Signed URL error:', error.message, error)
      return null
    }
    return data?.signedUrl ?? null
  }, [])

  return { payments, loading, error, addPayment, getPaymentProofUrl, refetch: fetchPayments }
}

export default useSupabasePayments
