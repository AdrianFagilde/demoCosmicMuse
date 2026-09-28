import React from 'react'
import CIcon from '@coreui/icons-react'
import {
  cilSpeedometer,
  cilUser,
  cilMediaPlay,
  cilGroup,
  cilBell,
  cilBook,
  cilTask,
  cilMoney,
} from '@coreui/icons'
import { CNavItem, CNavTitle } from '@coreui/react'

export const getNavigation = (profile) => {
  const studentItems =
    profile?.role === 'student'
      ? [
          {
            component: CNavItem,
            name: 'Mis tareas',
            to: '/tasks',
            icon: <CIcon icon={cilTask} customClassName="nav-icon" aria-hidden="true" />,
          },
          {
            component: CNavItem,
            name: 'Mis cursos',
            to: '/courses',
            icon: <CIcon icon={cilBook} customClassName="nav-icon" aria-hidden="true" />,
          },
          {
            component: CNavItem,
            name: 'Mi perfil',
            to: '/my-profile',
            icon: <CIcon icon={cilUser} customClassName="nav-icon" aria-hidden="true" />,
          },
          {
            component: CNavItem,
            name: 'Notificaciones',
            to: '/notifications',
            icon: <CIcon icon={cilBell} customClassName="nav-icon" aria-hidden="true" />,
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
            icon: <CIcon icon={cilUser} customClassName="nav-icon" aria-hidden="true" />,
          },
          {
            component: CNavItem,
            name: 'Clases',
            to: '/lessons',
            icon: <CIcon icon={cilMediaPlay} customClassName="nav-icon" aria-hidden="true" />,
          },
          {
            component: CNavItem,
            name: 'Tareas',
            to: '/tasks',
            icon: <CIcon icon={cilTask} customClassName="nav-icon" aria-hidden="true" />,
          },
          {
            component: CNavItem,
            name: 'Cursos',
            to: '/courses',
            icon: <CIcon icon={cilBook} customClassName="nav-icon" aria-hidden="true" />,
          },
          {
            component: CNavItem,
            name: 'Pagos',
            to: '/payments',
            icon: <CIcon icon={cilMoney} customClassName="nav-icon" aria-hidden="true" />,
            roles: ['admin'],
          },
          {
            component: CNavItem,
            name: 'Usuarios',
            to: '/users',
            icon: <CIcon icon={cilGroup} customClassName="nav-icon" aria-hidden="true" />,
          },
          {
            component: CNavItem,
            name: 'Enviar notificación',
            to: '/send-notifications',
            icon: <CIcon icon={cilBell} customClassName="nav-icon" aria-hidden="true" />,
          },
        ]
      : []

  return [
    {
      component: CNavItem,
      name: 'Dashboard',
      to: '/dashboard',
      icon: <CIcon icon={cilSpeedometer} customClassName="nav-icon" aria-hidden="true" />,
    },
    {
      component: CNavTitle,
      name: 'Academia',
    },
    ...adminItems,
    ...studentItems,
  ]
}
