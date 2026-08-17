# Guía de desarrollo de Academia Cosmo Music

Esta guía está destinada a los desarrolladores que trabajan en la aplicación Academia Cosmo Music. Contiene flujos de trabajo, convenciones y los puntos clave de la implementación.

## Prerrequisitos

- Node.js 16+ (18+ recomendado)
- npm 7+ o yarn
- Git
- Un editor compatible con ESLint y Prettier (por ejemplo VS Code)

## Iniciar el proyecto

```bash
npm install
npm start
```

Abre `http://localhost:3000`.

## Scripts útiles

- `npm start` - servidor de desarrollo
- `npm run build` - build de producción
- `npm run serve` - vista previa del build
- `npm run lint` - chequea la calidad del código

## Flujo de desarrollo

1. Crea una rama de feature basada en `main`
2. Instala dependencias y arranca `npm start`
3. Modifica los archivos en `src/`
4. Verifica la aplicación en el navegador
5. Ejecuta `npm run lint`
6. Realiza commit con un mensaje claro y descriptivo

## Estructura de la app

- `src/App.jsx` - raíz de la aplicación y router principal
- `src/layout/DefaultLayout.jsx` - layout para rutas autenticadas
- `src/components/AppContent.jsx` - renderiza rutas y maneja autorización
- `src/_nav.jsx` - configuración del menú de navegación
- `src/routes.js` - definición de rutas y roles
- `src/auth.js` - autenticación local y sesión de usuario
- `src/views/` - vistas de páginas
- `src/data/` - datos ficticios y ejemplos usados en la UI

## Añadir una nueva página

1. Crea el componente en `src/views/<feature>/<Feature>.jsx`
2. Agrega la ruta en `src/routes.js`
3. Si debe aparecer en el menú, añade un elemento en `src/_nav.jsx`
4. Si la ruta es restringida, agrega `roles: ['admin']` o el arreglo de roles necesarios
5. Prueba el acceso con el usuario correspondiente

## Convenciones de código

- Usa componentes funcionales y Hooks
- Importa componentes de CoreUI desde `@coreui/react`
- Mantén JSX legible y evita lógicas complejas en el render
- Usa `PropTypes` cuando sea necesario para documentar props
- Respeta el estilo del proyecto (Prettier + ESLint)

## Enrutamiento y autorización

- `src/App.jsx` protege todas las rutas internas con `RequireAuth`
- `src/components/AppContent.jsx` aplica la validación por rol para cada ruta
- `src/_nav.jsx` muestra u oculta enlaces según `currentUser?.role`

## Autenticación de ejemplo

La autenticación es simulada y se basa en usuarios de prueba definidos en `src/auth.js`.
Sustituye este módulo por tu propia solución de backend cuando pases a producción.

## Estilos

- El proyecto usa Sass en `src/scss/style.scss`
- `src/scss/examples.scss` contiene estilos para ejemplos y documentación interna
- Usa clases de utilidad de Bootstrap y CoreUI para espaciado, tipografía y layout

## Debugging y troubleshooting

- Si la app no arranca, revisa la consola del navegador y el terminal de Vite
- Si una ruta falla, confirma su definición en `src/routes.js`
- Para errores de permisos, revisa `route.roles` en `AppContent.jsx` y `currentUser.role` en `_nav.jsx`

## Despliegue

- Genera el build con:

```bash
npm run build
```

- Sirve la versión optimizada con:

```bash
npm run serve
```

## Buenas prácticas

- Mantén separada la lógica de componentes y presentación
- Usa hooks personalizados para lógica reutilizable
- Mantén la documentación actualizada en `README.md`, `ARCHITECTURE.md` y `DEVELOPMENT.md`
