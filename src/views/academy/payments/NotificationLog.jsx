import React, { useState } from 'react'
import { CCard, CCardBody, CCardHeader } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilChevronBottom, cilChevronTop } from '@coreui/icons'
import { formatDateTime } from '../../../utils/format'

/**
 * Historial de notificaciones enviadas. Va plegado bajo la tabla de pagos: es
 * la traza de lasApps, no el archivo financiero, y ocupa media pantalla cuando
 * hay muchas entradas.
 */
const NotificationLog = ({ entries }) => {
  const [expanded, setExpanded] = useState(false)
  const count = entries.length

  return (
    <CCard className="mt-3">
      <CCardHeader
        className="app-accordion-head"
        onClick={() => setExpanded((v) => !v)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setExpanded((v) => !v)
          }
        }}
      >
        <span className="fw-semibold">Historial de notificaciones</span>
        <span className="text-body-secondary small">
          {count} {count === 1 ? 'envío' : 'envíos'}
        </span>
        <CIcon
          icon={expanded ? cilChevronTop : cilChevronBottom}
          className="ms-auto"
          aria-hidden="true"
        />
      </CCardHeader>
      {expanded && (
        <CCardBody>
          {count === 0 ? (
            <p className="text-body-secondary mb-0">No hay notificaciones enviadas todavía.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped mb-0">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Mensaje</th>
                    <th>Canal</th>
                    <th>Enviado</th>
                    <th>Disparador</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.student_name}</td>
                      <td>{entry.message}</td>
                      <td>{entry.method}</td>
                      <td>{formatDateTime(entry.sent_at)}</td>
                      <td>{entry.trigger_type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CCardBody>
      )}
    </CCard>
  )
}

export default React.memo(NotificationLog)
