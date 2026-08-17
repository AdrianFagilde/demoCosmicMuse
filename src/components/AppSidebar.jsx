import React, { useMemo } from 'react'
import {
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
      <AppSidebarNav items={navigation} />
      <CSidebarFooter className="border-top d-none d-lg-flex">
        <CSidebarToggler onClick={toggleSidebarUnfoldable} />
      </CSidebarFooter>
    </CSidebar>
  )
}

export default React.memo(AppSidebar)
