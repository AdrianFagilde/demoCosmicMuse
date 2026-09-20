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
const Courses = React.lazy(() => import('./views/courses/Courses'))
const CourseDetail = React.lazy(() => import('./views/courses/CourseDetail'))
const CourseFormFill = React.lazy(() => import('./views/courses/CourseFormFill'))
const MyProfile = React.lazy(() => import('./views/academy/MyProfile'))
const Payments = React.lazy(() => import('./views/academy/Payments'))
const Lessons = React.lazy(() => import('./views/academy/Lessons'))
const Users = React.lazy(() => import('./views/admin/Users'))
const SendNotifications = React.lazy(() => import('./views/admin/SendNotifications'))
const Notifications = React.lazy(() => import('./views/academy/Notifications'))
const PracticeTools = React.lazy(() => import('./views/academy/PracticeTools'))
const Messages = React.lazy(() => import('./views/academy/Messages'))
const Leaderboard = React.lazy(() => import('./views/academy/Leaderboard'))
const Analytics = React.lazy(() => import('./views/academy/Analytics'))
const ParentPortal = React.lazy(() => import('./views/academy/ParentPortal'))

/**
 * Application Routes Configuration
 *
 * Defines the protected routes used by the academy application.
 */
export const routes = [
  { path: '/', exact: true, name: 'Home' },
  { path: '/dashboard', name: 'Dashboard', element: Dashboard },
  { path: '/students', name: 'Perfiles', element: Students, roles: ['admin'] },
  {
    path: '/students/:id',
    name: 'Perfil de estudiante',
    element: StudentDetail,
    roles: ['admin'],
  },
  { path: '/lessons', name: 'Clases', element: Lessons, roles: ['admin'] },
  { path: '/tasks', name: 'Tareas', element: Tasks },
  { path: '/courses', name: 'Cursos', element: Courses },
  { path: '/courses/:id', name: 'Curso', element: CourseDetail },
  {
    path: '/courses/:courseId/forms/:formId',
    name: 'Cuestionario',
    element: CourseFormFill,
  },
  {
    path: '/practice-tools',
    name: 'Herramientas de práctica',
    element: PracticeTools,
    roles: ['student'],
  },
  { path: '/messages', name: 'Mensajes', element: Messages, roles: ['student'] },
  { path: '/leaderboard', name: 'Ranking', element: Leaderboard, roles: ['student'] },
  { path: '/analytics', name: 'Analítica', element: Analytics, roles: ['student'] },
  { path: '/parent-portal', name: 'Portal de tutores', element: ParentPortal, roles: ['student'] },
  { path: '/payments', name: 'Pagos', element: Payments, roles: ['admin'] },
  { path: '/users', name: 'Usuarios', element: Users, roles: ['admin'] },
  {
    path: '/send-notifications',
    name: 'Enviar notificacion',
    element: SendNotifications,
    roles: ['admin'],
  },
  { path: '/notifications', name: 'Notificaciones', element: Notifications, roles: ['student'] },
  { path: '/my-profile', name: 'Mi perfil', element: MyProfile },
]

export default routes
