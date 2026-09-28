import React, { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import {
  CContainer,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CNavLink,
  CNavItem,
  useColorModes,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilContrast, cilList, cilMenu, cilMoon, cilSun } from '@coreui/icons'

import { AppBreadcrumb } from './index'
import { AppHeaderDropdown } from './header/index'
import NotificationBell from './header/NotificationBell'
import { StaffDivider } from './MusicDecor'
import { useApp } from '../context/AppContext'

const AppHeader = () => {
  const headerRef = useRef()
  const { colorMode, setColorMode } = useColorModes('cosmo-music-theme')
  const { sidebarShow, setSidebarShow } = useApp()

  const colorModeLabel =
    colorMode === 'dark' ? 'Oscuro' : colorMode === 'auto' ? 'Automático' : 'Claro'

  useEffect(() => {
    const handleScroll = () => {
      headerRef.current &&
        headerRef.current.classList.toggle('shadow-sm', document.documentElement.scrollTop > 0)
    }

    document.addEventListener('scroll', handleScroll)
    return () => document.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <CHeader position="sticky" className="app-header mb-4 p-0" ref={headerRef}>
      <CContainer className="app-header-bar border-bottom px-4" fluid>
        <CHeaderToggler
          onClick={() => setSidebarShow(!sidebarShow)}
          aria-label="Mostrar u ocultar el menú lateral"
        >
          <CIcon icon={cilMenu} size="lg" aria-hidden="true" />
        </CHeaderToggler>
        <CHeaderNav className="d-none d-md-flex">
          <CNavItem>
            <CNavLink to="/dashboard" as={NavLink}>
              Dashboard
            </CNavLink>
          </CNavItem>
        </CHeaderNav>
        <CHeaderNav className="ms-auto">
          <CNavItem>
            <NotificationBell />
          </CNavItem>
          <CNavItem>
            <CNavLink href="#" aria-label="Ver lista de actividades">
              <CIcon icon={cilList} size="lg" aria-hidden="true" />
            </CNavLink>
          </CNavItem>
        </CHeaderNav>
        <CHeaderNav>
          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>
          <CDropdown variant="nav-item" placement="bottom-end">
            <CDropdownToggle caret={false} aria-label={`Tema: ${colorModeLabel}. Cambiar tema`}>
              {colorMode === 'dark' ? (
                <CIcon icon={cilMoon} size="lg" aria-hidden="true" />
              ) : colorMode === 'auto' ? (
                <CIcon icon={cilContrast} size="lg" aria-hidden="true" />
              ) : (
                <CIcon icon={cilSun} size="lg" aria-hidden="true" />
              )}
            </CDropdownToggle>
            <CDropdownMenu>
              <CDropdownItem
                active={colorMode === 'light'}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode('light')}
              >
                <CIcon className="me-2" icon={cilSun} size="lg" aria-hidden="true" /> Claro
              </CDropdownItem>
              <CDropdownItem
                active={colorMode === 'dark'}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode('dark')}
              >
                <CIcon className="me-2" icon={cilMoon} size="lg" aria-hidden="true" /> Oscuro
              </CDropdownItem>
              <CDropdownItem
                active={colorMode === 'auto'}
                className="d-flex align-items-center"
                as="button"
                type="button"
                onClick={() => setColorMode('auto')}
              >
                <CIcon className="me-2" icon={cilContrast} size="lg" aria-hidden="true" />{' '}
                Automático
              </CDropdownItem>
            </CDropdownMenu>
          </CDropdown>
          <li className="nav-item py-1">
            <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
          </li>
          <AppHeaderDropdown />
        </CHeaderNav>
      </CContainer>
      <CContainer className="app-header-bar px-4" fluid>
        <AppBreadcrumb />
      </CContainer>
      <StaffDivider subtle className="mb-0" />
    </CHeader>
  )
}

export default AppHeader
