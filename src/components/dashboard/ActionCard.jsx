import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilCalendar, cilMusicNote, cilBook, cilArrowRight, cilClock } from '@coreui/icons'
import { getUrgency } from '../../utils/dates'
import ProgressRing from './ProgressRing'

const ActionCard = ({ task, onClick }) => {
  const urgency = getUrgency(task.due_date)
  // `color` es el nombre de CoreUI ('danger', 'warning'...) y `hex` el valor
  // real. Las reglas de este componente son CSS plano, no clases de CoreUI:
  // usar `color` producia `backgroundColor: 'danger15'`, una declaracion
  // invalida que el navegador descarta en silencio, y la tarjeta se quedaba
  // sin color de urgencia.
  const tone = urgency.hex
  const instrumentColor = task.instrument_color || '#6366f1'

  return (
    <div
      className={`action-card ${urgency.variant}`}
      style={{ '--action-color': tone }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      <div className="d-flex align-items-start gap-3">
        <div className="action-icon">
          <CIcon icon={cilMusicNote} size="lg" />
        </div>
        <div className="flex-grow-1 min-w-0">
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span className="fw-semibold text-truncate" style={{ maxWidth: '100%' }}>
              {task.title}
            </span>
            <span
              className="badge text-truncate d-flex align-items-center gap-1"
              style={{
                backgroundColor: `${tone}15`,
                color: tone,
                border: `1px solid ${tone}40`,
                fontSize: '0.6rem',
                padding: '2px 6px',
              }}
            >
              <CIcon icon={cilCalendar} size="xs" />
              {urgency.label}
            </span>
          </div>
          {task.course_title && (
            <div className="d-flex align-items-center gap-1 text-medium-emphasis small mb-2">
              <CIcon icon={cilBook} size="xs" />
              <span className="text-truncate" style={{ maxWidth: '200px' }}>
                {task.course_title}
              </span>
            </div>
          )}
          <div className="d-flex align-items-center gap-2">
            <ProgressRing
              progress={task.progress || 0}
              size={44}
              strokeWidth={4}
              color={instrumentColor}
              backgroundColor="rgba(0,0,0,0.05)"
              showValue={false}
              animate={true}
            />
            <div className="d-flex flex-column">
              <span className="fw-semibold small" style={{ color: instrumentColor }}>
                {task.progress || 0}%
              </span>
              <span className="text-medium-emphasis" style={{ fontSize: '0.65rem' }}>
                {task.task_type === 'course' ? 'Tarea de curso' : 'Tarea general'}
              </span>
            </div>
          </div>
        </div>
        <CIcon
          icon={cilArrowRight}
          size="lg"
          className="text-medium-emphasis flex-shrink-0 mt-1"
          style={{ opacity: 0.5 }}
        />
      </div>
    </div>
  )
}

export default ActionCard
