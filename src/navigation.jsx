import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilSpeedometer, cilSchool, cilUser, cilMediaPlay, cilGroup, cilBell } from '@coreui/icons'
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
          {
            component: CNavItem,
            name: 'Notificaciones',
            to: '/notifications',
            icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
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
            name: 'Clases',
            to: '/lessons',
            icon: <CIcon icon={cilMediaPlay} customClassName="nav-icon" />,
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
          {
            component: CNavItem,
            name: 'Usuarios',
            to: '/users',
            icon: <CIcon icon={cilGroup} customClassName="nav-icon" />,
          },
          {
            component: CNavItem,
            name: 'Enviar notificacion',
            to: '/send-notifications',
            icon: <CIcon icon={cilBell} customClassName="nav-icon" />,
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
