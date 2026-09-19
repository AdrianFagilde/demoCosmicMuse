import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'
import { notifyInApp } from '../utils/notifications'
import { computeStudentBalances } from '../utils/students'

const useSupabaseReminders = (userId) => {
  const [reminders, setReminders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
    if (error) {
      console.error('[Reminders] Error al actualizar:', error.message, error)
    } else {
      setReminders((prev) => prev.map((r) => (r.id === reminderId ? { ...r, ...updates } : r)))
    }
    return !error
  }, [])

  const deleteReminder = useCallback(async (reminderId) => {
    const { error } = await supabase.from('payment_reminders').delete().eq('id', reminderId)
    if (error) {
      console.error('[Reminders] Error al eliminar:', error.message, error)
    } else {
      setReminders((prev) => prev.filter((r) => r.id !== reminderId))
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

    const studentsWithStatus = computeStudentBalances(students, allPayments || [])

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

  return {
    reminders,
    upcomingReminders,
    loading,
    error,
    addReminder,
    updateReminder,
    deleteReminder,
    sendReminder,
    refetch: fetchReminders,
  }
}

export default useSupabaseReminders
