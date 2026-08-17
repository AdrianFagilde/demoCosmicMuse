# Arquitectura de Academia Cosmo Music

Este documento describe la arquitectura de la aplicación Academia Cosmo Music, su estructura de carpetas, el flujo de rutas y las decisiones de diseño principales.

## Visión general

Academia Cosmo Music es una aplicación SPA construida con React 19, Vite y CoreUI React. Está diseñada como un panel administrativo estratificado donde los administradores gestionan estudiantes, tareas y pagos mientras que los estudiantes acceden a su perfil y tareas.

## Stack tecnológico

- React 19
- Vite 8
- CoreUI React 5
- Bootstrap 5
- React Router DOM 7
- Redux 5
- Sass

## Estructura de la aplicación

### App raíz

- `src/App.jsx`
  - Configura `HashRouter`
  - Inicializa el modo de color con `useColorModes`
  - Envuelve las rutas protegidas en `RequireAuth`

### Layout principal

- `src/layout/DefaultLayout.jsx`
  - Renderiza `AppSidebar`, `AppHeader`, `AppContent` y `AppFooter`
  - Mantiene la estructura base de la app para rutas autenticadas

### Contenido y rutas

- `src/components/AppContent.jsx`
  - Mapea `routes` desde `src/routes.js`
  - Renderiza cada ruta usando `Routes` y `Route`
  - Comprueba `route.roles` y redirige a `/dashboard` si el usuario no está autorizado

### Navegación

- `src/_nav.jsx`
  - Construye la barra lateral con elementos de navegación
  - Muestra opciones diferentes para `admin` y `student`
  - Incluye la ruta de `Pagos` solo para `admin`

## Autenticación

- `src/auth.js`
  - Implementa login/logout local con datos de usuario en el frontend
  - Guarda la sesión en `localStorage`
  - Funciones clave:
    - `getCurrentUser()`
    - `isAuthenticated()`
    - `login(username, password)`
    - `logout()`

## Rutas y roles

Las rutas definidas en `src/routes.js` son:

- `/` → redirige a `/dashboard`
- `/dashboard` → Dashboard
- `/students` → Perfiles de estudiantes
- `/students/:id` → Perfil de estudiante
- `/tasks` → Tareas
- `/payments` → Pagos (solo admin)
- `/my-profile` → Mi perfil

El control de acceso se aplica en dos lugares:

1. `AppContent.jsx` filtra rutas según `route.roles`
2. `src/_nav.jsx` oculta elementos de menú según el rol del usuario

## Vista de Pagos

- `src/views/academy/Payments.jsx`
  - Página exclusiva para administradores
  - Registra pagos nuevos
  - Configura recordatorios de pago con notificaciones y WhatsApp opcional
  - Muestra historial de pagos y notificaciones

## Datos y persistencia

- Los datos de usuario se almacenan localmente en `localStorage`
- Los pagos y recordatorios pueden mantenerse en memoria o simularse con datos de ejemplo
- Este proyecto usa datos de ejemplo para demostrar el flujo de la aplicación sin backend

## Componentes principales

- `AppSidebar` - Navegación lateral
- `AppHeader` - Barra superior con controles de usuario y temas
- `AppContent` - Contenido principal con renderizado de rutas
- `AppFooter` - Pie de página del dashboard
- `DefaultLayout` - Composición del layout principal

## Build y despliegue

- `npm run build` genera el bundle de producción
- `npm run serve` sirve la versión de producción localmente
- `HashRouter` permite desplegar en hosts estáticos sin configuración adicional de servidor

## Tareas de mantenimiento

- Mantener actualizadas las dependencias de CoreUI y React
- Verificar que `src/auth.js` siga siendo seguro para producción si se reemplaza con auth real
- Evaluar si `src/routes.js` requiere nuevas rutas con roles adicionales
