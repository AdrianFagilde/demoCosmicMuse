import React from 'react'
import { CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react'
import { formatDateTime } from '../../../utils/format'

const NotificationLog = ({ entries }) => {
  return (
    <CRow className="mb-4">
      <CCol>
        <CCard>
          <CCardHeader>Historial de notificaciones</CCardHeader>
          <CCardBody>
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
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={5}>No hay notificaciones enviadas todavía.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default React.memo(NotificationLog)
