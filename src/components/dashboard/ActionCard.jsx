import React from 'react'
import CIcon from '@coreui/icons-react'
import { cilCalendar, cilMusicNote, cilBook, cilArrowRight } from '@coreui/icons'
import { getUrgency } from '../../utils/dates'
import ProgressRing from './ProgressRing'

const ActionCard = ({ task, onClick }) => {
  const urgency = getUrgency(task.due_date)
  // El color de urgencia ya no se inyecta inline: los modificadores
  // .action-card.<variant> lo declaran en CSS. action-icon, el badge y el borde
  // izquierdo leen todos --action-color.
  const instrumentColor = task.instrument_color || '#6366f1'
  const [isFocused, setIsFocused] = React.useState(false)

  // Una tarea de curso no tiene status/progress propios: su avance es el
  // checklist que el alumno marca dentro del curso.
  const isCourseTask = Boolean(task.course_id)
  const progress = isCourseTask ? (task.checklist_percent ?? 0) : (task.progress ?? 0)
  const progressLabel = isCourseTask
    ? `${task.checklist_completed ?? 0} de ${task.checklist_total ?? 0} pasos del checklist`
    : `progreso ${progress}%`

  return (
    <div
      className={`action-card ${urgency.variant} ${isFocused ? 'focused' : ''}`}
      style={{ '--instrument-color': instrumentColor }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${task.title}, ${urgency.label}, ${progressLabel}`}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault()
          onClick()
        }
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
    >
      <div className="d-flex align-items-start gap-3">
        <div className="action-icon">
          <CIcon icon={cilMusicNote} size="lg" aria-hidden="true" />
        </div>
        <div className="flex-grow-1 action-card-body">
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            {/* Sin LinkifiedText a proposito: la tarjeta es role="button", y
                anadir un <a> dentro pondria un elemento interactivo dentro de
                otro. Ademas el text-truncate cortaria la URL. */}
            <span className="action-card-title fw-semibold text-truncate">{task.title}</span>
            <span className="action-badge badge text-truncate d-flex align-items-center gap-1">
              <CIcon icon={cilCalendar} size="xs" aria-hidden="true" />
              {urgency.label}
            </span>
          </div>
          {task.course?.title && (
            <div className="d-flex align-items-center gap-1 text-medium-emphasis small mb-2">
              <CIcon icon={cilBook} size="xs" aria-hidden="true" />
              <span className="action-card-course text-truncate">{task.course.title}</span>
            </div>
          )}
          <div className="d-flex align-items-center gap-2">
            <ProgressRing
              progress={progress}
              size={44}
              strokeWidth={4}
              color={instrumentColor}
              backgroundColor="rgba(0,0,0,0.05)"
              showValue={false}
              // El "82%" de al lado ya dice el progreso: si el anillo tambien
              // se anuncia, el lector de pantalla lo lee dos veces seguidas.
              decorative
              animate={true}
            />
            <div className="d-flex flex-column">
              <span className="action-progress-value fw-semibold small">{progress}%</span>
              <span className="action-progress-label text-medium-emphasis">
                {isCourseTask ? 'Tarea de curso' : 'Tarea general'}
              </span>
            </div>
          </div>
        </div>
        <CIcon
          icon={cilArrowRight}
          size="lg"
          className="action-arrow text-medium-emphasis flex-shrink-0 mt-1"
          aria-hidden="true"
        />
      </div>
    </div>
  )
}

export default ActionCard
