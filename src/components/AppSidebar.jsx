import React, { useMemo } from 'react'
import {
  CAvatar,
  CCloseButton,
  CSidebar,
  CSidebarBrand,
  CSidebarFooter,
  CSidebarHeader,
  CSidebarToggler,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'

import { AppSidebarNav } from './AppSidebarNav'
import { logo } from 'src/assets/brand/logo'
import { sygnet } from 'src/assets/brand/sygnet'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import { getNavigation } from '../navigation'

const AppSidebar = () => {
  const { sidebarShow, setSidebarShow, sidebarUnfoldable, toggleSidebarUnfoldable } = useApp()
  const { profile } = useAuth()
  const navigation = useMemo(() => getNavigation(profile), [profile])

  const initials =
    profile?.full_name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || 'U'

  return (
    <CSidebar
      className="border-end"
      colorScheme="dark"
      position="fixed"
      unfoldable={sidebarUnfoldable}
      visible={sidebarShow}
      onVisibleChange={(visible) => setSidebarShow(visible)}
    >
      <CSidebarHeader className="border-bottom">
        <CSidebarBrand to="/">
          <CIcon customClassName="sidebar-brand-full" icon={logo} height={32} />
          <CIcon customClassName="sidebar-brand-narrow" icon={sygnet} height={32} />
        </CSidebarBrand>
        <CCloseButton className="d-lg-none" dark onClick={() => setSidebarShow(false)} />
      </CSidebarHeader>
      <div className="sidebar-user d-flex align-items-center gap-2 px-3 py-3">
        {profile?.avatar_url ? (
          <CAvatar src={profile.avatar_url} size="md" />
        ) : (
          <CAvatar customClassName="sidebar-user-avatar" size="md">
            {initials}
          </CAvatar>
        )}
        <div className="sidebar-user-info">
          <div className="fw-semibold small text-truncate">{profile?.full_name || 'Usuario'}</div>
          <div className="sidebar-user-role">
            {profile?.role === 'admin' ? 'Administrador' : 'Estudiante'}
          </div>
        </div>
      </div>
      <AppSidebarNav items={navigation} />
      <CSidebarFooter className="border-top d-none d-lg-flex">
        <CSidebarToggler onClick={toggleSidebarUnfoldable} />
      </CSidebarFooter>
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
