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
  - Un hook por dominio: students, lessons, tasks, payments, reminders, notifications, userNotifications, courses, forms, practice
  - Encapsulan queries, mutaciones y estado de carga; exponen `refetch`
  - Las vistas nunca hablan con Supabase directamente salvo casos puntuales (registro, subida de avatar)
  - `useSupabaseMessaging` y `useSupabasePushNotifications` se eliminaron: sin interfaz de chat ni consumidor, eran código muerto
- `src/hooks/useSupabaseQuery.js`
  - Hook genérico (`useSupabaseQuery(queryFn, autoFetch = true, emptyValue = EMPTY)`) que estandariza `{ data, setData, loading, error, refetch }` y protege el orden de las respuestas contra carreras
  - `emptyValue` es el valor con el que se vacía la data antes de recargar cuando cambia `queryFn` (evita mostrar las filas del estudiante anterior). Se lee a través de un ref y **no** figura entre las dependencias del efecto, de modo que un array u objeto literal en el punto de llamada no provoca recargas infinitas
  - Lo usan los hooks más simples (Tasks, Students, Lessons, Reminders, Notifications, UserNotifications, Practice); los de lógica compleja (Courses, Forms, Payments) mantienen su estructura propia
- `src/context/NotificationContext.jsx`
  - `useSupabaseUserNotifications` se monta una sola vez en `DefaultLayout` y se reparte por contexto. Antes lo consumían `NotificationBell`, `NotificationToasts` y la vista `Notifications`, lo que significaba tres SELECT de 50 filas y tres canales Realtime por página, y contadores de no leídos desincronizados entre campana y toasts
- `src/utils/courses.js`
  - Lógica compartida de cursos, p. ej. `computeStats` (porcentaje de avance por tarea/estudiante)
- `src/utils/dates.js`
  - `parseDbDate` / `localDateKey` / `isOverdue` / `getUrgency`. PostgREST devuelve las columnas `DATE` como `'YYYY-MM-DD'`, que `new Date()` interpreta como medianoche **UTC**; comparar eso contra la medianoche local desplazaba un día y clasificaba mal la urgencia. Toda comparación de fechas de entrega pasa por aquí
- `src/utils/version.js`
  - Fuente única de `BUILD_VERSION` y `buildHash`. El valor lo define `vite.config.mjs` en cada build a partir de `VITE_BUILD_VERSION`, del HEAD de git o de la marca de tiempo; el mismo valor se estampa en `public/sw.js` para el cache busting

## Modelo de datos (Supabase)

Definido en `supabase/migrations/` (idempotentes, aplicar en orden):

| Tabla                  | Descripción                                                                      |
| ---------------------- | -------------------------------------------------------------------------------- |
| `profiles`             | Perfil de usuario (rol, instrumento, nivel, progreso, asistencia, tutor, avatar) |
| `lessons`              | Clases programadas por estudiante                                                |
| `tasks`                | Tareas académicas asignadas                                                      |
| `payments`             | Pagos registrados con comprobante opcional                                       |
| `payment_reminders`    | Recordatorios de pago programados                                                |
| `notification_log`     | Historial de notificaciones enviadas (WhatsApp/manual)                           |
| `notifications`        | Notificaciones in-app por destinatario                                           |
| `instruments`          | Catálogo de instrumentos                                                         |
| `courses`              | Cursos creados por el admin                                                      |
| `course_tasks`         | Tareas dentro de un curso (ordenadas por `position`)                             |
| `task_checklist_items` | Ítems de checklist por tarea (ordenados por `position`)                          |
| `course_enrollments`   | Inscripción manual de estudiantes a cursos                                       |
| `checklist_progress`   | Marcado de ítems por estudiante (fuente del % de avance)                         |

Buckets de Storage: `avatars` (público) y `payment-proofs` (privado, solo admin).

### Seguridad (RLS)

La autorización se aplica íntegramente en PostgreSQL (`supabase/migrations/007_security_hardening.sql`):

- La función `public.is_admin()` (SECURITY DEFINER, STABLE) lee el rol desde la tabla `profiles`, nunca desde metadatos editables del JWT. Todas las políticas de administración pasan por ella.
- La migración `016_security_fixes.sql` endurece: los RPC de mensajería (014) y `get_weekly_practice_summary`/`get_next_badges` (013/015) verifican `auth.uid()` y revocan permisos de `PUBLIC`; se bloquea el auto-reporte de streak de práctica (trigger `trg_block_practice_tampering`) y se limita el XP a 120 min por sesión (`LEAST`); `submit_form` valida la pregunta y limpia respuestas huérfanas; las notificaciones solo se insertan enviadas por uno mismo o por un admin (anti-spam); `is_admin()` deja de ser ejecutable por `PUBLIC`.
- Los estudiantes solo pueden leer/actualizar sus propias filas (`id = auth.uid()` / `student_id = auth.uid()`) y leer los perfiles de staff (`role = 'admin'`) necesarios para mostrar profesores.
- El campo `profiles.role` está protegido por el trigger `trg_protect_profiles_role`: solo un admin puede modificarlo (con bypass para service_role y contextos sin HTTP).
- El trigger `handle_new_user` crea el perfil tras el registro forzando siempre `role = 'student'`.
- Storage `payment-proofs`: cada estudiante solo accede a los comprobantes de su propia carpeta (`(storage.foldername(name))[1] = auth.uid()::text`).

