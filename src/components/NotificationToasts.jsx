import React, { useEffect, useRef, useState } from 'react'
import { CButton, CCloseButton, CToast, CToastBody, CToastHeader, CToaster } from '@coreui/react'
import { cilBell } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { onAppToast } from '../utils/appToasts'

const MAX_INITIAL_SNIPPETS = 3
const SNIPPET_LENGTH = 80
const TOAST_BASE_DELAY = 7000
const MAX_VISIBLE_TOASTS = 6

const TOAST_PLACEMENTS = [
  'top-start',
  'top-center',
  'top-end',
  'bottom-start',
  'bottom-center',
  'bottom-end',
]

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

const ToastActions = ({ toast, onDone }) =>
  toast.actions?.length > 0 && (
    <div className="d-flex gap-2 mt-2">
      {toast.actions.map((action) => (
        <CButton
          key={action.label}
          size="sm"
          color={action.variant || 'primary'}
          onClick={() => {
            action.onClick?.()
            onDone()
          }}
        >
          {action.label}
        </CButton>
      ))}
    </div>
  )

const NotificationToasts = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { notifications, unreadCount, loading } = useNotifications()

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

  // Toasts ad-hoc de cualquier módulo (showAppToast): no vienen de la
  // tabla notifications, se renderizan igual que el resto y pueden llevar
  // acciones y posición propias.
  useEffect(
    () =>
      onAppToast(({ title, body, placement, delay, persistent, actions }) => {
        setToasts((prev) =>
          [
            ...prev,
            {
              key: nextToastKey++,
              title: title || 'Aviso',
              body,
              meta: '',
              notificationId: null,
              placement: TOAST_PLACEMENTS.includes(placement) ? placement : 'top-end',
              delay,
              persistent,
              actions,
            },
          ].slice(-MAX_VISIBLE_TOASTS),
        )
      }),
    [],
  )

  useEffect(() => {
    if (loading || !user) return

    const isFirstBatch = !initializedRef.current
    const incoming = isFirstBatch
      ? notifications.filter((n) => !n.read).slice(0, MAX_INITIAL_SNIPPETS)
      : notifications.filter((n) => !n.read && !seenIdsRef.current.has(n.id))

    if (isFirstBatch) {
      initializedRef.current = true
      seenIdsRef.current = new Set(notifications.map((n) => n.id))
    } else {
      // Marca como vistas las nuevas para no repetir toasts en cada refetch
      incoming.forEach((n) => seenIdsRef.current.add(n.id))
    }

    const showSummary = isFirstBatch && unreadCount > MAX_INITIAL_SNIPPETS
    if (incoming.length === 0 && !showSummary) return

    const created = incoming.map((notification, index) => ({
      key: nextToastKey++,
      title: notification.title || 'Nueva notificación',
      body: buildBody(notification.message),
      meta: buildMeta(notification),
      notificationId: notification.id,
      placement: 'top-end',
      delay: TOAST_BASE_DELAY + index * 700,
    }))

    if (showSummary) {
      created.push({
        key: nextToastKey++,
        title: 'Notificaciones',
        body: `Tienes ${unreadCount} notificaciones sin leer`,
        meta: '',
        notificationId: null,
        placement: 'top-end',
        delay: TOAST_BASE_DELAY + created.length * 700,
      })
    }

    setToasts((prev) => [...prev, ...created].slice(-MAX_VISIBLE_TOASTS))
  }, [loading, notifications, unreadCount, user])

  const renderToast = (toast) => (
    <CToast
      key={toast.key}
      autohide={!toast.persistent}
      delay={toast.delay ?? TOAST_BASE_DELAY}
      onClose={() => removeToast(toast.key)}
    >
      {/* closeButton traía un CToastClose sin opciones, que hereda el
          aria-label "Close" en inglés de CCloseButton y no se puede
          sobrescribir desde CToastHeader. Se pone el cierre a mano. */}
      <CToastHeader>
        <CIcon icon={cilBell} className="text-primary me-2" aria-hidden="true" />
        <strong className="me-auto">{toast.title}</strong>
        <small className="text-body-secondary">{toast.meta}</small>
        <CCloseButton
          className="ms-2"
          onClick={() => removeToast(toast.key)}
          aria-label="Cerrar la notificación"
        />
      </CToastHeader>
      {toast.notificationId ? (
        // role="button" sin tabIndex ni onKeyDown dejaba el cuerpo del
        // toast fuera del orden de tabulacion: con teclado no habia forma
        // de abrir la notificacion. Ahora es un control de verdad.
        <CToastBody
          role="button"
          tabIndex={0}
          className="is-clickable"
          onClick={() => openToast(toast)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              openToast(toast)
            }
          }}
        >
          {toast.body}
          <ToastActions toast={toast} onDone={() => removeToast(toast.key)} />
        </CToastBody>
      ) : (
        <CToastBody>
          {toast.body}
          <ToastActions toast={toast} onDone={() => removeToast(toast.key)} />
        </CToastBody>
      )}
    </CToast>
  )

  return (
    // Una region viva por posicion. Cada CToast lleva tambien
    // role="alert" + aria-live="assertive": anidar una region viva dentro de
    // otra hace que algunos lectores anuncien el mensaje dos veces, otras no
    // lo anuncien, y el aviso de una notificacion cualquiera (que no es una
    // emergencia) interruptsa al usuario. El anuncio vive aqui; el toast
    // individual no vuelve a declararse como region viva.
    <>
      {TOAST_PLACEMENTS.map((placement) => {
        const group = toasts.filter((t) => t.placement === placement)
        if (group.length === 0) return null
        return (
          <CToaster
            key={placement}
            placement={placement}
            role="status"
            aria-live="polite"
            aria-atomic="false"
          >
            {group.map(renderToast)}
          </CToaster>
        )
      })}
    </>
  )
}

export default NotificationToasts
