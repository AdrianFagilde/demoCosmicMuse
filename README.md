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
```

3. Aplica las migraciones de base de datos (carpeta `supabase/migrations/`) en tu proyecto de Supabase, en orden numérico.

4. Inicia la app:

```bash
npm start
```

Abre `http://localhost:3000` en tu navegador.

## Scripts disponibles

| Comando         | Descripción                                  |
| --------------- | -------------------------------------------- |
| `npm start`     | Inicia el servidor de desarrollo en modo HMR |
| `npm run build` | Genera el bundle de producción con Vite      |
| `npm run serve` | Sirve el build de producción localmente      |
| `npm run lint`  | Ejecuta ESLint sobre el código               |

## Estructura del proyecto

```
src/
├── assets/            # Imágenes y logos
├── components/        # Componentes reutilizables de UI (layout, header, breadcrumb)
├── context/           # AuthContext: sesión y perfil de usuario con Supabase
├── hooks/             # Hooks useSupabase* para acceso a datos
├── layout/            # Layout principal de la aplicación
├── lib/               # Cliente de Supabase
├── scss/              # Estilos globales y temas
├── views/
│   ├── academy/       # Estudiantes, clases, tareas, pagos, notificaciones, perfil
│   ├── admin/         # Gestión de usuarios (solo admin)
│   ├── dashboard/     # Panel principal con gráficos
│   └── pages/         # Login y registro
├── App.jsx            # Componente raíz con router y guardas de autenticación
├── auth.js            # Wrapper sobre Supabase Auth
├── navigation.jsx     # Menú lateral configurado por roles
└── routes.js          # Definición de rutas protegidas
supabase/
└── migrations/        # Esquema SQL, políticas RLS y triggers (idempotentes)
```

## Autenticación y roles

La autenticación se realiza contra **Supabase Auth** (`src/context/AuthContext.jsx`):

- Los usuarios se registran desde `/register`; un trigger SQL (`handle_new_user`) crea automáticamente su fila en `profiles`.
- El rol (`admin` / `student`) vive en `profiles` y se sincroniza con el JWT (`user_metadata.role`).
- El rol determina qué elementos aparecen en la navegación y qué rutas son accesibles.
- La autorización real se aplica en PostgreSQL mediante políticas RLS (ver `supabase/migrations/`).

El primer administrador debe crearse manualmente en Supabase (Dashboard → Authentication) y asignarle `role = 'admin'` en la tabla `profiles`.

## Rutas principales

- `/login` - Inicio de sesión
- `/register` - Registro de estudiantes
- `/dashboard` - Panel principal
- `/students` - Listado de estudiantes (admin)
- `/students/:id` - Perfil del estudiante (admin)
- `/lessons` - Clases (admin)
- `/tasks` - Tareas
- `/payments` - Pagos y recordatorios (admin)
- `/users` - Gestión de usuarios (admin)
- `/notifications` - Notificaciones in-app
- `/my-profile` - Perfil personal

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

Configura `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como variables de entorno en Vercel antes del deploy.
