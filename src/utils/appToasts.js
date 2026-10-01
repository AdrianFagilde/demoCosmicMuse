// Canal para toasts in-app de usar y tirar (los que no nacen de la tabla
// notifications: confirmaciones de una acción guardada, avisos puntuales...).
//
// NotificationToasts.jsx los renderiza junto a los de la base de datos; así
// hay un solo sistema de toasts y cualquier módulo puede mostrar uno sin
// acoplarse al estado interno del componente.

const EVENT_NAME = 'cosmo:app-toast'

/**
 * Muestra un toast in-app.
 *
 * Opciones:
 * - title, body: contenido.
 * - placement: esquina del CToaster ('top-end' por defecto; también
 *   'top-start', 'top-center', 'bottom-end', 'bottom-start', 'bottom-center').
 * - delay: ms hasta ocultarse solo (7000 por defecto).
 * - persistent: true para que no se oculte nunca (hasta cerrarlo a mano).
 * - actions: [{ label, variant?, onClick? }] botones al pie del toast.
 *   Tras ejecutar la acción el toast se cierra solo.
 */
export const showAppToast = ({
  title,
  body = '',
  placement = 'top-end',
  delay = 7000,
  persistent = false,
  actions = [],
}) => {
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, {
      detail: { title, body, placement, delay, persistent, actions },
    }),
  )
}

/** Suscripción para NotificationToasts. Devuelve función de limpieza. */
export const onAppToast = (handler) => {
  const listener = (event) => handler(event.detail)
  window.addEventListener(EVENT_NAME, listener)
  return () => window.removeEventListener(EVENT_NAME, listener)
}
