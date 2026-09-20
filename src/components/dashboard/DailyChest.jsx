import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilGift, cilStar, cilBan, cilCheck } from '@coreui/icons'
import ProgressRing from './ProgressRing'

const DailyChest = ({
  practicesThisWeek = 0,
  practicesForChest = 5,
  onClaimChest,
  chestClaimed = false,
}) => {
  const progress = Math.min(100, Math.round((practicesThisWeek / practicesForChest) * 100))
  const remaining = Math.max(0, practicesForChest - practicesThisWeek)
  const canClaim = practicesThisWeek >= practicesForChest && !chestClaimed
  const isComplete = chestClaimed || progress >= 100

  return (
    <div className="chest-widget dash-card mb-4">
      <div className="text-center mb-3">
        <div className="chest-icon">
          {chestClaimed ? (
            <span style={{ fontSize: '3.5rem' }}>🎁</span>
          ) : canClaim ? (
            <span style={{ fontSize: '3.5rem', animation: 'chest-bounce 1s ease-in-out infinite' }}>
              🎁
            </span>
          ) : (
            <span style={{ fontSize: '3.5rem' }}>🔒</span>
          )}
        </div>
        <div className="fw-bold" style={{ fontSize: '1.1rem' }}>
          {chestClaimed ? 'Cofre abierto' : canClaim ? '¡Cofre listo!' : 'Cofre semanal'}
        </div>
        <div className="text-medium-emphasis small mt-1">
          {chestClaimed
            ? 'Recompensa reclamada esta semana'
            : canClaim
              ? '¡Toca para abrir!'
              : `Practica ${remaining} día${remaining !== 1 ? 's' : ''} más`}
        </div>
      </div>

      <ProgressRing
        progress={progress}
        size={72}
        strokeWidth={6}
        color={canClaim ? '#f59e0b' : '#6366f1'}
        backgroundColor="rgba(0,0,0,0.05)"
        showValue={true}
        valueLabel={`${practicesThisWeek}/${practicesForChest} prácticas`}
        animate={true}
        className="mx-auto mb-3"
      />

      <div className="d-flex align-items-center justify-content-center gap-3">
        {canClaim && (
          <button
            className="btn btn-warning w-100 fw-semibold py-2"
            onClick={onClaimChest}
            type="button"
            style={{ fontSize: '0.9rem' }}
          >
            <CIcon icon={cilGift} className="me-2" /> Abrir cofre
          </button>
        )}
        {chestClaimed && (
          <button
            className="btn btn-outline-secondary w-100 fw-semibold py-2"
            disabled
            type="button"
          >
            <CIcon icon={cilCheck} className="me-2" /> Ya reclamado
          </button>
        )}
        {!canClaim && !chestClaimed && (
          <button className="btn btn-outline-primary w-100 fw-semibold py-2" disabled type="button">
            <CIcon icon={cilBan} className="me-2" /> Bloqueado
          </button>
        )}
      </div>

      <div className="mt-3 text-center">
        <div className="d-flex justify-content-center gap-2">
          {[1, 2, 3, 4, 5].map((day) => (
            <div
              key={day}
              className="d-flex flex-column align-items-center"
              style={{ minWidth: 32 }}
            >
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{
                  width: 28,
                  height: 28,
                  background: day <= practicesThisWeek ? '#f59e0b' : 'var(--cui-border-color)',
                  color: day <= practicesThisWeek ? 'white' : 'var(--cui-text-muted)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  border: day <= practicesThisWeek ? 'none' : '2px dashed var(--cui-border-color)',
                }}
              >
                {day}
              </div>
              <span className="text-medium-emphasis small mt-1" style={{ fontSize: '0.6rem' }}>
                Día {day}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DailyChest
