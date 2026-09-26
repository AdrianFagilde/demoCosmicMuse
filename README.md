# Cosmic Muse Academy

Panel de administración y gestión para la academia musical Cosmic Muse.
Aplicación React + Vite con componentes CoreUI, backend Supabase (PostgreSQL + Auth + Storage) y roles de administrador y estudiante: gestión de estudiantes, clases, tareas, pagos y notificaciones.

## Características principales

- React 19 con Vite para desarrollo rápido y compilación optimizada
- UI basada en CoreUI React y Bootstrap 5
- Autenticación con Supabase Auth (email/contraseña) y perfiles en PostgreSQL
- Rutas protegidas y navegación basada en roles (admin / student)
- Seguridad a nivel de fila (RLS) en Supabase: los estudiantes solo acceden a sus propios datos
- Gestión de estudiantes, clases y tareas académicas
- Registro de pagos con comprobantes en Storage, recordatorios e historial de notificaciones
- Notificaciones in-app en tiempo real (Supabase Realtime)
- Gráficos del dashboard con Recharts

## Quick Start

1. Instala dependencias:

```bash
npm install
```

2. Configura las variables de entorno (ver `.env.example`):

```bash
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
VITE_VAPID_PUBLIC_KEY=<opcional, para notificaciones web push>
```

3. Aplica las migraciones de base de datos de `supabase/migrations/` **en orden numérico**, una vez cada una. No son idempotentes y no deberían serlo: la 017 lo demostró en producción, donde un tipo de retorno equivocado abortó el `CREATE OR REPLACE` con `42P13` después de que las nueve sentencias anteriores ya se hubieran aplicado. Si una migración falla, envuélvela en `BEGIN`/`COMMIT` completo en lugar de reintentarla a medias. Ver `supabase/BASELINE.md`.

   Con la CLI de Supabase y un stack **local** (requiere Docker):

   ```bash
   supabase start        # levanta la BD local definida en supabase/config.toml
   supabase db reset     # recrea la BD local y aplica 001..017
   supabase db lint      # advisor de seguridad
   ```

   > Si el proyecto está enlazado a producción (`supabase link`), `supabase db push` aplicaría **en producción**. Revisa siempre el diff de migraciones antes de empujar. `supabase/VERIFICACION_017.sql` contiene las comprobaciones para después de aplicar la 017, y `supabase/BASELINE.md` documenta el procedimiento de referencia del esquema.

4. Inicia la app:

```bash
npm start
```

Abre `http://localhost:3000` en tu navegador.

## Scripts disponibles

| Comando          | Descripción                                  |
| ---------------- | -------------------------------------------- |
| `npm start`      | Inicia el servidor de desarrollo en modo HMR |
| `npm run build`  | Genera el bundle de producción con Vite      |
| `npm run serve`  | Sirve el build de producción localmente      |
| `npm run lint`   | Ejecuta ESLint sobre el código               |
| `npm run format` | Aplica Prettier a todo el proyecto           |

No hay suite de tests automatizados. La verificación es `npm run lint` + `npm run build`, más el script `supabase/VERIFICACION_017.sql` para lo que solo puede comprobarse contra la base de datos.

## Estructura del proyecto

```
src/
├── assets/            # Imágenes y logos
├── components/        # Componentes reutilizables de UI (layout, header, dashboard)
├── context/           # AuthContext (sesión y perfil) y NotificationContext (fuente única de avisos)
├── hooks/             # Hooks useSupabase* para acceso de datos, sobre useSupabaseQuery
├── layout/            # Layout principal de la aplicación
├── lib/               # Cliente de Supabase
├── scss/              # Estilos globales y temas
├── utils/             # Fechas locales, formato y versión de build
├── views/
│   ├── academy/       # Estudiantes, clases, tareas, pagos, notificaciones, perfil
│   ├── admin/         # Gestión de usuarios y envío de avisos (solo admin)
│   ├── courses/       # Cursos, contenido y cuestionarios
│   ├── dashboard/     # Panel principal con gráficos
│   └── pages/         # Login y registro
├── App.jsx            # Componente raíz con router y guardas de autenticación
├── auth.js            # Wrapper sobre Supabase Auth
├── navigation.jsx     # Menú lateral configurado por roles
└── routes.js          # Definición de rutas protegidas
public/
├── site.webmanifest   # Manifiesto PWA (instalable)
└── sw.js              # Service worker: shell offline y push
supabase/
├── config.toml        # Configuración del stack local
├── migrations/        # Esquema SQL, políticas RLS y triggers (aplicar en orden, una vez)
├── functions/         # Edge Functions (create-student, delete-user, send-push-notification)
├── BASELINE.md        # Estado del esquema, cómo detectar drift y qué corrigió la 017
└── VERIFICACION_017.sql  # Comprobaciones tras aplicar la migración 017
```

