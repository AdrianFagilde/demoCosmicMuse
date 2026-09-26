import React, { useEffect, useState } from 'react'
import { CButton, CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
import { cilCloudDownload, cilMobile, cilX } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

const PWAInstallPrompt = () => {
  const [showPrompt, setShowPrompt] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isInWebAppiOS = window.navigator.standalone === true
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsInstalled(isStandalone || isInWebAppiOS)

    // Detect iOS
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream)

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      if (!isInstalled) {
        setShowPrompt(true)
      }
    }

    // Listen for appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setShowPrompt(false)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    // Check for iOS standalone
    if (isInWebAppiOS) {
      setIsInstalled(true)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [isInstalled])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === 'accepted') {
      if (import.meta.env.DEV) console.log('[PWA] User accepted install')
    } else {
      if (import.meta.env.DEV) console.log('[PWA] User dismissed install')
    }

    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    // Don't show again for a while
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  // Don't show if already installed or dismissed recently
  const dismissedTime = localStorage.getItem('pwa-install-dismissed')
  const shouldShow =
    !isInstalled &&
    deferredPrompt &&
    (!dismissedTime || now - parseInt(dismissedTime) > 7 * 24 * 60 * 60 * 1000)

  if (!shouldShow || isInstalled) {
    return null
  }

  // iOS-specific instructions
  if (isIOS) {
    return (
      <CModal visible={showPrompt} onClose={handleDismiss} centered>
        <CModalHeader closeButton>
          <CModalTitle className="d-flex align-items-center gap-2">
            <CIcon icon={cilMobile} className="text-primary" />
            Instalar Cosmic Muse
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="text-center py-3">
            <CIcon icon={cilCloudDownload} size="xl" className="text-primary mb-3" />
            <h5>Instalar en iOS</h5>
            <p className="text-medium-emphasis small mb-4">
              Para instalar la app en tu iPhone o iPad:
            </p>
            <div className="text-start small">
              <ol className="mb-0">
                <li className="mb-2">
                  Toca el botón <strong>Compartir</strong>{' '}
                  <CIcon icon={cilCloudDownload} size="sm" className="ms-1" /> en la barra de
                  navegación
                </li>
                <li className="mb-2">
                  Desplázate hacia abajo y selecciona <strong>"Añadir a pantalla de inicio"</strong>
                </li>
                <li className="mb-2">
                  Toca <strong>"Añadir"</strong> en la esquina superior derecha
                </li>
              </ol>
            </div>
          </div>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={handleDismiss}>
            <CIcon icon={cilX} className="me-1" />
            Entendido
          </CButton>
        </CModalFooter>
      </CModal>
    )
  }

  // Android/Desktop prompt
  return (
    <CModal visible={showPrompt} onClose={handleDismiss} centered>
      <CModalHeader closeButton>
        <CModalTitle className="d-flex align-items-center gap-2">
          <CIcon icon={cilCloudDownload} className="text-primary" />
          Instalar Cosmic Muse
        </CModalTitle>
      </CModalHeader>
      <CModalBody className="text-center py-3">
        <CIcon icon={cilCloudDownload} size="xl" className="text-primary mb-3" />
        <h5>¿Quieres instalar la app?</h5>
        <p className="text-medium-emphasis small mb-4">
          Accede más rápido, funciona offline y recibe notificaciones push.
        </p>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={handleDismiss}>
          <CIcon icon={cilX} className="me-1" />
          Ahora no
        </CButton>
        <CButton color="primary" onClick={handleInstall}>
          <CIcon icon={cilCloudDownload} className="me-1" />
          Instalar
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default PWAInstallPrompt
