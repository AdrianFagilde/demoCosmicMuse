import { useCallback, useEffect, useRef, useState } from 'react'
import supabase from '../lib/supabase'

const useSupabaseReminders = (userId) => {
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const remindersRef = useRef(reminders)

  useEffect(() => {
    remindersRef.current = reminders
  }, [reminders])

  const fetchReminders = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('payment_reminders')
      .select(
        '*, profiles!payment_reminders_student_id_fkey(full_name), creator:profiles!payment_reminders_created_by_fkey(full_name)',
      )
      .order('schedule_at', { ascending: true })
    if (!error && data) {
      setReminders(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchReminders()
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
      const payments = (allPayments || []).filter((p) => p.student_id === s.id)
      const sorted = payments.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
      const last = sorted[0] ? new Date(sorted[0].payment_date) : null
      const isDelinquent = !last || (new Date() - last) / 86400000 > 30
      return {
        id: s.id,
        name: s.full_name,
        email: s.email,
        paymentStatus: isDelinquent ? 'Moroso' : 'Pagado',
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

      const inAppEntries = recipients.map((student) => ({
        sender_id: reminder.created_by,
        recipient_id: student.id,
        title: `Recordatorio de pago - ${reminder.target_group}`,
        message: reminder.message,
      }))

      if (inAppEntries.length > 0) {
        await supabase.from('notifications').insert(inAppEntries)
      }

      const nextSchedule =
        reminder.interval_value > 0
          ? new Date(
              new Date(reminder.schedule_at).getTime() +
                (reminder.interval_unit === 'Horas'
                  ? reminder.interval_value * 60 * 60 * 1000
                  : reminder.interval_value * 24 * 60 * 60 * 1000),
            ).toISOString()
          : reminder.schedule_at

      await updateReminder(reminder.id, {
        last_sent: sentAt,
        schedule_at: nextSchedule,
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
      const now = new Date()
      remindersRef.current.forEach((reminder) => {
        if (!reminder.active || !reminder.schedule_at) return
        const scheduled = new Date(reminder.schedule_at)
        if (scheduled <= now) {
          sendReminder(reminder, 'Automático', [])
        }
      })
    }, 60000)
    return () => clearInterval(timer)
  }, [sendReminder])

  return {
    reminders,
    upcomingReminders,
    loading,
    addReminder,
    updateReminder,
    sendReminder,
    refetch: fetchReminders,
  }
}

export default useSupabaseReminders
