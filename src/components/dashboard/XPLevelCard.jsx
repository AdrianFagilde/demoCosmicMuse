import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilGraph } from '@coreui/icons'
import { getLevelProgress } from '../../utils/gamification'

const Stat = ({ value, label }) => (
  <div className="xp-card__stat">
    <span className="xp-card__stat-value">{value}</span>
    <span className="xp-card__stat-label">{label}</span>
  </div>
)

/**
 * Nivel y XP del alumno con barra al siguiente nivel. La formula de nivel es la
 * misma que aplica la base de datos (getLevelProgress replica
 * floor(sqrt(xp/100)) + 1), asi que no hace falta otra consulta.
 */
const XPLevelCard = ({
  xp = 0,
  totalPracticeMinutes = 0,
  tasksCompleted = 0,
  coursesCompleted = 0,
}) => {
  const { level, remaining, percent } = getLevelProgress(xp)

  return (
    <div className="app-card app-card-compact app-card-stat xp-card h-100 d-flex flex-column justify-content-center">
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilGraph} className="text-primary" size="lg" aria-hidden="true" />
          Nivel {level}
        </span>
        <span className="text-medium-emphasis small">{xp} XP</span>
      </div>

      <div
        className="progress mb-2 xp-card__bar"
        role="progressbar"
        aria-label="Progreso al siguiente nivel"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="progress-bar"
          style={{ width: `${percent}%`, background: 'var(--app-accent, #16c1d6)' }}
        />
      </div>
      <div className="text-medium-emphasis small mb-3">
        {remaining} XP para el nivel {level + 1}
      </div>

      <div className="xp-card__stats">
        <Stat value={totalPracticeMinutes} label="min practicados" />
        <Stat value={tasksCompleted} label="tareas" />
        <Stat value={coursesCompleted} label="cursos" />
      </div>
    </div>
  )
}

export default XPLevelCard
