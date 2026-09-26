import React from 'react'
import { CBadge, CButton, CCard, CCardBody, CCardHeader, CSpinner } from '@coreui/react'
import { cilCheckAlt } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useNotifications } from '../../context/NotificationContext'
import { formatDateTime } from '../../utils/format'

const Notifications = () => {
  const { notifications, unreadCount, loading, error, markAsRead, markAllAsRead } =
    useNotifications()

  if (loading) {
    return (
      <div className="text-center pt-4">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <CCard>
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <span>Mis notificaciones</span>
        <div className="d-flex align-items-center gap-3">
          {unreadCount > 0 && <CBadge color="primary">{unreadCount} sin leer</CBadge>}
          {unreadCount > 0 && (
            <CButton color="link" size="sm" onClick={markAllAsRead}>
              <CIcon icon={cilCheckAlt} className="me-1" /> Marcar todo leido
            </CButton>
          )}
        </div>
      </CCardHeader>
      <CCardBody>
        {error ? (
          // Sin esto, un fallo de red o de RLS se leería al alumno como
          // "no tienes notificaciones", indistinguible del estado real.
          <div className="alert alert-warning mb-0">
            No se pudieron cargar tus notificaciones. Comprueba tu conexión e inténtalo de nuevo.
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center text-medium-emphasis py-4">No tienes notificaciones.</div>
        ) : (
          <div className="list-group">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={`list-group-item list-group-item-action ${!n.read ? 'bg-primary bg-opacity-10' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => !n.read && markAsRead(n.id)}
              >
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-semibold">{n.title}</div>
                    <div className="small text-body-secondary">{n.message}</div>
                    <div className="text-medium-emphasis mt-1" style={{ fontSize: '0.75rem' }}>
                      {n.sender?.full_name ? `De: ${n.sender.full_name}` : ''} -{' '}
                      {formatDateTime(n.created_at)}
                    </div>
                  </div>
                  {!n.read && (
                    <CBadge color="primary" shape="pill" className="ms-2">
                      Nuevo
                    </CBadge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

export default Notifications
