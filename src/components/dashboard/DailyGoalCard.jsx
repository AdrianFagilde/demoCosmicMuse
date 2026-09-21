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
    <div className="daily-goal-card dash-card" style={{ '--daily-color': '#6366f1' }}>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-3">
          <div
            className="d-flex align-items-center justify-content-center rounded-circle"
            style={{
              width: 40,
              height: 40,
              background: 'rgba(255,255,255,0.2)',
            }}
          >
            <CIcon icon={cilSpeedometer} size="lg" color="white" />
          </div>
          <div>
            <div className="fw-bold" style={{ fontSize: '1rem' }}>
              Meta diaria
            </div>
            <div className="text-white-50 small">{DAILY_GOAL_MINUTES} min de práctica</div>
          </div>
        </div>
        <div className="text-end">
          <div className="fw-bold" style={{ fontSize: '1.15rem' }}>
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
          size={76}
          strokeWidth={6}
          color="#fff"
          backgroundColor="rgba(255,255,255,0.2)"
          showValue={true}
          valueLabel=""
          animate={true}
          className="flex-shrink-0"
        />

        <div className="d-flex flex-column gap-3 ms-3" style={{ minWidth: 120 }}>
          <button
            className={`btn ${isComplete ? 'btn-outline-light' : 'btn-light'} w-100`}
            onClick={onStartPractice}
            disabled={isComplete}
            type="button"
            style={{ padding: '8px 12px', fontWeight: 600 }}
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
