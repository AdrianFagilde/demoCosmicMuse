import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'

const useSupabaseUserNotifications = (userId) => {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('*, sender:profiles!notifications_sender_id_fkey(full_name)')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (!error && data) {
      setNotifications(data)
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = useCallback(async (notificationId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      )
    }
    return !error
  }, [])

  const markAllAsRead = useCallback(async () => {
    if (!userId) return
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('recipient_id', userId)
      .eq('read', false)
    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }
    return !error
  }, [userId])

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  }
}

export default useSupabaseUserNotifications
