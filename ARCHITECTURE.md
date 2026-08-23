# Arquitectura de Cosmic Muse Academy

Este documento describe la arquitectura de la aplicación Cosmic Muse Academy, su estructura de carpetas, el flujo de rutas y las decisiones de diseño principales.

## Visión general

Cosmic Muse Academy es una SPA construida con React 19, Vite y CoreUI React, con backend en Supabase (PostgreSQL + Auth + Storage). Está diseñada como un panel administrativo estratificado donde los administradores gestionan estudiantes, clases, usuarios y pagos mientras que los estudiantes acceden a su perfil, tareas y notificaciones.

## Stack tecnológico

- React 19
- Vite 8
- CoreUI React 5
- Bootstrap 5
- Supabase JS v2 (Auth, Postgres con RLS, Storage, Realtime)
- React Router DOM 7
- Recharts
- Sass

## Estructura de la aplicación

### App raíz

- `src/App.jsx`
  - Configura `BrowserRouter`
  - Envuelve las rutas protegidas en `RequireAuth`
  - Rutas públicas: `/login` y `/register`

### Autenticación

- `src/context/AuthContext.jsx`
  - Expone `{ user, profile, login, logout, loading, isAuthenticated }`
  - Restaura la sesión al cargar (`getCurrentSession`) y escucha `onAuthStateChange`
  - Carga el perfil desde la tabla `profiles`; el rol de aplicación nunca se escribe ni se lee del JWT
- `src/auth.js`
  - Wrapper delgado sobre Supabase Auth: `login`, `logout`, `getCurrentSession`, `getProfile`
- `src/lib/supabase.js`
  - Cliente único de Supabase; valida que existan `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

### Layout principal

- `src/layout/DefaultLayout.jsx`
  - Renderiza `AppSidebar`, `AppHeader`, `AppContent` y `AppFooter`

### Contenido y rutas

- `src/routes.js`
  - Define rutas lazy-loaded con roles permitidos opcionales (`roles: ['admin']`)
- `src/components/AppContent.jsx`
  - Mapea `routes` y renderiza cada ruta
  - Comprueba `route.roles` y redirige a `/dashboard` si el usuario no está autorizado

### Navegación

- `src/navigation.jsx`
  - Construye la barra lateral según el rol del perfil
  - Opciones exclusivas de admin: Perfiles, Clases, Pagos, Usuarios

### Acceso a datos

- `src/hooks/useSupabase*.js`
  - Un hook por dominio: students, lessons, tasks, payments, reminders, notifications, userNotifications
  - Encapsulan queries, mutaciones y estado de carga; exponen `refetch`
  - Las vistas nunca hablan con Supabase directamente salvo casos puntuales (registro, subida de avatar)

## Modelo de datos (Supabase)

Definido en `supabase/migrations/` (idempotentes, aplicar en orden):

| Tabla               | Descripción                                                                      |
| ------------------- | -------------------------------------------------------------------------------- |
| `profiles`          | Perfil de usuario (rol, instrumento, nivel, progreso, asistencia, tutor, avatar) |
| `lessons`           | Clases programadas por estudiante                                                |
| `tasks`             | Tareas académicas asignadas                                                      |
| `payments`          | Pagos registrados con comprobante opcional                                       |
| `payment_reminders` | Recordatorios de pago programados                                                |
| `notification_log`  | Historial de notificaciones enviadas (WhatsApp/manual)                           |
| `notifications`     | Notificaciones in-app por destinatario                                           |
| `instruments`       | Catálogo de instrumentos                                                         |

Buckets de Storage: `avatars` (público) y `payment-proofs` (privado, solo admin).

### Seguridad (RLS)

La autorización se aplica íntegramente en PostgreSQL (`supabase/migrations/007_security_hardening.sql`):

- La función `public.is_admin()` (SECURITY DEFINER, STABLE) lee el rol desde la tabla `profiles`, nunca desde metadatos editables del JWT. Todas las políticas de administración pasan por ella.
- Los estudiantes solo pueden leer/actualizar sus propias filas (`id = auth.uid()` / `student_id = auth.uid()`) y leer los perfiles de staff (`role = 'admin'`) necesarios para mostrar profesores.
- El campo `profiles.role` está protegido por el trigger `trg_protect_profiles_role`: solo un admin puede modificarlo (con bypass para service_role y contextos sin HTTP).
- El trigger `handle_new_user` crea el perfil tras el registro forzando siempre `role = 'student'`.
- Storage `payment-proofs`: cada estudiante solo accede a los comprobantes de su propia carpeta (`(storage.foldername(name))[1] = auth.uid()::text`).

> Nota: el JWT `role` de Supabase siempre es `authenticated`; el rol de aplicación vive únicamente en la tabla `profiles`.

### Creación de estudiantes

- `supabase/functions/create-student/index.ts`: Edge Function que verifica que el llamador sea admin vía `profiles` y crea el usuario con `auth.admin.createUser` usando la service role key. El cliente nunca invoca signUp con privilegios de staff.

## Vistas principales

- `src/views/dashboard/Dashboard.jsx` - Métricas y gráficos (ingresos por mes, estudiantes por instrumento, progreso)
- `src/views/academy/Students.jsx` + `StudentDetail.jsx` - CRUD y métricas de estudiantes
- `src/views/academy/Lessons.jsx` - Programación de clases (admin)
- `src/views/academy/Payments.jsx` - Pagos y recordatorios (admin), con subcomponentes en `payments/`
- `src/views/admin/Users.jsx` - Gestión de roles y estados de usuario (admin)
- `src/views/academy/Notifications.jsx` - Envío y lectura de notificaciones in-app
- `src/views/pages/login|register` - Autenticación

## Build y despliegue

- `npm run build` genera el bundle en `build/`
- Deploy en **Vercel**: `vercel.json` define rewrites SPA y cacheo immutable de assets
- Variables de entorno requeridas en el host: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Tareas de mantenimiento

- Mantener actualizadas las dependencias de CoreUI y React
- Toda nueva tabla debe incluir sus políticas RLS desde el inicio
- Nuevas rutas administrativas deben declarar `roles: ['admin']` en `routes.js`
