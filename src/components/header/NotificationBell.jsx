import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CBadge,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell } from '@coreui/icons'
import { useAuth } from '../../context/AuthContext'
import useSupabaseUserNotifications from '../../hooks/useSupabaseUserNotifications'

const formatRelativeTime = (dateStr) => {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Ahora'
  if (diffMin < 60) return `Hace ${diffMin}m`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `Hace ${diffHr}h`
  const diffDay = Math.floor(diffHr / 24)
  return `Hace ${diffDay}d`
}

const NotificationBell = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead } =
    useSupabaseUserNotifications(user?.id)

  const recent = notifications.slice(0, 8)

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }
  }

  return (
    <CDropdown variant="nav-item" placement="bottom-end">
      <CDropdownToggle caret={false} className="position-relative px-2">
        <CIcon icon={cilBell} size="lg" />
        {unreadCount > 0 && (
          <CBadge
            color="danger"
            position="top-end"
            shape="rounded-pill"
            className="p-1"
            style={{ fontSize: '0.6rem', minWidth: '18px' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </CBadge>
        )}
      </CDropdownToggle>
      <CDropdownMenu className="p-0" style={{ width: '360px', maxHeight: '420px', overflow: 'auto' }}>
        <CDropdownHeader className="bg-body-secondary d-flex justify-content-between align-items-center">
          <span>Notificaciones</span>
          {unreadCount > 0 && (
            <button
              className="btn btn-sm btn-link p-0 text-decoration-none"
              onClick={markAllAsRead}
            >
              Marcar todo leido
            </button>
          )}
        </CDropdownHeader>
        {recent.length === 0 && (
          <CDropdownItem disabled className="text-center text-medium-emphasis py-3">
            No hay notificaciones
          </CDropdownItem>
        )}
        {recent.map((n) => (
          <CDropdownItem
            key={n.id}
            onClick={() => handleNotificationClick(n)}
            className={`py-2 ${!n.read ? 'bg-body-secondary bg-opacity-25' : ''}`}
            style={{ cursor: 'pointer' }}
          >
            <div className="d-flex justify-content-between align-items-start">
              <div className="flex-grow-1 me-2">
                <div className={`fw-semibold small ${!n.read ? '' : 'text-medium-emphasis'}`}>
                  {n.title}
                </div>
                <div className="small text-truncate" style={{ maxWidth: '260px' }}>
                  {n.message}
                </div>
                <div className="text-medium-emphasis" style={{ fontSize: '0.7rem' }}>
                  {n.sender?.full_name ? `De: ${n.sender.full_name}` : ''}{' '}
                  {formatRelativeTime(n.created_at)}
                </div>
              </div>
              {!n.read && (
                <span
                  className="rounded-circle bg-primary flex-shrink-0 mt-1"
                  style={{ width: '8px', height: '8px' }}
                />
              )}
            </div>
          </CDropdownItem>
        ))}
        {notifications.length > 0 && (
          <>
            <CDropdownDivider className="m-0" />
            <CDropdownItem
              onClick={() => navigate('/notifications')}
              className="text-center text-primary py-2"
              style={{ cursor: 'pointer' }}
            >
              Ver todas las notificaciones
            </CDropdownItem>
          </>
        )}
      </CDropdownMenu>
    </CDropdown>
  )
}

export default React.memo(NotificationBell)
