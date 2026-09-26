import React, { createContext, useContext } from 'react'
import { useAuth } from './AuthContext'
import useSupabaseUserNotifications from '../hooks/useSupabaseUserNotifications'

const NotificationContext = createContext(null)

/**
 * Fuente única de las notificaciones del usuario.
 *
 * Antes, NotificationBell, NotificationToasts y la vista Notifications
 * montaban cada una su propia instancia de useSupabaseUserNotifications:
 * tres SELECT de 50 filas y tres canales Realtime por usuario y pagina, y
 * marcar una como leida en la campana no actualizaba el contador de los
 * toasts hasta que cada uno refrescara por su cuenta.
 *
 * Montado una vez en DefaultLayout, que envuelve a los tres consumidores.
 */
export const NotificationProvider = ({ children }) => {
  const { user } = useAuth()
  const value = useSupabaseUserNotifications(user?.id)

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}
