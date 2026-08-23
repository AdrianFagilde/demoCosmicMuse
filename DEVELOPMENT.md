# Guía de desarrollo de Academia Cosmo Music

Esta guía está destinada a los desarrolladores que trabajan en la aplicación Academia Cosmo Music. Contiene flujos de trabajo, convenciones y los puntos clave de la implementación.

## Prerrequisitos

- Node.js 20+ (22 recomendado)
- npm 9+
- Git
- Un editor compatible con ESLint y Prettier (por ejemplo VS Code)
- Variables de entorno en `.env`: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

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
- `npm run lint` - chequea la calidad del código (ESLint + Prettier)
- `npm run format` - formatea todo el proyecto con Prettier

## Flujo de desarrollo

1. Crea una rama de feature basada en `main`
2. Instala dependencias y arranca `npm start`
3. Modifica los archivos en `src/`
4. Verifica la aplicación en el navegador
5. Ejecuta `npm run lint`
6. Realiza commit siguiendo conventional commits (`feat:`, `fix:`, `refactor:`, ...)

## Estructura de la app

- `src/App.jsx` - raíz de la aplicación y router principal
- `src/layout/DefaultLayout.jsx` - layout para rutas autenticadas
- `src/components/AppContent.jsx` - renderiza rutas, aplica roles por ruta y remonta vistas al cambiar parámetros
- `src/navigation.jsx` - configuración del menú lateral según rol
- `src/routes.js` - definición de rutas y roles permitidos
- `src/context/AuthContext.jsx` - sesión y perfil de Supabase (fuente única del rol)
- `src/hooks/useSupabase*.js` - acceso a datos por dominio; exponen `{ data, loading, error }`
- `src/utils/` - utilidades compartidas (`students.js`, `format.js`, `notifications.js`)
- `src/views/` - vistas de páginas
- `supabase/migrations/` - esquema y políticas RLS (aplicar en orden)
- `supabase/functions/create-student/` - Edge Function para crear estudiantes como admin

## Añadir una nueva página

1. Crea el componente en `src/views/<feature>/<Feature>.jsx`
2. Agrega la ruta en `src/routes.js`
3. Si debe aparecer en el menú, añade un elemento en `src/navigation.jsx`
4. Si la ruta es restringida, agrega `roles: ['admin']` o el arreglo de roles necesarios
5. Prueba el acceso con el usuario correspondiente

## Convenciones de código

- Usa componentes funcionales y Hooks
- Importa componentes de CoreUI desde `@coreui/react`
- El acceso a Supabase vive en los hooks `useSupabase*`; las vistas no hacen queries salvo casos puntuales
- Los hooks exponen su estado de error; los formularios deben mostrarlo y no resetearse si falló el guardado
- Reutiliza `utils/format.js`, `utils/students.js` y `components/RestrictedAccess.jsx` en lugar de duplicar lógica
- Respeta el estilo del proyecto (Prettier + ESLint): sin punto y coma, comillas simples, indentación de 2 espacios

## Enrutamiento y autorización

- La autorización real vive en RLS (PostgreSQL); la UI solo oculta u ofrece opciones
- `src/App.jsx` protege todas las rutas internas con `RequireAuth`
- `src/components/AppContent.jsx` aplica la validación por rol de cada ruta usando `profile.role`
- `src/navigation.jsx` muestra u oculta enlaces según el rol del perfil

## Autenticación

- Supabase Auth es la fuente de verdad: sesión restaurada con `getCurrentSession` y escuchada vía `onAuthStateChange`
- El perfil se carga desde la tabla `profiles`; el rol nunca se escribe ni se lee del JWT
- Crear estudiantes requiere la Edge Function `create-student` (verificar secretos antes de desplegar)

## Estilos

- El proyecto usa Sass en `src/scss/style.scss`
- Usa clases de utilidad de Bootstrap y CoreUI para espaciado, tipografía y layout

## Debugging y troubleshooting

- Si la app no arranca, revisa la consola del navegador y el terminal de Vite
- Si una ruta falla, confirma su definición en `src/routes.js`
- Para errores de permisos, revisa las políticas RLS en `supabase/migrations/` y el `profile.role` cargado en AuthContext

## Despliegue

- Genera el build con:

```bash
npm run build
```

- Deploy en **Vercel**; define `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en el dashboard del proyecto

## Buenas prácticas

- Mantén separada la lógica de componentes y presentación
- Usa hooks personalizados para lógica reutilizable
- Toda nueva tabla debe incluir sus políticas RLS desde el inicio
- Mantén la documentación actualizada en `README.md`, `ARCHITECTURE.md` y `DEVELOPMENT.md`
