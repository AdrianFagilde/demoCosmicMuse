import React from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/lexend/wght.css'
// --font-script declara Dancing Script en style.scss pero la fuente no venia
// de ningun sitio, asi que caia a `cursive` (Comic Sans en Windows). Solo el
// subconjunto latin, que cubre los acentos del espanol, y los dos pesos que
// necesitan los selectores que la usan.
import '@fontsource/dancing-script/latin-400.css'
import '@fontsource/dancing-script/latin-700.css'

import { AppProvider } from './context/AppContext'

import App from './App'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import AppUpdatePrompt from './components/AppUpdatePrompt'
import { announceAppUpdate } from './utils/swUpdatePrompt'

// Ventana de gracia antes de tomar el control sin preguntar.
//
// El install del service worker NO llama a skipWaiting() a propósito (ver
// public/sw.js): así el bundle nuevo no se descarga de golpe mientras alguien
// está rellenando un formulario. El precio de esa decisión es que si el
// usuario descarta el aviso se queda con el bundle viejo indefinidamente, y
// como el prompt vive en el bundle nuevo, no hay ninguna otra señal de que
// debería actualizarse. Eso se vio en producción: un bundle de la época de
// webpack sirviendo chunks que ya no existían, y reabriendo los cuestionarios
// fallando con el mismo error.
//
// Descartar el aviso es una decisión legítima del usuario. Qedar atrapado en
// un bundle viejo para siempre, no. Siete días da margen de sobra para cerrar
// una sesión larga y aun así el bundle viejo no sobrevive a una semana.
const UPDATE_GRACE_MS = 7 * 24 * 60 * 60 * 1000
const UPDATE_PENDING_KEY = 'cosmo:update-pending-since'

// La marca de tiempo va en localStorage y no dentro del service worker a
// propósito: un worker en estado "waiting" puede ser terminado por el
// navegador en cualquier momento y no volver a despertarse por sí solo, así
// que un setTimeout en el worker no es fiable. La página, en cambio, está
// viva en cada navegación, que es el único sitio donde el plazo se puede
// volver a evaluar.
const readPendingSince = () => {
  try {
    const value = Number(localStorage.getItem(UPDATE_PENDING_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    // Sin localStorage (modo restrictivo) no hay plazo que medir: se limita a
    // preguntar, que es el comportamiento anterior.
    return null
  }
}

const writePendingSince = (value) => {
  try {
    localStorage.setItem(UPDATE_PENDING_KEY, String(value))
  } catch {
    // Idem: si no se puede guardar, el flujo sigue con lo que haya en memoria.
  }
}

const clearPendingSince = () => {
  try {
    localStorage.removeItem(UPDATE_PENDING_KEY)
  } catch {
    // Nada que limpiar.
  }
}

if ('serviceWorker' in navigator) {
  // No se recarga aquí: el bundle nuevo ya está en la caché pero la página
  // sigue servida por el worker antiguo, así que el window.location.reload()
  // descartaba la descarga. Se le pide primero al worker que se retire y se
  // recarga al recibir el control, que es cuando el shell nuevo ya está
  // activo.
  const takeOver = (newWorker) => {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload()
    })
    newWorker.postMessage({ type: 'skipWaiting' })
  }

  const handleInstalledWorker = (newWorker) => {
    // Sin controller no hay bundle anterior al que quedarse atrás: es la
    // primera instalación de esta sesión y no hay nada que actualizar.
    if (!navigator.serviceWorker.controller) return

    const now = Date.now()
    const pendingSince = readPendingSince() ?? now
    writePendingSince(pendingSince)

    // Plazo agotado: se toma el control sin preguntar.
    if (now - pendingSince >= UPDATE_GRACE_MS) {
      takeOver(newWorker)
      return
    }

    // Antes era un confirm() nativo del navegador; ahora AppUpdatePrompt
    // (ConfirmModal de CoreUI) decide al vuelo, y posponer no bloquea la
    // pagina. Si pasan UPDATE_GRACE_MS sin responder, la recarga se aplica
    // sola en el siguiente arranque (rama de arriba).
    announceAppUpdate(() => takeOver(newWorker))
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        if (import.meta.env.DEV) {
          console.log('[SW] Registered:', registration.scope)
        }

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              handleInstalledWorker(newWorker)
            }
          })
        })

        // Un worker puede llevar tiempo esperando de una visita anterior, en la
        // que el usuario aún no había visto ningún aviso porque no hubo
        // updatefound en esta carga. Sin esto el plazo no se volvería a
        // evaluar hasta la siguiente visita, que es justo lo que hay que
        // evitar.
        if (registration.waiting) {
          handleInstalledWorker(registration.waiting)
        } else {
          // Nada pendiente: la marca se limpia para que el próximo aviso
          // empiece a contar desde cero.
          clearPendingSince()
        }
      },
      (error) => {
        console.error('[SW] Registration failed:', error)
      },
    )
  })
}

createRoot(document.getElementById('root')).render(
  <AppProvider>
    <>
      <App />
      <PWAInstallPrompt />
      <AppUpdatePrompt />
    </>
  </AppProvider>,
)
