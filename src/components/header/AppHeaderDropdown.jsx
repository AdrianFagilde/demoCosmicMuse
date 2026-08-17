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
import avatar8 from './../../assets/images/avatars/8.jpg'

const AppHeaderDropdown = () => {
  const navigate = useNavigate()
  const { user, profile, logout } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <CDropdown variant="nav-item">
      <CDropdownToggle placement="bottom-end" className="py-0 pe-0" caret={false}>
        <CAvatar src={avatar8} size="md" />
      </CDropdownToggle>
      <CDropdownMenu className="pt-0" placement="bottom-end">
        <CDropdownHeader className="bg-body-secondary fw-semibold mb-2">
          {profile?.full_name ?? user?.email ?? 'Usuario'}
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
