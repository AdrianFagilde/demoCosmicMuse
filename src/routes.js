/**
 * Application Routes Configuration
 *
 * Defines all protected routes in the application using React lazy loading
 * for code splitting and performance optimization.
 *
 * Each route object contains:
 * - path: URL path for the route
 * - name: Human-readable name for breadcrumbs
 * - element: Lazy-loaded React component
 * - exact: (optional) Requires exact path match
 *
 * @module routes
 */

import React from 'react'

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const Students = React.lazy(() => import('./views/academy/Students'))
const StudentDetail = React.lazy(() => import('./views/academy/StudentDetail'))
const Tasks = React.lazy(() => import('./views/academy/Tasks'))
const MyProfile = React.lazy(() => import('./views/academy/MyProfile'))
const Payments = React.lazy(() => import('./views/academy/Payments'))

/**
 * Application Routes Configuration
 *
 * Defines the protected routes used by the academy application.
 */
export const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },
  { path: '/students', name: 'Perfiles', element: Students },
  { path: '/students/:id', name: 'Perfil de estudiante', element: StudentDetail },
  { path: '/tasks', name: 'Tareas', element: Tasks },
  { path: '/payments', name: 'Pagos', element: Payments, roles: ['admin'] },
  { path: '/my-profile', name: 'Mi perfil', element: MyProfile },
]

export default routes
