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
        console.log('[SW] Registered:', registration.scope)

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              if (confirm('Hay una nueva versión disponible. ¿Recargar para actualizar?')) {
                window.location.reload()
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
