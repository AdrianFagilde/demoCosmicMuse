import { useCallback, useEffect, useRef, useState } from 'react'
import supabase from '../lib/supabase'
import { notifyInApp } from '../utils/notifications'
import { isDelinquentSince } from '../utils/students'

const useSupabaseReminders = (userId) => {
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const remindersRef = useRef(reminders)
  const sendingRef = useRef(new Set())

  useEffect(() => {
    remindersRef.current = reminders
  }, [reminders])

  const fetchReminders = useCallback(async () => {
    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('payment_reminders')
      .select(
        '*, profiles!payment_reminders_student_id_fkey(full_name), creator:profiles!payment_reminders_created_by_fkey(full_name)',
      )
      .order('schedule_at', { ascending: true })
    if (fetchError) {
      setError(fetchError)
      console.error('[Reminders] Error:', fetchError.message, fetchError)
    } else {
      setError(null)
      setReminders(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      await fetchReminders()
    })()
  }, [fetchReminders])

  const addReminder = useCallback(
    async (reminderData) => {
      const { error } = await supabase.from('payment_reminders').insert({
        student_id: reminderData.targetGroup === 'Individual' ? reminderData.studentId : null,
        message: reminderData.message,
        notify_whatsapp: reminderData.notifyWhatsApp || false,
        schedule_at: reminderData.scheduleAt,
        interval_value: Number(reminderData.intervalValue) || 0,
        interval_unit: reminderData.intervalUnit || 'Días',
        target_group: reminderData.targetGroup,
        active: reminderData.active !== false,
        created_by: userId,
      })
      if (!error) {
        await fetchReminders()
      }
      return !error
    },
    [fetchReminders, userId],
  )

  const updateReminder = useCallback(async (reminderId, updates) => {
    const { error } = await supabase.from('payment_reminders').update(updates).eq('id', reminderId)
    if (!error) {
      setReminders((prev) => prev.map((r) => (r.id === reminderId ? { ...r, ...updates } : r)))
    }
    return !error
  }, [])

  const fetchRecipientsFromDB = useCallback(async (reminder) => {
    const { data: students } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'student')

    if (!students || students.length === 0) return []

    if (reminder.target_group === 'Individual') {
      return students
        .filter((s) => String(s.id) === String(reminder.student_id))
        .map((s) => ({ id: s.id, name: s.full_name, email: s.email }))
    }

    if (reminder.target_group === 'Todos') {
      return students.map((s) => ({ id: s.id, name: s.full_name, email: s.email }))
    }

    const { data: allPayments } = await supabase.from('payments').select('student_id, payment_date')

    const studentsWithStatus = students.map((s) => {
      const lastPayment = (allPayments || [])
        .filter((p) => p.student_id === s.id && p.payment_date)
        .reduce(
          (latest, p) =>
            !latest || new Date(p.payment_date) > new Date(latest) ? p.payment_date : latest,
          null,
        )
      return {
        id: s.id,
        name: s.full_name,
        email: s.email,
        paymentStatus: isDelinquentSince(lastPayment) ? 'Moroso' : 'Pagado',
      }
    })

    if (reminder.target_group === 'Morosos') {
      return studentsWithStatus.filter((s) => s.paymentStatus === 'Moroso')
    }
    if (reminder.target_group === 'Pagados') {
      return studentsWithStatus.filter((s) => s.paymentStatus === 'Pagado')
    }

    return []
  }, [])

  const sendReminder = useCallback(
    async (reminder, trigger, studentBalances) => {
      const sentAt = new Date().toISOString()

      let recipients = studentBalances || []
      if (recipients.length === 0) {
        recipients = await fetchRecipientsFromDB(reminder)
      }

      const methodLabel = reminder.notify_whatsapp ? 'App + WhatsApp' : 'App'

      const logEntries = recipients.map((student) => ({
        student_id: student.id,
        student_name: student.name || student.full_name,
        target_group: reminder.target_group || 'Individual',
        message: reminder.message,
        method: methodLabel,
        contact: student.email,
        trigger_type: trigger,
      }))

      if (logEntries.length > 0) {
        await supabase.from('notification_log').insert(logEntries)
      }

      await notifyInApp({
        senderId: reminder.created_by,
        recipients,
        title: `Recordatorio de pago - ${reminder.target_group}`,
        message: reminder.message,
      })

      const intervalValue = Number(reminder.interval_value) || 0
      let nextSchedule = reminder.schedule_at

      if (intervalValue > 0) {
        const stepMs =
          reminder.interval_unit === 'Horas'
            ? intervalValue * 60 * 60 * 1000
            : intervalValue * 24 * 60 * 60 * 1000
        let nextMs = new Date(reminder.schedule_at).getTime()
        while (nextMs <= Date.now()) {
          nextMs += stepMs
        }
        nextSchedule = new Date(nextMs).toISOString()
      }

      await updateReminder(reminder.id, {
        last_sent: sentAt,
        schedule_at: nextSchedule,
        ...(intervalValue === 0 ? { active: false } : {}),
      })

      return logEntries
    },
    [updateReminder, fetchRecipientsFromDB],
  )

  const upcomingReminders = reminders
    .filter((r) => r.active)
    .sort((a, b) => new Date(a.schedule_at) - new Date(b.schedule_at))

  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now()
      remindersRef.current.forEach((reminder) => {
        if (!reminder.active || !reminder.schedule_at) return
        if (sendingRef.current.has(reminder.id)) return
        if (new Date(reminder.schedule_at).getTime() <= now) {
          sendingRef.current.add(reminder.id)
          sendReminder(reminder, 'Automático', [])
            .catch((error) => console.error('[Reminders] Error:', error))
            .finally(() => sendingRef.current.delete(reminder.id))
        }
      })
    }, 60000)
    return () => clearInterval(timer)
  }, [sendReminder])

  return {
    reminders,
    upcomingReminders,
    loading,
    error,
    addReminder,
    updateReminder,
    sendReminder,
    refetch: fetchReminders,
  }
}

export default useSupabaseReminders
