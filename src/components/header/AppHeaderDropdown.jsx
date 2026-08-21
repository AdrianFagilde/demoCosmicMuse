import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAvatar,
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
} from '@coreui/react'
import { cilLockLocked, cilSettings, cilUser } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

import { useAuth } from '../../context/AuthContext'

const AppHeaderDropdown = () => {
  const navigate = useNavigate()
  const { user, profile, logout } = useAuth()

  const fullName = profile?.full_name || ''
  const initials =
    fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'U'
  const avatarUrl = profile?.avatar_url

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <CDropdown variant="nav-item">
      <CDropdownToggle placement="bottom-end" className="py-0 pe-0" caret={false}>
        {avatarUrl ? (
          <CAvatar src={avatarUrl} size="md" />
        ) : (
          <CAvatar color="primary" size="md">
            {initials}
          </CAvatar>
        )}
      </CDropdownToggle>
      <CDropdownMenu className="pt-0" placement="bottom-end">
        <CDropdownHeader className="bg-body-secondary fw-semibold mb-2">
          <div className="d-flex align-items-center gap-2 py-1">
            {avatarUrl ? (
              <CAvatar src={avatarUrl} size="sm" />
            ) : (
              <CAvatar color="primary" size="sm">
                {initials}
              </CAvatar>
            )}
            <span>{fullName || user?.email || 'Usuario'}</span>
          </div>
        </CDropdownHeader>
        <CDropdownItem disabled>
          <CIcon icon={cilUser} className="me-2" />
          {profile?.role === 'admin' ? 'Administrador' : 'Estudiante'}
        </CDropdownItem>
        <CDropdownDivider />
        <CDropdownItem
          onClick={() => navigate('/my-profile')}
          type="button"
          style={{ cursor: 'pointer' }}
        >
          <CIcon icon={cilSettings} className="me-2" />
          Perfil
        </CDropdownItem>
        <CDropdownItem onClick={handleLogout} type="button" style={{ cursor: 'pointer' }}>
          <CIcon icon={cilLockLocked} className="me-2" />
          Cerrar sesión
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default AppHeaderDropdown
