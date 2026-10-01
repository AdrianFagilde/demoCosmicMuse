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

Definido en `supabase/migrations/` (aplicar en orden, una vez cada una):

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
| `course_forms`        | Formularios de un curso                                                          |
| `form_questions`      | Preguntas de un formulario (texto, opción, archivo)                               |
| `form_answers`        | Respuestas a esas preguntas                                                      |
| `form_submissions`    | Envíos de formulario por estudiante                                              |
| `course_materials`    | Material descargable de un curso                                                  |
| `practice_sessions`   | Sesiones de práctica con minutos, XP y fecha                                      |
| `practice_streaks`    | Rachas por estudiante (actualizadas por trigger, no editables)                   |
| `student_gamification` | XP, nivel, minutos y contadores por estudiante                                  |
| `student_badges`      | Insignias otorgadas (incluye su fecha `earned_at`)                                |

Buckets de Storage: `avatars` (público) y `payment-proofs` (privado, solo admin).

> **Nota sobre "sin interfaz".** Un esquema desplegado sin consumidor en
> `src/` no es una feature dormida que se pueda activar tal cual, porque el
> esquema sí está expuesto por PostgREST y la anon key es pública, así que
> cualquier hueco de RLS es explotable sin que nadie use la feature.
>
> `push_subscriptions` fue exactamente ese caso y terminó borrada: la 031
> retiró la tabla de suscripciones Web Push junto con la Edge Function
> `send-push-notification` y los listeners `push`/`notificationclick` de
> `public/sw.js`, porque la app avisa por la tabla `notifications` y los
> toasts in-app, sin necesidad de guardar endpoints VAPID (que son
> credenciales de envío).
>
> El módulo de mensajería fue el mismo caso y terminó borrado: la 014
> dejó dos políticas de `messages` con una comparación tautológica que permitía
> leer e inyectar mensajes en conversaciones ajenas, y nadie lo notó porque no
> había UI que lo delatara. La 017 y la 019 lo corrigieron sobre el papel, pero
> mientras el esquema siga publicado el riesgo sigue ahí, así que la 028 borró
> `conversations`, `conversation_participants` y `messages` (vacías, sin código
> y con 11 políticas). Antes de construir un chat hay que empezar por el modelo
> de datos, no por las políticas. Detalle en `supabase/BASELINE.md`.
>
> El mismo género de error costó caro en `profiles_with_metrics`, y ahí sí
> había UI: la 023 creó una vista con `p.*` y le dio `GRANT SELECT`, pero
> **una vista se ejecuta con los permisos de su propietario**, de modo que las
> políticas RLS de `profiles` no se aplicaban y la vista devolvía los 12
> perfiles a cualquier alumno, con email, teléfono y datos del tutor. La 027 la
> recrea con `security_invoker = true`. Cualquier vista nueva necesita ese
> atributo, y merece una comprobación contando filas con la sesión de un
> alumno, no leyendo el `CREATE VIEW`.


### Seguridad (RLS)

La autorización se aplica íntegramente en PostgreSQL (`supabase/migrations/007_security_hardening.sql`):

