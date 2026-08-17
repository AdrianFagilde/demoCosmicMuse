import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilSpeedometer, cilSchool, cilUser } from '@coreui/icons'
import { CNavItem, CNavTitle } from '@coreui/react'

export const getNavigation = (profile) => {
  const studentItems =
    profile?.role === 'student'
      ? [
          {
            component: CNavItem,
            name: 'Mis tareas',
            to: '/tasks',
            icon: <CIcon icon={cilSchool} customClassName="nav-icon" />,
          },
          {
            component: CNavItem,
            name: 'Mi perfil',
            to: '/my-profile',
            icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
          },
        ]
      : []

  const adminItems =
    profile?.role === 'admin'
      ? [
          {
            component: CNavItem,
            name: 'Perfiles',
            to: '/students',
            icon: <CIcon icon={cilSchool} customClassName="nav-icon" />,
          },
          {
            component: CNavItem,
            name: 'Tareas',
            to: '/tasks',
            icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
          },
          {
            component: CNavItem,
            name: 'Pagos',
            to: '/payments',
            icon: <CIcon icon={cilUser} customClassName="nav-icon" />,
            roles: ['admin'],
          },
        ]
      : []

  return [
    {
      component: CNavItem,
      name: 'Dashboard',
      to: '/dashboard',
      icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" />,
    },
    {
      component: CNavTitle,
      name: 'Academia',
    },
    ...adminItems,
    ...studentItems,
  ]
}
