import { useEffect, useState } from 'react'

const STORAGE_KEY = 'cosmo-music-payment-notification-log'

const loadFromStorage = (key, fallback) => {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const useNotificationLog = () => {
  const [notificationLog, setNotificationLog] = useState(() => loadFromStorage(STORAGE_KEY, []))

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(notificationLog))
    } catch {
      // ignore
    }
  }, [notificationLog])

  const addEntries = (entries) => {
    setNotificationLog((current) => [...entries, ...current])
  }

  const notifyBrowser = (title, body) => {
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
  }

  const entries = [...notificationLog].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))

  return {
    notificationLog: entries,
    addEntries,
    notifyBrowser,
  }
}

export default useNotificationLog