## Autenticación y roles

La autenticación se realiza contra **Supabase Auth** (`src/context/AuthContext.jsx`):

- Los usuarios se registran desde `/register`; un trigger SQL (`handle_new_user`) crea automáticamente su fila en `profiles`.
- El rol (`admin` / `student`) vive en `profiles` y se sincroniza con el JWT (`user_metadata.role`).
- El rol determina qué elementos aparecen en la navegación y qué rutas son accesibles.
- La autorización real se aplica en PostgreSQL mediante políticas RLS (ver `supabase/migrations/`).

El primer administrador debe crearse manualmente en Supabase (Dashboard → Authentication) y asignarle `role = 'admin'` en la tabla `profiles`.

## Rutas principales

Definidas en `src/routes.js`. El control de acceso real está en las políticas RLS, no solo aquí.

| Ruta                               | Acceso  | Descripción                      |
| ---------------------------------- | ------- | -------------------------------- |
| `/login`, `/register`              | público | Inicio de sesión y registro      |
| `/dashboard`                       | todos   | Panel principal                  |
| `/tasks`                           | todos   | Tareas                           |
| `/notifications`                   | student | Bandeja de notificaciones in-app |
| `/my-profile`                      | todos   | Perfil personal                  |
| `/courses`, `/courses/:id`         | todos   | Cursos y detalle                 |
| `/courses/:courseId/forms/:formId` | todos   | Cuestionario de un curso         |
| `/students`, `/students/:id`       | admin   | Listado y ficha de estudiantes   |
| `/lessons`                         | admin   | Clases                           |
| `/payments`                        | admin   | Pagos, recordatorios e historial |
| `/users`                           | admin   | Gestión de usuarios              |
| `/send-notifications`              | admin   | Enviar avisos a grupos           |

Cualquier ruta no declarada redirige a `/dashboard`.

## PWA

`index.html` enlaza `public/site.webmanifest` y `src/index.jsx` registra `public/sw.js`.

- El service worker cachea **solo recursos del propio origen** (el shell y los assets con hash). El tráfico a `*.supabase.co` nunca se intercepta ni se cachea, porque las respuestas autenticadas se indexarían únicamente por URL.
- Las navegaciones van _network first_ con el shell como respaldo offline; los assets con hash van _cache first_.
- El nombre de la caché incluye la versión de build, que `vite.config.mjs` deriva de `VITE_BUILD_VERSION`, del HEAD de git o de la marca de tiempo. Al activarse una versión nueva se purgan las cachés anteriores.
- La actualización no se recarga sola: se pregunta al usuario y, al aceptar, se envía `skipWaiting` al worker; la recarga ocurre en `controllerchange`, cuando el shell nuevo ya está activo.

## Nota sobre mensajería

Las tablas de mensajería (`messages`, `conversation_participants`) y la Edge Function `send-push-notification` siguen existiendo, pero **no hay interfaz de chat en la app** y sus rutas fueron retiradas. La 017 corrige sus políticas RLS y bloquea la reasignación de participantes para que no sigan siendo explotables por API directa. Si se va a recuperar el chat, hay que rehacer la capa de cliente (los hooks `useSupabaseMessaging` y `useSupabasePushNotifications` se han eliminado por estar sin uso).

## Documentación adicional

- `ARCHITECTURE.md` - Arquitectura del proyecto y stack técnico
- `DEVELOPMENT.md` - Guía de desarrollo y mejores prácticas
- `supabase/migrations/` - Esquema de base de datos y políticas de seguridad

## Dependencias clave

- React 19
- CoreUI React 5
- Supabase JS v2
- React Router DOM 7
- Recharts
- Vite

## Notas de despliegue

El proyecto está configurado para desplegarse en **Vercel** (`vercel.json` incluye rewrites para SPA y cacheo de assets).

```bash
npm run build
npm run serve   # verificación local del build
```

Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables de entorno en Vercel antes del deploy. Para notificaciones push, despliega también las Edge Functions y configura los secretos `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` en Supabase (y `VITE_VAPID_PUBLIC_KEY` en el front).
