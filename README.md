# Academia Cosmo Music

Plantilla de administración y gestión para la academia musical de Cosmo Music.
Este proyecto es una aplicación React + Vite que utiliza componentes CoreUI para ofrecer una experiencia de administración sencilla, con roles de administrador y estudiante, gestión de estudiantes, tareas, pagos y recordatorios.

## Características principales

- React 19 con Vite para desarrollo rápido y compilación optimizada
- UI basada en CoreUI React y Bootstrap 5
- Rutas protegidas y navegación basada en roles (admin / student)
- Página de `Pagos` exclusiva para administradores
- Registro de pagos, recordatorios y historial de notificaciones
- Perfiles de estudiantes y tareas académicas
- Almacenamiento de sesión en `localStorage` para usuarios de demostración

## Quick Start

```bash
npm install
npm start
```

Abre `http://localhost:3000` en tu navegador.

## Scripts disponibles

| Comando | Descripción |
| --- | --- |
| `npm start` | Inicia el servidor de desarrollo en modo HMR |
| `npm run build` | Genera el bundle de producción con Vite |
| `npm run serve` | Sirve el build de producción localmente |
| `npm run lint` | Ejecuta ESLint sobre el código |

## Estructura del proyecto

```
src/
├── assets/          # Imágenes y logos
├── components/      # Componentes reutilizables de UI
├── data/            # Datos locales simulados para la demo
├── layout/          # Layout de la aplicación
├── scss/            # Estilos globales y temas
├── views/           # Vistas por ruta
├── App.jsx          # Componente raíz con router
├── auth.js          # Autenticación local con users de prueba
├── routes.js        # Definición de rutas protegidas
├── _nav.jsx         # Menú lateral configurado por roles
└── store.js         # Estado global Redux básico
```

## Autenticación y roles

La autenticación es local y está definida en `src/auth.js`.
Se almacenan usuarios de ejemplo en `localStorage`:

- `admin` / `admin123` → rol `admin`
- `maria` / `student123` → rol `student`
- `javier` / `student123` → rol `student`

El rol determina qué elementos aparecen en la navegación y si el usuario puede acceder a `/payments`.

## Rutas principales

- `/dashboard` - Panel principal
- `/students` - Listado de estudiantes (admin)
- `/students/:id` - Perfil del estudiante
- `/tasks` - Tareas
- `/payments` - Pagos y recordatorios (admin)
- `/my-profile` - Perfil personal

## Documentación adicional

- `ARCHITECTURE.md` - Arquitectura del proyecto y stack técnico
- `DEVELOPMENT.md` - Guía de desarrollo y mejores prácticas

## Dependencias clave

- React 19
- CoreUI React
- React Router DOM 7
- Redux 5
- Vite

## Notas de despliegue

El proyecto usa `HashRouter`, por lo que puede desplegarse en hosts estáticos sin configuración de servidor adicional.

```bash
npm run build
npm run serve
```

### Deploy en GitHub Pages

Esta aplicación está configurada para desplegarse con `gh-pages`.

```bash
npm run deploy
```

El comando ejecuta `npm run build` y publica el contenido de `build/` en la rama `gh-pages`.

> Si aún no tienes el repositorio configurado en GitHub, asegúrate de que el remoto apunte a tu repositorio personal antes de ejecutar el deploy.
