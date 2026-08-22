import React, { useEffect, useRef, useState } from 'react'
import { CToast, CToastBody, CToastHeader, CToaster } from '@coreui/react'
import { cilBell } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import useSupabaseUserNotifications from '../hooks/useSupabaseUserNotifications'

const MAX_INITIAL_SNIPPETS = 3
const SNIPPET_LENGTH = 80
const TOAST_BASE_DELAY = 7000
const MAX_VISIBLE_TOASTS = 6

let nextToastKey = 1

const buildBody = (message) => {
  if (!message) return ''
  return message.length > SNIPPET_LENGTH ? `${message.slice(0, SNIPPET_LENGTH)}…` : message
}

const buildMeta = (notification) =>
  [
    notification.sender?.full_name ? `De: ${notification.sender.full_name}` : '',
    notification.created_at
      ? new Date(notification.created_at).toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '',
  ]
    .filter(Boolean)
    .join(' · ')

const NotificationToasts = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { notifications, unreadCount, loading } = useSupabaseUserNotifications(user?.id)

  const [toasts, setToasts] = useState([])
  const initializedRef = useRef(false)
  const seenIdsRef = useRef(new Set())

  const removeToast = (key) => {
    setToasts((prev) => prev.filter((t) => t.key !== key))
  }

  const openToast = (toast) => {
    if (toast.notificationId && profile?.role === 'student') {
      navigate('/notifications')
    }
    removeToast(toast.key)
  }

  useEffect(() => {
    if (loading || !user) return

    const isFirstBatch = !initializedRef.current
    const incoming = isFirstBatch
      ? notifications.filter((n) => !n.read).slice(0, MAX_INITIAL_SNIPPETS)
      : notifications.filter((n) => !n.read && !seenIdsRef.current.has(n.id))

    if (isFirstBatch) {
      initializedRef.current = true
      seenIdsRef.current = new Set(notifications.map((n) => n.id))
    }

    const showSummary = isFirstBatch && unreadCount > MAX_INITIAL_SNIPPETS
    if (incoming.length === 0 && !showSummary) return

    const created = incoming.map((notification, index) => ({
      key: nextToastKey++,
      title: notification.title || 'Nueva notificacion',
      body: buildBody(notification.message),
      meta: buildMeta(notification),
      notificationId: notification.id,
      delay: TOAST_BASE_DELAY + index * 700,
    }))

    if (showSummary) {
      created.push({
        key: nextToastKey++,
        title: 'Notificaciones',
        body: `Tienes ${unreadCount} notificaciones sin leer`,
        meta: '',
        notificationId: null,
        delay: TOAST_BASE_DELAY + created.length * 700,
      })
    }

    setToasts((prev) => [...prev, ...created].slice(-MAX_VISIBLE_TOASTS))
  }, [loading, user, notifications, unreadCount])

  return (
    <CToaster placement="top-end">
      {toasts.map((toast) => (
        <CToast key={toast.key} autohide delay={toast.delay} onClose={() => removeToast(toast.key)}>
          <CToastHeader closeButton>
            <CIcon icon={cilBell} className="text-primary me-2" />
            <strong className="me-auto">{toast.title}</strong>
            <small className="text-body-secondary">{toast.meta}</small>
          </CToastHeader>
          <CToastBody
            role={toast.notificationId ? 'button' : undefined}
            style={toast.notificationId ? { cursor: 'pointer' } : undefined}
            onClick={() => openToast(toast)}
          >
            {toast.body}
          </CToastBody>
        </CToast>
      ))}
    </CToaster>
  )
}

export default NotificationToasts
