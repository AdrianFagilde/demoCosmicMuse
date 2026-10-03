import React, { useEffect, useState } from 'react'
import CIcon from '@coreui/icons-react'
import { cilMediaStop, cilMusicNote } from '@coreui/icons'

const formatClock = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * Barra flotante con el cronometro de la practica en curso. Solo se monta
 * cuando hay una sesion abierta (sin ended_at). "Finalizar" cierra la sesion
 * (ended_at = ahora), momento en el que la BD calcula duration_minutes, da XP
 * y avanza la racha.
 */
const PracticeTimer = ({ session, label, onFinish, finishing = false }) => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  if (!session?.started_at) return null

  const startedAt = new Date(session.started_at).getTime()
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000))

  return (
    <div className="practice-timer" role="status" aria-live="polite">
      <span className="practice-timer__icon">
        <CIcon icon={cilMusicNote} aria-hidden="true" />
      </span>
      <div className="practice-timer__text">
        <span className="practice-timer__label">Practicando{label ? `: ${label}` : ''}</span>
        <span className="practice-timer__hint small">La sesión se guarda al finalizar</span>
      </div>
      <span
        className="practice-timer__clock"
        aria-label={`Tiempo transcurrido ${elapsed} segundos`}
      >
        {formatClock(elapsed)}
      </span>
      <button
        type="button"
        className="btn btn-light btn-sm practice-timer__stop"
        onClick={() => onFinish(session)}
        disabled={finishing}
      >
        <CIcon icon={cilMediaStop} className="me-1" aria-hidden="true" />
        {finishing ? 'Guardando…' : 'Finalizar'}
      </button>
    </div>
  )
}

export default PracticeTimer
