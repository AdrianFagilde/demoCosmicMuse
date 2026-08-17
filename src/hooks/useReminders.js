import { useCallback, useEffect, useRef, useState } from 'react'
import { paymentReminders as seedReminders } from '../data/academy'

const STORAGE_KEY = 'cosmo-music-payment-reminders'

const loadFromStorage = (key, fallback) => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const useReminders = (studentBalances, onSendReminder) => {
  const [reminders, setReminders] = useState(() => loadFromStorage(STORAGE_KEY, seedReminders))
  const remindersRef = useRef(reminders)

  useEffect(() => {
    remindersRef.current = reminders
  }, [reminders])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders))
    } catch {
      // ignore
    }
  }, [reminders])

  const getReminderRecipients = useCallback(
    (reminder) => {
      switch (reminder.targetGroup) {
        case 'Todos':
          return studentBalances
        case 'Morosos':
          return studentBalances.filter((s) => s.paymentStatus === 'Moroso')
        case 'Pagados':
          return studentBalances.filter((s) => s.paymentStatus === 'Pagado')
        case 'Individual':
        default:
          return studentBalances.filter((s) => String(s.id) === String(reminder.studentId))
      }
    },
    [studentBalances],
  )

  const sendReminder = useCallback(
    (reminder, trigger) => {
      const sentAt = new Date().toISOString()
      const recipients = getReminderRecipients(reminder)
      const methodLabel = reminder.notifyWhatsApp ? 'App + WhatsApp' : 'App'
      const entries = recipients.map((student) => ({
        id: `${Date.now()}-${student.id}`,
        studentName: student.name,
        targetGroup: reminder.targetGroup || 'Individual',
        message: reminder.message,
        method: methodLabel,
        contact: reminder.notifyWhatsApp ? student.phone || student.email : student.email,
        sentAt,
        trigger,
      }))

      if (onSendReminder) {
        onSendReminder(entries)
      }

      setReminders((current) =>
        current.map((item) =>
          item.id === reminder.id
            ? {
                ...item,
                lastSent: sentAt,
                active: item.intervalValue > 0 || item.active,
                scheduleAt:
                  item.intervalValue > 0
                    ? new Date(
                        new Date(item.scheduleAt).getTime() +
                          (item.intervalUnit === 'Horas'
                            ? item.intervalValue * 60 * 60 * 1000
                            : item.intervalValue * 24 * 60 * 60 * 1000),
                      ).toISOString()
                    : item.scheduleAt,
              }
            : item,
        ),
      )
    },
    [getReminderRecipients, onSendReminder],
  )

  const addReminder = useCallback(
    (reminderData, userName) => {
      const student = studentBalances.find((s) => String(s.id) === String(reminderData.studentId))
      if (reminderData.targetGroup === 'Individual' && !student) return
      if (!reminderData.scheduleAt) return
      const nextId = Math.max(0, ...reminders.map((r) => r.id)) + 1
      setReminders((current) => [
        ...current,
        {
          id: nextId,
          studentId:
            reminderData.targetGroup === 'Individual' ? Number(reminderData.studentId) : null,
          studentName:
            reminderData.targetGroup === 'Individual' ? student?.name : reminderData.targetGroup,
          message: reminderData.message,
          notifyWhatsApp: reminderData.notifyWhatsApp,
          scheduleAt: reminderData.scheduleAt,
          intervalValue: Number(reminderData.intervalValue),
          intervalUnit: reminderData.intervalUnit,
          targetGroup: reminderData.targetGroup,
          active: reminderData.active,
          lastSent: null,
          createdBy: userName || 'Administrador',
        },
      ])
    },
    [reminders, studentBalances],
  )

  const upcomingReminders = reminders
    .filter((r) => r.active)
    .sort((a, b) => new Date(a.scheduleAt) - new Date(b.scheduleAt))

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      remindersRef.current.forEach((reminder) => {
        if (!reminder.active || !reminder.scheduleAt) return
        const scheduled = new Date(reminder.scheduleAt)
        if (scheduled <= now) {
          sendReminder(reminder, 'Automático')
        }
      })
    }, 60000)
    return () => clearInterval(timer)
  }, [sendReminder])

  return {
    reminders,
    upcomingReminders,
    addReminder,
    sendReminder,
    getReminderRecipients,
  }
}

export default useReminders
