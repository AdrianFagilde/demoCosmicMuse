import { useCallback } from 'react'
import supabase from '../lib/supabase'
import { notifyInApp } from '../utils/notifications'
import { computeStudentBalances } from '../utils/students'
import useSupabaseQuery from './useSupabaseQuery'

const useSupabaseReminders = (userId) => {
  const fetchReminders = useCallback(async () => {
    const { data, error } = await supabase
      .from('payment_reminders')
      .select(
        '*, profiles!payment_reminders_student_id_fkey(full_name), creator:profiles!payment_reminders_created_by_fkey(full_name)',
      )
      .order('schedule_at', { ascending: true })
    if (error) {
      console.error('[Reminders] Error:', error.message, error)
      throw error
    }
    return data || []
  }, [])

  const {
    data: reminders,
    setData: setReminders,
    loading,
    error,
    refetch,
  } = useSupabaseQuery(fetchReminders)

  const addReminder = useCallback(
    async (reminderData) => {
      // El input es `datetime-local`, que produce una cadena sin zona
      // ("2026-10-01T14:30"). La columna es TIMESTAMPTZ, asi que Postgres
      // la coerciona contra la zona de la sesion (UTC por defecto) y el
      // recordatorio saltaba a otra hora para cualquier admin fuera de UTC.
      const parsedSchedule = new Date(reminderData.scheduleAt)
      if (!Number.isFinite(parsedSchedule.getTime())) {
        console.error('[Reminders] scheduleAt inválido:', reminderData.scheduleAt)
        return false
      }

      const { error } = await supabase.from('payment_reminders').insert({
        student_id: reminderData.targetGroup === 'Individual' ? reminderData.studentId : null,
        message: reminderData.message,
        notify_whatsapp: reminderData.notifyWhatsApp || false,
        schedule_at: parsedSchedule.toISOString(),
        interval_value: Number(reminderData.intervalValue) || 0,
        interval_unit: reminderData.intervalUnit || 'Días',
        target_group: reminderData.targetGroup,
        active: reminderData.active !== false,
        created_by: userId,
      })
      if (!error) {
        await refetch()
      }
      return !error
    },
    [userId, refetch],
  )

  const updateReminder = useCallback(
    async (reminderId, updates) => {
      const { error } = await supabase
        .from('payment_reminders')
        .update(updates)
        .eq('id', reminderId)
      if (error) {
        console.error('[Reminders] Error al actualizar:', error.message, error)
      } else {
        setReminders((prev) => prev.map((r) => (r.id === reminderId ? { ...r, ...updates } : r)))
      }
      return !error
    },
    [setReminders],
  )

  const deleteReminder = useCallback(
    async (reminderId) => {
      const { error } = await supabase.from('payment_reminders').delete().eq('id', reminderId)
      if (error) {
        console.error('[Reminders] Error al eliminar:', error.message, error)
      } else {
        setReminders((prev) => prev.filter((r) => r.id !== reminderId))
      }
      return !error
    },
    [setReminders],
  )

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

    const { data: allPayments, error: paymentsError } = await supabase
      .from('payments')
      .select('student_id, payment_date')

    // Si la consulta de pagos falla, `allPayments` llega como null y el
    // `|| []` de abajo haria que TODOS los estudiantes parecieran morosos:
    // un recordatorio de grupo "Morosos" acusaria de impago a toda la
    // matricula. Es preferible no enviar nada antes que enviar algo falso.
    if (paymentsError) {
      console.error('useSupabaseReminders: no se pudieron leer los pagos', paymentsError.message)
      return []
    }

    const studentsWithStatus = computeStudentBalances(students, allPayments || [])

    if (reminder.target_group === 'Morosos') {
      return studentsWithStatus.filter((s) => s.paymentStatus === 'Moroso')
    }
    if (reminder.target_group === 'Pagados') {
      return studentsWithStatus.filter((s) => s.paymentStatus === 'Pagado')
    }

    return []
  }, [])

  const filterRecipientsByTargetGroup = useCallback((reminder, allStudents) => {
    if (!allStudents || allStudents.length === 0) return []

    switch (reminder.target_group) {
      case 'Individual':
        return allStudents.filter((s) => String(s.id) === String(reminder.student_id))
      case 'Todos':
        return allStudents
      case 'Morosos':
        return allStudents.filter((s) => s.paymentStatus === 'Moroso')
      case 'Pagados':
        return allStudents.filter((s) => s.paymentStatus === 'Pagado')
      default:
        return []
    }
  }, [])

  const sendReminder = useCallback(
    async (reminder, trigger, studentBalances) => {
      const sentAt = new Date().toISOString()

      const allStudents = studentBalances || (await fetchRecipientsFromDB(reminder))
      const recipients = filterRecipientsByTargetGroup(reminder, allStudents)

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
        const { error: logError } = await supabase.from('notification_log').insert(logEntries)
        // No se propaga el error: las notificaciones ya se enviaron y lanzar
        // aqui dejaria al reminder sin avanzar, repetiria el envio y ocultaria
        // que si llego al alumno. Se registra para que quede el rastro.
        if (logError) {
          console.error(
            'useSupabaseReminders: fallo al escribir notification_log',
            logError.message,
          )
        }
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

        // Un schedule_at ausente o corrupto produce NaN. La guarda `NaN <=
        // Date.now()` es false, asi que el bucle se salta y el
        // toISOString() de abajo lanzaba RangeError DESPUES de entregar las
        // notificaciones: el alumno recibia el aviso, el caller creia que no
        // y el reminder no avanzaba, por lo que volvia a dispararse.
        if (!Number.isFinite(nextMs)) {
          console.error('useSupabaseReminders: schedule_at invalido, se desactiva', {
            reminderId: reminder.id,
            scheduleAt: reminder.schedule_at,
          })
          // No basta con salir: hay que DESACTIVAR. Devolver aqui sin tocar
          // la fila dejaba el recordatorio activo y con la fecha corrupta, de
          // modo que el siguiente barrido lo volvia a encontrar y el alumno
          // recibia el mismo aviso otra vez, indefinidamente. Se deja
          // `last_sent` escrito para que conste que esta entrega ocurrio.
          await updateReminder(reminder.id, { last_sent: sentAt, active: false })
          return logEntries
        }

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
    [updateReminder, fetchRecipientsFromDB, filterRecipientsByTargetGroup],
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
    refetch,
  }
}

export default useSupabaseReminders