- La función `public.is_admin()` (SECURITY DEFINER, STABLE) lee el rol desde la tabla `profiles`, nunca desde metadatos editables del JWT. Todas las políticas de administración pasan por ella.
- La migración `016_security_fixes.sql` endurece: los RPC de mensajería (014) y `get_weekly_practice_summary`/`get_next_badges` (013/015) verifican `auth.uid()` y revocan permisos de `PUBLIC`; se bloquea el auto-reporte de streak de práctica (trigger `trg_block_practice_tampering`) y se limita el XP a 120 min por sesión (`LEAST`); `submit_form` valida la pregunta y limpia respuestas huérfanas; las notificaciones solo se insertan enviadas por uno mismo o por un admin (anti-spam); `is_admin()` deja de ser ejecutable por `PUBLIC`.
- Los estudiantes solo pueden leer/actualizar sus propias filas (`id = auth.uid()` / `student_id = auth.uid()`) y leer los perfiles de staff (`role = 'admin'`) necesarios para mostrar profesores. **Actualizar la fila propia no significa poder cambiar cualquier columna:** el trigger `trg_restrict_student_profile_update` (017) rechaza con `42501` si cambian `email`, `username`, `status`, `progress`, `attendance`, `teacher`, `next_lesson`, `created_at` o `id`, y `trg_protect_profiles_role` (007) rechaza `role`. Sigue siendo válido cambiar `full_name`, `phone`, `instrument`, `level`, `birth_date`, `avatar_url` y los campos de tutor, aunque `MyProfile.jsx` solo ofrezca cuatro de ellos.
- La migración `017_security_corrections.sql` (aplicada el 2026-09-25) endurece cinco cosas más: las políticas de lectura de `course_tasks`, `course_forms` y `course_materials` solo exponen contenido de cursos en los que el alumno está matriculado, antes permitían leer cursos ajenos; `conversation_participants` gana un trigger `BEFORE UPDATE` que impide mover la participación a otra conversación; la política "User delete own messages" estaba declarada `FOR UPDATE` y ahora hay un `DELETE` real; y las notificaciones recibidas y el perfil quedan inmutables salvo `read` y los campos de identidad respectivamente. Detalle en `supabase/BASELINE.md`.
- El campo `profiles.role` está protegido por el trigger `trg_protect_profiles_role`: solo un admin puede modificarlo (con bypass para service_role y contextos sin HTTP).
- El trigger `handle_new_user` crea el perfil tras el registro forzando siempre `role = 'student'`.
- La tabla `notifications` está publicada en `supabase_realtime` desde la migración `018_realtime_notifications.sql` (aplicada). Sin esa publicación, la suscripción de `useSupabaseUserNotifications` no recibe eventos y las notificaciones in-app solo se actualizan al recargar. La 018 es idempotente: envuelve su sentencia en un `DO $$` que consulta `pg_publication_tables` antes de ejecutar el `ALTER PUBLICATION`. No toca `REPLICA IDENTITY`, porque la identidad por defecto basta para un filtro que compara el registro nuevo.
- Storage `payment-proofs`: cada estudiante solo accede a los comprobantes de su propia carpeta (`(storage.foldername(name))[1] = auth.uid()::text`).
- La migración `019_fix_messaging_rls_policies.sql` (aplicada, y después superada) corregía las dos políticas de `messages` que la 014 dejó tautológicas por una columna sin qualificar dentro de un subquery, lo que en PostgreSQL se resuelve al scope interno. Permitía leer los mensajes de todas las conversaciones e insertar en conversaciones ajenas, sin necesidad de interfaz porque PostgREST expone el esquema. La 028 borró las tablas, así que ya no hay nada que proteger ahí.
- La migración `020_integrity_constraints.sql` (aplicada) añade CHECK `NOT VALID` en `form_answers` (como mucho un valor por respuesta), `practice_sessions` (como mucho una referencia de tarea) y `practice_sessions.metronome_bpm` (rango 20-300). No mueven datos ni cambian el modelo: los triggers de 013/016 siguen siendo los dueños de la lógica de negocio.
- La 021 unificó `tasks` y `course_tasks` en una sola tabla, con un CHECK `assignments_context_xor` que obliga a que una tarea tenga **exactamente** uno de `course_id` o `student_id`. Esa exclusividad es la razón de que el progreso de una tarea de curso viva en `checklist_progress` y no en la tarea, y de que el feed tenga que traer las dos clases de tarea en lugar de filtrar por `student_id`.
- La 024 introduce `is_enrolled_in(course_id)` y reescribe nueve políticas para que la pertenencia a un curso se compruebe siempre contra esa función, en lugar de repetir un `EXISTS` sobre `course_enrollments` en cada política.
- La 027 recrea `profiles_with_metrics` con `security_invoker = true` y elimina las políticas que dejaban al alumno escribir `student_metrics` y su propia fila de `profiles`. Los detalles y las mediciones están en la nota de arriba y en `supabase/BASELINE.md`.

> Nota: el JWT `role` de Supabase siempre es `authenticated`; el rol de aplicación vive únicamente en la tabla `profiles`.

### Creación de estudiantes

- `supabase/functions/create-student/index.ts`: Edge Function que verifica que el llamador sea admin vía `profiles` y crea el usuario con `auth.admin.createUser` usando la service role key. El cliente nunca invoca signUp con privilegios de staff.

### Notificaciones

- **In-app únicamente.** Los avisos viven en la tabla `notifications` (publicada en Realtime) y se presentan con la campana del header (`NotificationBell`) y los toasts (`NotificationToasts`, que además renderiza los avisos ad-hoc de `showAppToast` en `src/utils/appToasts.js`, con posición, acciones y persistencia configurables).
- Las confirmaciones que antes eran `confirm()` nativo del navegador usan `ConfirmModal` (`src/components/ConfirmModal.jsx`); el aviso de "nueva versión del SW" lo dispara `index.jsx` con `announceAppUpdate()` y lo muestra `AppUpdatePrompt` como modal.
- El Web Push se retiró por completo en la migración 031: no hay Edge Function de envío, ni tabla de suscripciones, ni listeners `push`/`notificationclick` en el service worker (que sigue gestionando solo el shell offline y la actualización del bundle). Los secretos `VAPID_*` ya no hacen falta.