> Nota: el JWT `role` de Supabase siempre es `authenticated`; el rol de aplicación vive únicamente en la tabla `profiles`.

### Creación de estudiantes

- `supabase/functions/create-student/index.ts`: Edge Function que verifica que el llamador sea admin vía `profiles` y crea el usuario con `auth.admin.createUser` usando la service role key. El cliente nunca invoca signUp con privilegios de staff.

### Notificaciones push

- `supabase/functions/send-push-notification/index.ts`: Edge Function que envía notificaciones web push con `web-push`. Solo un admin, o el propio destinatario, puede enviarse push; limpia suscripciones inválidas (404/410). Requiere los secretos `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`.

## Vistas principales

- `src/views/dashboard/Dashboard.jsx` - Métricas y gráficos (ingresos por mes, estudiantes por instrumento, progreso)
- `src/views/courses/` - Cursos: `Courses.jsx`, `CourseDetail.jsx` (admin/estudiante) y `CourseFormFill.jsx`, apoyados en `src/components/` (FormEditorModal, FormResponsesModal, ChecklistBuilder, MaterialList, CourseSortableRows, TaskEditorModal)
- `src/views/academy/Students.jsx` + `StudentDetail.jsx` - CRUD y métricas de estudiantes
- `src/views/academy/Lessons.jsx` - Programación de clases (admin)
- `src/views/academy/Payments.jsx` - Pagos y recordatorios (admin), con subcomponentes en `payments/`
- `src/views/admin/Users.jsx` - Gestión de roles y estados de usuario (admin)
- `src/views/academy/Notifications.jsx` - Envío y lectura de notificaciones in-app
- `src/views/pages/login|register` - Autenticación

## Build y despliegue

- `npm run build` genera el bundle en `build/`
- `vite.config.mjs` resuelve la versión de build (`VITE_BUILD_VERSION` → HEAD de git → marca de tiempo), la inyecta en `import.meta.env.VITE_BUILD_VERSION` y estampa `public/sw.js` en `closeBundle` para que el nombre de la caché cambie en cada despliegue
- Deploy en **Vercel**: `vercel.json` define el rewrite SPA, `Cache-Control: immutable` para `/assets/(.*)` y `no-store` para el resto. La regla general excluye explícitamente `assets/` y `sw.js` con un lookahead negativo, para que el `no-store` no pise el cacheo inmutable independientemente del orden en que Vercel aplique las cabeceras
- Cabeceras de seguridad aplicadas por `vercel.json`: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `X-DNS-Prefetch-Control` y `Permissions-Policy` (cámara, geolocalización, micrófono y pagos restringidos; la app no usa ninguno). Ajustar si se incorporan funciones que los necesiten
- Variables de entorno requeridas en el host: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; opcional: `VITE_VAPID_PUBLIC_KEY` (notificaciones push) y `VITE_BUILD_VERSION`
- Secretos de Edge Functions en Supabase: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, y la service role key si se usa el flujo local

## PWA y offline

- `index.html` enlaza `public/site.webmanifest`; sin ese enlace los navegadores no instalan la PWA
- `public/sw.js` cachea **solo el propio origen**. El tráfico a `*.supabase.co` se deja pasar: sus respuestas dependen de la cabecera de autorización, no de la URL, así que cachearlas podría devolver los datos de un usuario a otro
- Navegaciones _network first_ con `/index.html` de respaldo; assets con hash _cache first_; el resto del mismo origen va directo a la red
- `activate` borra cualquier caché con otra versión; `clearCache` preserva la activa para no dejar el worker sin shell offline
- La actualización pide confirmación y recarga en `controllerchange`, no antes: recargar mientras sigue activo el worker viejo descarta el bundle recién descargado

## Tareas de mantenimiento

- Mantener actualizadas las dependencias de CoreUI y React
- Toda nueva tabla debe incluir sus políticas RLS desde el inicio
- Nuevas rutas administrativas deben declarar `roles: ['admin']` en `routes.js`
- Una política RLS no puede comparar con la fila anterior: para impedir que alguien cambie una columna concreta hay que usar un trigger `BEFORE UPDATE` con `OLD` (ver `trg_restrict_notification_update` y `trg_restrict_student_profile_update` en la migración 017)
- Las fechas `DATE` que llegan de PostgREST como `'YYYY-MM-DD'` se comparan siempre con `src/utils/dates.js`, nunca con `new Date()` directo
- No hay suite de tests: `npm run lint` + `npm run build` es la puerta mínima, y `supabase/VERIFICACION_017.sql` cubre lo que solo puede comprobarse contra la base de datos
