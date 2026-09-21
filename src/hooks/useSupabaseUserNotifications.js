import { useCallback, useEffect } from 'react'
import supabase from '../lib/supabase'
import useSupabaseQuery from './useSupabaseQuery'

const useSupabaseUserNotifications = (userId) => {
  const fetchNotifications = useCallback(async () => {
    if (!userId) return []
    const { data, error } = await supabase
      .from('notifications')
      .select('*, sender:profiles!notifications_sender_id_fkey(full_name)')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      console.error('[Notifications] Error:', error.message, error)
      throw error
    }
    return data || []
  }, [userId])

  const {
    data: notifications,
    setData: setNotifications,
    loading,
    error,
    refetch,
  } = useSupabaseQuery(fetchNotifications)

  useEffect(() => {
    if (!userId) return

    const instanceId = crypto.randomUUID()
    const channel = supabase
      .channel(`notifications-realtime-${userId}-${instanceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          refetch()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, refetch])

  const markAsRead = useCallback(
    async (notificationId) => {
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
    },
    [setNotifications],
  )

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
  }, [userId, setNotifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refetch,
  }
}

export default useSupabaseUserNotifications
