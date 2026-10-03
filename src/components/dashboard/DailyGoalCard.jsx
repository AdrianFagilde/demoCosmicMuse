import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilSpeedometer, cilCheck, cilFire } from '@coreui/icons'
import ProgressRing from './ProgressRing'
import { MusicNote } from '../MusicDecor'

const DailyGoalCard = ({
  practiceMinutesToday = 0,
  streak = 0,
  goalMinutes = 30,
  onStartPractice,
}) => {
  const goal = goalMinutes || 30
  const progress = Math.min(100, Math.round((practiceMinutesToday / goal) * 100))
  const remaining = Math.max(0, goal - practiceMinutesToday)
  const isComplete = progress >= 100

  return (
    <div className="daily-goal-card app-card">
      <MusicNote className="daily-goal-note" size={34} color="#fff" />
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-3">
          <div className="daily-goal-icon d-flex align-items-center justify-content-center rounded-circle">
            <CIcon icon={cilSpeedometer} size="lg" color="white" aria-hidden="true" />
          </div>
          <div>
            <div className="daily-goal-title fw-bold">Meta diaria</div>
            <div className="text-body-secondary small">{goal} min de práctica</div>
          </div>
        </div>
        <div className="text-end">
          <div className="daily-goal-remaining fw-bold">
            {isComplete ? '✓ Completada' : `${remaining} min`}
          </div>
          <div className="text-body-secondary small">
            {practiceMinutesToday} / {goal} min
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
          label="Progreso del objetivo diario"
          animate={true}
          className="flex-shrink-0"
        />

        <div className="daily-goal-actions d-flex flex-column gap-3 ms-3">
          <button
            className={`daily-goal-btn btn ${isComplete ? 'btn-outline-light' : 'btn-light'} w-100`}
            onClick={onStartPractice}
            disabled={isComplete}
            type="button"
          >
            <CIcon icon={cilFire} className="me-2" aria-hidden="true" />
            {isComplete ? '¡Meta lograda!' : 'Practicar ahora'}
          </button>
          <div className="d-flex align-items-center gap-3 text-body-secondary small">
            <div className="d-flex align-items-center gap-1">
              <CIcon icon={cilFire} size="sm" aria-hidden="true" />
              <span className="fw-bold">{streak} días</span>
            </div>
          </div>
        </div>
      </div>

      {isComplete && (
        <div className="daily-goal-complete mt-3 p-3 rounded">
          <div className="d-flex align-items-center justify-content-center gap-2">
            <CIcon icon={cilCheck} size="lg" aria-hidden="true" />
            <span className="fw-semibold">¡Meta completada! Gran trabajo hoy.</span>
            <CIcon icon={cilCheck} size="lg" aria-hidden="true" />
          </div>
        </div>
      )}
    </div>
  )
}

export default DailyGoalCard
