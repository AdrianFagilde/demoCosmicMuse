import React, { useState } from 'react'
import {
  CBadge,
  CButton,
  CCol,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSend } from '@coreui/icons'
import { formatDateTime } from '../../../utils/format'

// Estado visible del recordatorio: activo y ya enviado, activo y pendiente de
// envio, o desactivado por el admin.
const reminderStatus = (reminder) => {
  if (!reminder.active) return { label: 'Desactivado', color: 'secondary' }
  if (!reminder.last_sent) return { label: 'Pendiente', color: 'warning' }
  return { label: 'Enviado', color: 'success' }
}

/**
 * Listado de recordatorios programados. Solo acciones: crear y editar viven en
 * el modal, aqui cada fila resume estado y disparador.
 */
const ReminderList = ({ reminders, onSend, onEdit, onToggleActive, onDelete }) => {
  const [sendingId, setSendingId] = useState(null)

  const handleSend = (reminder) => {
    // Sin bloqueo de red, un doble clic entregaba dos tandas completas de
    // notificaciones; el bloqueo vive en el boton.
    setSendingId(reminder.id)
    Promise.resolve(onSend(reminder, 'Manual')).finally(() => setSendingId(null))
  }

  return (
    <CTable hover responsive>
      <CTableHead>
        <CTableRow>
          <CTableHeaderCell>Destinatario</CTableHeaderCell>
          <CTableHeaderCell>Programado</CTableHeaderCell>
          <CTableHeaderCell>Canal</CTableHeaderCell>
          <CTableHeaderCell>Repeticion</CTableHeaderCell>
          <CTableHeaderCell>Ultimo envio</CTableHeaderCell>
          <CTableHeaderCell>Estado</CTableHeaderCell>
          <CTableHeaderCell>Acciones</CTableHeaderCell>
        </CTableRow>
      </CTableHead>
      <CTableBody>
        {reminders.length === 0 && (
          <CTableRow>
            <CTableDataCell colSpan={7} className="text-center text-body-secondary py-4">
              No hay recordatorios programados.
            </CTableDataCell>
          </CTableRow>
        )}
        {reminders.map((reminder) => {
          const status = reminderStatus(reminder)
          const isIndividual = reminder.target_group === 'Individual'
          const sending = sendingId === reminder.id

          return (
            <CTableRow key={reminder.id}>
              <CTableDataCell>
                <div className="fw-semibold">
                  {isIndividual ? reminder.profiles?.full_name || 'Estudiante' : 'Todo el grupo'}
                </div>
                <div className="small text-body-secondary">
                  {isIndividual ? 'Individual' : reminder.target_group}
                </div>
              </CTableDataCell>
              <CTableDataCell>{formatDateTime(reminder.schedule_at)}</CTableDataCell>
              <CTableDataCell>{reminder.notify_whatsapp ? 'App + WhatsApp' : 'App'}</CTableDataCell>
              <CTableDataCell>
                {reminder.interval_value > 0
                  ? `Cada ${reminder.interval_value} ${reminder.interval_unit.toLowerCase()}`
                  : 'Una sola vez'}
              </CTableDataCell>
              <CTableDataCell>
                {reminder.last_sent ? formatDateTime(reminder.last_sent) : 'Nunca'}
              </CTableDataCell>
              <CTableDataCell>
                <CBadge color={status.color} className="rounded-pill">
                  {status.label}
                </CBadge>
              </CTableDataCell>
              <CTableDataCell>
                <div className="d-flex gap-1 flex-wrap">
                  <CButton
                    size="sm"
                    color="warning"
                    disabled={sending}
                    onClick={() => handleSend(reminder)}
                  >
                    <CIcon icon={cilSend} className="me-1" aria-hidden="true" />
                    {sending ? 'Enviando...' : 'Enviar ahora'}
                  </CButton>
                  <CButton
                    size="sm"
                    color="secondary"
                    variant="ghost"
                    onClick={() => onEdit(reminder)}
                  >
                    Editar
                  </CButton>
                  <CButton
                    size="sm"
                    color={reminder.active ? 'secondary' : 'success'}
                    variant="ghost"
                    onClick={() => onToggleActive(reminder)}
                  >
                    {reminder.active ? 'Desactivar' : 'Reactivar'}
                  </CButton>
                  <CButton
                    size="sm"
                    color="danger"
                    variant="ghost"
                    onClick={() => onDelete(reminder)}
                  >
                    Eliminar
                  </CButton>
                </div>
              </CTableDataCell>
            </CTableRow>
          )
        })}
      </CTableBody>
    </CTable>
  )
}

export default React.memo(ReminderList)
