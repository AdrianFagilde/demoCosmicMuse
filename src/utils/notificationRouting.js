// Destino de una notificacion al pulsarse.
//
// La mayoria no navegan: las manuales de /send-notifications son broadcasts
// sin entidad y las anteriores a la migracion 029 tienen reference_type a
// NULL. Esas siguen siendo validas, solo que al pulsarlas no navegan.
//
// Se mantiene el type check para que un reference_type desconocido (una
// migracion futura que anada 'course' o 'lesson') caiga en "no navegar" en
// lugar de construir una ruta que no existe.
export const getNotificationTarget = (notification) => {
  if (notification?.reference_type === 'task' && notification?.reference_id) {
    return `/tasks/${notification.reference_id}`
  }
  return null
}

export const isNavigableNotification = (notification) =>
  getNotificationTarget(notification) !== null
