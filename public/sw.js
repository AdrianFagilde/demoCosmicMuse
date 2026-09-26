// Service Worker for Cosmic Muse Academy PWA
// Offline shell + push notifications.
//
// Alcance deliberadamente estrecho: solo se cachea lo que sirve el propio
// origen (el shell de la SPA y sus assets con hash). El tráfico a
// *.supabase.co NO se intercepta: la APIkey viaja en cabecera, no en la URL,
// asi que cachear esas respuestas por URL devolvería los datos de un
// usuario a otro en un dispositivo compartido cuando la red fallara.

const BUILD_VERSION = 'dev'
const CACHE_NAME = `cosmic-muse-${BUILD_VERSION}`
const STATIC_CACHE = `cosmic-muse-static-${BUILD_VERSION}`

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
  '/site.webmanifest',
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)))
  // No se llama a skipWaiting() aqui a proposito: el index.jsx espera a que
  // el usuario acepte la actualizacion y avisa por postMessage. Saltarse la
  // espera en el install desperdicia el bundle descargado.
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          // Cualquier cache con otra version se borra, de modo que un
          // despliegue nuevo invalida el shell anterior. Sin esto la version
          // congelada en v1 servia chunks huerfanos tras un rollback.
          cacheNames.filter((name) => name !== STATIC_CACHE).map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Solo GET
  if (request.method !== 'GET') {
    return
  }

  if (!url.protocol.startsWith('http')) {
    return
  }

  // CRITICO: fuera del propio origen (Supabase REST/Storage/Realtime) no se
  // cachea nada. Sin esta guarda, networkFirstStrategy guardaba cada
  // respuesta autenticada indexada solo por URL.
  if (url.origin !== self.location.origin) {
    return
  }

  // Navegacion: red primero, con el shell como respaldo offline
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html')))
    return
  }

  // Assets con hash de contenido: cache primero
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request))
    return
  }

  // Cualquier otra peticion del mismo origen va directa a la red, sin cache.
  // El backend es Supabase; no hay assets dinamicos propios que cachear.
})

// Cache first strategy - solo para assets con hash (inmutables)
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    throw error
  }
}

function isStaticAsset(pathname) {
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/static/') ||
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/i)
  )
}

// Push notification handling
self.addEventListener('push', (event) => {
  if (!event.data) return

  // El payload puede llegar vacio o no ser JSON; un throw aqui dentro
  // aborta la entrega de la notificacion.
  let data
  try {
    data = event.data.json()
  } catch (err) {
    data = { title: 'Cosmic Muse Academy', body: event.data.text() }
  }

  const options = {
    body: data.body,
    icon: '/android-chrome-192x192.png',
    badge: '/android-chrome-192x192.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'dismiss', title: 'Descartar' },
    ],
    requireInteraction: true,
  }

  event.waitUntil(self.registration.showNotification(data.title || 'Notificación', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss' || event.action !== 'open') {
    return
  }

  // Respeta el destino del push: antes siempre abria el dashboard.
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target)
      }
    }),
  )
})

// Message handling from main thread.
// Acepta el formato objeto { type } que usa index.jsx y el string plano por
// retrocompatibilidad con cualquier llamada anterior.
self.addEventListener('message', (event) => {
  const type = event.data && event.data.type ? event.data.type : event.data

  if (type === 'skipWaiting') {
    self.skipWaiting()
  }
  if (type === 'getVersion') {
    event.ports[0]?.postMessage({ version: CACHE_NAME })
  }
  if (type === 'clearCache') {
    // Borra solo las versiones anteriores: borrar tambien la precache activa
    // dejaba el SW vivo pero sin shell offline hasta el siguiente install.
    caches
      .keys()
      .then((names) =>
        names.filter((name) => name !== STATIC_CACHE).forEach((name) => caches.delete(name)),
      )
  }
})
