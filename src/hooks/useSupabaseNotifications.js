import { useCallback } from 'react'
import supabase from '../lib/supabase'
import useSupabaseQuery from './useSupabaseQuery'

const useSupabaseNotifications = () => {
  const fetchEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('notification_log')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(100)
    if (error) {
      console.error('[NotificationLog] Error:', error.message, error)
      throw error
    }
    return data || []
  }, [])

  const { data: entries, loading, error, refetch } = useSupabaseQuery(fetchEntries)

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
        await refetch()
      }
      return !error
    },
    [refetch],
  )

  return { entries, loading, error, addEntries, refetch }
}

export default useSupabaseNotifications
