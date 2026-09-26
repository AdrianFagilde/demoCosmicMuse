import React from 'react'
import { createRoot } from 'react-dom/client'

import '@fontsource-variable/lexend/wght.css'

import { AppProvider } from './context/AppContext'

import App from './App'
import PWAInstallPrompt from './components/PWAInstallPrompt'

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        if (import.meta.env.DEV) {
          console.log('[SW] Registered:', registration.scope)
        }

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available.
              // No se recarga aquí: el bundle nuevo ya está en la caché pero la
              // página sigue servida por el worker antiguo, así que el
              // window.location.reload() descartaba la descarga. Se le pide
              // primero al worker que se retire y se recarga al recibir el
              // control, que es cuando el shell nuevo ya está activo.
              const activate = () => {
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  window.location.reload()
                })
                newWorker.postMessage({ type: 'skipWaiting' })
              }

              if (confirm('Hay una nueva versión disponible. ¿Recargar para actualizar?')) {
                activate()
              }
            }
          })
        })
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
    </>
  </AppProvider>,
)
