import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilSpeedometer, cilCheck, cilFire } from '@coreui/icons'
import ProgressRing from './ProgressRing'

const DAILY_GOAL_MINUTES = 30

const DailyGoalCard = ({ practiceMinutesToday = 0, streak = 0, onStartPractice }) => {
  const progress = Math.min(100, Math.round((practiceMinutesToday / DAILY_GOAL_MINUTES) * 100))
  const remaining = Math.max(0, DAILY_GOAL_MINUTES - practiceMinutesToday)
  const isComplete = progress >= 100

  return (
    <div className="daily-goal-card dash-card mb-4" style={{ '--daily-color': '#6366f1' }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{
              width: 48,
              height: 48,
              background: 'rgba(255,255,255,0.2)',
            }}
          >
            <CIcon icon={cilSpeedometer} size="xl" color="white" />
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: '1.1rem' }}>
              Meta diaria
            </div>
            <div className="text-white-50 small">{DAILY_GOAL_MINUTES} min de práctica</div>
          </div>
        </div>
        <div className="text-end">
          <div className="fw-bold" style={{ fontSize: '1.5rem' }}>
            {isComplete ? '✓ Completada' : `${remaining} min`}
          </div>
          <div className="text-white-50 small">
            {practiceMinutesToday} / {DAILY_GOAL_MINUTES} min
          </div>
        </div>
      </div>

      <div className="d-flex align-items-center justify-content-between">
        <ProgressRing
          progress={progress}
          size={100}
          strokeWidth={8}
          color="#fff"
          backgroundColor="rgba(255,255,255,0.2)"
          showValue={true}
          valueLabel=""
          animate={true}
          className="flex-shrink-0"
        />

        <div className="d-flex flex-column gap-3 ms-4" style={{ minWidth: 140 }}>
          <button
            className={`btn ${isComplete ? 'btn-outline-light' : 'btn-light'} w-100`}
            onClick={onStartPractice}
            disabled={isComplete}
            type="button"
            style={{ padding: '10px 16px', fontWeight: 600 }}
          >
            <CIcon icon={cilFire} className="me-2" />
            {isComplete ? '¡Meta lograda!' : 'Practicar ahora'}
          </button>
          <div className="d-flex align-items-center gap-3 text-white-50 small">
            <div className="d-flex align-items-center gap-1">
              <CIcon icon={cilFire} size="sm" />
              <span className="fw-bold">{streak} días</span>
            </div>
          </div>
        </div>
      </div>

      {isComplete && (
        <div className="mt-3 p-3 rounded" style={{ background: 'rgba(255,255,255,0.15)' }}>
          <div className="d-flex align-items-center justify-content-center gap-2">
            <CIcon icon={cilCheck} size="lg" />
            <span className="fw-semibold">¡Meta completada! Gran trabajo hoy.</span>
            <CIcon icon={cilCheck} size="lg" />
          </div>
        </div>
      )}
    </div>
  )
}

export default DailyGoalCard
