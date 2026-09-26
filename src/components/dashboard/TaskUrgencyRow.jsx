import React from 'react'
import { CCard, CCardBody, CBadge, CProgress, CButton } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilCalendar, cilMusicNote, cilBook } from '@coreui/icons'
import { getUrgency } from '../../utils/dates'

const TaskUrgencyRow = ({ task, onClick }) => {
  const urgency = getUrgency(task.due_date)
  const isOverdue = urgency.diffDays < 0
  const isDueToday = urgency.diffDays === 0

  return (
    <CCard
      className="task-urgency-row mb-2"
      style={{ borderLeft: `4px solid var(--cui-${urgency.color})` }}
    >
      <CCardBody
        className="py-2 px-3"
        style={{ cursor: onClick ? 'pointer' : 'default' }}
        // La fila es clicable pero no era alcanzable con teclado: sin role
        // ni tabIndex los usuarios de teclado se quedan sin esta accion.
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          onClick
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onClick(task)
                }
              }
            : undefined
        }
      >
        <div className="d-flex align-items-start gap-3">
          <div className="flex-grow-1 min-w-0">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="fw-semibold text-truncate">{task.title}</span>
              {task.course_title && (
                <CBadge
                  color="dark"
                  variant="outline"
                  className="text-truncate"
                  style={{ maxWidth: '120px' }}
                >
                  <CIcon icon={cilBook} size="xs" className="me-1" />
                  {task.course_title}
                </CBadge>
              )}
              {urgency.diffDays !== undefined && (
                <CBadge color={urgency.color} className={isOverdue ? 'blink' : ''}>
                  <CIcon icon={cilCalendar} size="xs" className="me-1" />
                  {urgency.label}
                </CBadge>
              )}
            </div>
            <div className="d-flex align-items-center gap-2 mt-2">
              <CProgress
                value={task.progress || 0}
                height={6}
                color="info"
                className="flex-grow-1"
                maxWidth={200}
              />
              <span className="fw-semibold small text-medium-emphasis">{task.progress || 0}%</span>
            </div>
          </div>
          <CButton
            color="primary"
            size="sm"
            className="ms-2 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              onClick?.(task)
            }}
          >
            {isOverdue ? 'Ponerte al día' : isDueToday ? 'Hacer ahora' : 'Continuar'}
          </CButton>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default TaskUrgencyRow
