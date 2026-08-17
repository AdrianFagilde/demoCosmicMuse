import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'

const useSupabaseNotifications = () => {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('notification_log')
      .select('*')
      .order('sent_at', { ascending: false })
    if (!error && data) {
      setEntries(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const addEntries = useCallback(
    async (newEntries) => {
      const rows = newEntries.map((e) => ({
        student_id: e.student_id || e.studentId,
        student_name: e.student_name || e.studentName,
        target_group: e.target_group || e.targetGroup,
        message: e.message,
        method: e.method,
        contact: e.contact,
        trigger_type: e.trigger_type || e.trigger,
      }))
      const { error } = await supabase.from('notification_log').insert(rows)
      if (!error) {
        await fetchEntries()
      }
      return !error
    },
    [fetchEntries],
  )

  const notifyBrowser = useCallback((title, body) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
      new Notification(title, { body })
      return
    }
    if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification(title, { body })
        }
      })
    }
  }, [])

  return { entries, loading, addEntries, notifyBrowser, refetch: fetchEntries }
}

export default useSupabaseNotifications
