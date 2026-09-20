import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

const useSupabasePushNotifications = (userId) => {
  const [subscription, setSubscription] = useState(null)
  const [permission, setPermission] = useState('default')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [supported, setSupported] = useState(false)

  const saveSubscription = useCallback(
    async (pushSubscription) => {
      if (!userId) return
      try {
        const sub = pushSubscription.toJSON()
        const { error } = await supabase.from('push_subscriptions').upsert(
          {
            user_id: userId,
            endpoint: sub.endpoint,
            p256dh: sub.keys?.p256dh
              ? btoa(String.fromCharCode(...new Uint8Array(sub.keys.p256dh)))
              : '',
            auth: sub.keys?.auth ? btoa(String.fromCharCode(...new Uint8Array(sub.keys.auth))) : '',
            user_agent: navigator.userAgent,
          },
          { onConflict: 'user_id,endpoint' },
        )
        if (error) throw error
      } catch (err) {
        console.error('[Push] Save subscription error:', err)
      }
    },
    [userId],
  )

  const deleteSubscription = useCallback(
    async (pushSubscription) => {
      if (!userId) return
      try {
        const sub = pushSubscription.toJSON()
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', userId)
          .eq('endpoint', sub.endpoint)
        if (error) throw error
      } catch (err) {
        console.error('[Push] Delete subscription error:', err)
      }
    },
    [userId],
  )

  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = 'serviceWorker' in navigator && 'PushManager' in window
      setSupported(isSupported)
      if (isSupported) {
        const perm = await Notification.requestPermission()
        setPermission(perm)

        // Get existing subscription
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready
          const sub = await registration.pushManager.getSubscription()
          if (sub) {
            setSubscription(sub)
            await saveSubscription(sub)
          }
        }
      }
    }
    checkSupport()
  }, [saveSubscription])

  const subscribe = useCallback(async () => {
    if (!supported || !userId) return
    setLoading(true)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.ready

      // Convert VAPID key
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)

      // Subscribe
      const pushSubscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      await saveSubscription(pushSubscription)
      setSubscription(pushSubscription)
      setPermission('granted')
    } catch (err) {
      console.error('[Push] Subscribe error:', err)
      setError(err.message)
      if (err.name === 'NotAllowedError') {
        setPermission('denied')
      }
    } finally {
      setLoading(false)
    }
  }, [supported, userId, saveSubscription])

  const unsubscribe = useCallback(async () => {
    if (!subscription) return
    setLoading(true)

    try {
      await subscription.unsubscribe()
      await deleteSubscription(subscription)
      setSubscription(null)
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [subscription, deleteSubscription])

  const sendTestNotification = useCallback(async () => {
    if (!userId) return
    try {
      // This would typically call an Edge Function
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: { userId, title: 'Test', body: 'Esta es una notificación de prueba' },
      })
      if (error) throw error
    } catch (err) {
      console.error('[Push] Test notification error:', err)
    }
  }, [userId])

  return {
    subscription,
    permission,
    loading,
    error,
    supported,
    subscribe,
    unsubscribe,
    sendTestNotification,
    refetch: () => {},
  }
}

export default useSupabasePushNotifications
