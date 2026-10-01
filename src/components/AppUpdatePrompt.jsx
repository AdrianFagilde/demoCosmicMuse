import React, { useCallback, useEffect, useRef, useState } from 'react'
import ConfirmModal from './ConfirmModal'
import { clearPendingAppUpdate, onAppUpdateAvailable } from '../utils/swUpdatePrompt'

/**
 * Aviso in-app de "hay una versión nueva del SW instalada".
 *
 * Sustituye al confirm() nativo que usaba index.jsx: cuando el service
 * worker nuevo queda instalado y esperando, index.jsx llama a
 * announceAppUpdate() y este componente decide cómo presentarlo.
 *
 * Si el usuario pospone ("Más tarde") se re-anuncia en el siguiente arranque
 * hasta que se agote la ventana de gracia de UPDATE_GRACE_MS (ver index.jsx),
 * momento en el que la recarga se aplica sin preguntar.
 */
const AppUpdatePrompt = () => {
  const [visible, setVisible] = useState(false)
  const confirmRef = useRef(null)

  useEffect(
    () =>
      onAppUpdateAvailable((onConfirm) => {
        confirmRef.current = onConfirm
        setVisible(true)
      }),
    [],
  )

  const handleConfirm = useCallback(() => {
    setVisible(false)
    clearPendingAppUpdate()
    // Tras aceptar, index.jsx recarga la página: el estado visible ya no se
    // volverá a pintar, así que da igual no resetear confirmRef.
    confirmRef.current?.()
  }, [])

  const handleClose = useCallback(() => {
    setVisible(false)
    confirmRef.current = null
    clearPendingAppUpdate()
  }, [])

  return (
    <ConfirmModal
      visible={visible}
      title="Nueva versión disponible"
      message="Hay una actualización de Cosmo Music lista. Recarga ahora para usarla; si esperas, se aplicará sola pasados unos días."
      confirmLabel="Recargar ahora"
      cancelLabel="Más tarde"
      variant="primary"
      onConfirm={handleConfirm}
      onClose={handleClose}
    />
  )
}

export default AppUpdatePrompt
