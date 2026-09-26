import React, { useEffect, useRef, useState } from 'react'
import { CModal, CModalBody, CButton } from '@coreui/react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { MusicNote, TrebleClef, StaffDivider } from './MusicDecor'
import { playWelcomeMusic, resumeWelcomeMusic, stopWelcomeMusic } from '../utils/welcomeMusic'

const WELCOME_KEY_PREFIX = 'cosmic_muse_welcome_pending'

const welcomeStorageKey = (email) => `${WELCOME_KEY_PREFIX}_${email}`

const WelcomeModal = () => {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    const email = profile?.email || user?.email
    if (!email) return
    const pending = sessionStorage.getItem(welcomeStorageKey(email))
    if (!pending || started.current) return
    started.current = true
    sessionStorage.removeItem(welcomeStorageKey(email))
    setVisible(true)
    playWelcomeMusic()
  }, [profile, user])

  useEffect(() => {
    if (!visible) return
    const onPointer = () => {
      resumeWelcomeMusic()
    }
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [visible])

  const handleClose = () => {
    setVisible(false)
    stopWelcomeMusic()
  }

  const firstName = profile?.full_name?.split(' ')[0] || ''

  return (
    <CModal visible={visible} onClose={handleClose} alignment="center" size="lg">
      <CModalBody className="text-center py-5 px-4 position-relative overflow-hidden rounded-3">
        <TrebleClef size={130} color="var(--cui-primary)" className="music-modal-clef" />
        <MusicNote size={40} color="var(--cui-primary)" className="mb-3" />
        <h3 className="mb-2">Bienvenido a Cosmic Muse</h3>
        <StaffDivider
          caption={firstName ? `una nota a la vez, ${firstName}` : 'una nota a la vez'}
          className="w-75 mx-auto mb-4"
        />
        <p className="text-medium-emphasis mb-4">
          Tu cuenta está lista. Explorá tu ruta musical, practicá y mantené tu racha.
        </p>
        <CButton color="primary" size="lg" onClick={() => {
          navigate('/dashboard')
          setVisible(false)
        }}>
          ¡A empezar!
        </CButton>
      </CModalBody>
    </CModal>
  )
}

export default WelcomeModal