## Vistas principales

- `src/views/dashboard/Dashboard.jsx` - Métricas y gráficos (ingresos por mes, estudiantes por instrumento, progreso)
- `src/views/courses/` - Cursos: `Courses.jsx`, `CourseDetail.jsx` (admin/estudiante) y `CourseFormFill.jsx`, apoyados en `src/components/` (FormEditorModal, FormResponsesModal, ChecklistBuilder, MaterialList, CourseSortableRows, TaskEditorModal)
- `src/views/academy/Students.jsx` + `StudentDetail.jsx` - CRUD y métricas de estudiantes
- `src/views/academy/Lessons.jsx` - Programación de clases (admin)
- `src/views/academy/Payments.jsx` - Pagos y recordatorios (admin), con subcomponentes en `payments/`
- `src/views/admin/Users.jsx` - Gestión de roles y estados de usuario (admin)
- `src/views/academy/Notifications.jsx` - Bandeja personal de notificaciones, solo lectura: el alumno únicamente puede marcar `read`. El envío vive en `src/views/admin/SendNotifications.jsx` (admin), y el trigger `trg_restrict_notification_update` (017) rechaza con `42501` si el alumno intenta reescribir el texto o el remitente de una notificación recibida.
- `src/views/pages/login|register` - Autenticación

## Build y despliegue

- `npm run build` genera el bundle en `build/`
- `vite.config.mjs` resuelve la versión de build (`VITE_BUILD_VERSION` → HEAD de git → marca de tiempo), la inyecta en `import.meta.env.VITE_BUILD_VERSION` y estampa `public/sw.js` en `closeBundle` para que el nombre de la caché cambie en cada despliegue
- Deploy en **Vercel**: `vercel.json` define el rewrite SPA, `Cache-Control: immutable` para `/assets/(.*)` y `no-store` para el resto. La regla general excluye explícitamente `assets/` y `sw.js` con un lookahead negativo, para que el `no-store` no pise el cacheo inmutable independientemente del orden en que Vercel aplique las cabeceras
- Cabeceras de seguridad aplicadas por `vercel.json`: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `X-DNS-Prefetch-Control` y `Permissions-Policy` (cámara, geolocalización, micrófono y pagos restringidos; la app no usa ninguno). Ajustar si se incorporan funciones que los necesiten
- Variables de entorno requeridas en el host: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; opcional: `VITE_BUILD_VERSION`. La anon key es pública por diseño y la autorización la impone RLS, así que no es un secreto
- Secretos de Edge Functions en Supabase: la service role key si se usa el flujo local (los `VAPID_*` se retiraron con el Web Push en la 031)

## PWA y offline

- `index.html` enlaza `public/site.webmanifest`; sin ese enlace los navegadores no instalan la PWA
- `public/sw.js` cachea **solo el propio origen**. El tráfico a `*.supabase.co` se deja pasar: sus respuestas dependen de la cabecera de autorización, no de la URL, así que cachearlas podría devolver los datos de un usuario a otro
- Navegaciones _network first_ con `/index.html` de respaldo; assets con hash _cache first_; el resto del mismo origen va directo a la red
- `activate` borra cualquier caché con otra versión; `clearCache` preserva la activa para no dejar el worker sin shell offline
- La actualización pide confirmación con el `ConfirmModal` de `AppUpdatePrompt` (antes `confirm()` nativo) y recarga en `controllerchange`, no antes: recargar mientras sigue activo el worker viejo descarta el bundle recién descargado

## Tareas de mantenimiento

- Mantener actualizadas las dependencias de CoreUI y React
- Toda nueva tabla debe incluir sus políticas RLS desde el inicio
- Nuevas rutas administrativas deben declarar `roles: ['admin']` en `routes.js`
- Una política RLS no puede comparar con la fila anterior: para impedir que alguien cambie una columna concreta hay que usar un trigger `BEFORE UPDATE` con `OLD` (ver `trg_restrict_notification_update` y `trg_restrict_student_profile_update` en la migración 017)
- Las fechas `DATE` que llegan de PostgREST como `'YYYY-MM-DD'` se comparan siempre con `src/utils/dates.js`, nunca con `new Date()` directo
- No hay suite de tests: `npm run lint` + `npm run build` es la puerta mínima, y `supabase/VERIFICACION_017.sql` cubre lo que solo puede comprobarse contra la base de datos
