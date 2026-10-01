// Puente entre el registro del service worker (index.jsx, código plano) y
// el prompt de actualización renderizado en React (AppUpdatePrompt.jsx).
//
// El SW se registra fuera del árbol de React porque tiene que arrancar lo
// antes posible, pero el aviso "hay una versión nueva" antes se resolvía con
// un confirm() nativo del navegador. Con este evento, index.jsx solo anuncia
// que hay actualización y AppUpdatePrompt muestra el ConfirmModal in-app.

const EVENT_NAME = 'cosmo:app-update-available'

// El aviso se dispara dentro del evento load de la ventana, que puede llegar
// antes de que React monte AppUpdatePrompt. Sin este pendiente el aviso se
// perdería y el usuario no vería el modal hasta el siguiente arranque.
let pendingOnConfirm = null

/**
 * Llamado desde index.jsx cuando el SW nuevo está instalado y esperando.
 * `onConfirm` recarga la app tomando el control del worker nuevo.
 */
export const announceAppUpdate = (onConfirm) => {
  pendingOnConfirm = onConfirm
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { onConfirm } }))
}

/** Suscripción para el componente React. Devuelve función de limpieza. */
export const onAppUpdateAvailable = (handler) => {
  const listener = (event) => handler(event.detail.onConfirm)
  window.addEventListener(EVENT_NAME, listener)
  // Entrega al vuelo el aviso que precediera al montaje del componente.
  if (pendingOnConfirm) {
    handler(pendingOnConfirm)
  }
  return () => window.removeEventListener(EVENT_NAME, listener)
}

/** Limpia el pendiente una vez el usuario responde (acepte o posponga). */
export const clearPendingAppUpdate = () => {
  pendingOnConfirm = null
}
