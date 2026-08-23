import React, { useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormSelect,
  CFormSwitch,
  CFormTextarea,
  CRow,
} from '@coreui/react'
import { cilBell, cilSend } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

const reminderUnits = ['Días', 'Horas']
const reminderTargetGroups = ['Individual', 'Todos', 'Morosos', 'Pagados']

const formatDateTime = (value) => {
  if (!value) return '--'
  return new Date(value).toLocaleString('es-ES', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
}

const ReminderPanel = ({
  studentOptions,
  upcomingReminders,
  onAddReminder,
  onSendReminder,
  userName,
}) => {
  const [form, setForm] = useState({
    studentId: studentOptions[0]?.value || '',
    message: 'Recordatorio de pago próximo.',
    scheduleAt: '',
    intervalValue: 7,
    intervalUnit: reminderUnits[0],
    targetGroup: reminderTargetGroups[2],
    notifyWhatsApp: false,
    active: true,
  })
  const [submitError, setSubmitError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.scheduleAt) return
    setSubmitError('')
    const ok = await onAddReminder(form)
    if (!ok) {
      setSubmitError('No se pudo crear el recordatorio. Intenta de nuevo.')
      return
    }
    setForm({
      studentId: studentOptions[0]?.value || '',
      message: 'Recordatorio de pago próximo.',
      scheduleAt: '',
      intervalValue: 7,
      intervalUnit: reminderUnits[0],
      targetGroup: reminderTargetGroups[2],
      notifyWhatsApp: false,
      active: true,
    })
  }

  return (
    <CRow className="mb-4">
      <CCol>
        <CCard>
          <CCardHeader>Recordatorios</CCardHeader>
          <CCardBody>
            <CRow className="g-3">
              <CCol md={4}>
                <CForm onSubmit={handleSubmit}>
                  {submitError && <div className="alert alert-danger mb-3">{submitError}</div>}
                  <CRow className="g-3">
                    {form.targetGroup === 'Individual' && (
                      <CCol md={12}>
                        <CFormSelect
                          label="Estudiante"
                          value={form.studentId}
                          onChange={(event) => setForm({ ...form, studentId: event.target.value })}
                        >
                          {studentOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </CFormSelect>
                      </CCol>
                    )}
                    <CCol md={12}>
                      <CFormTextarea
                        rows={3}
                        label="Mensaje"
                        value={form.message}
                        onChange={(event) => setForm({ ...form, message: event.target.value })}
                      />
                    </CCol>
                    <CCol md={4}>
                      <CFormSelect
                        label="Enviar a"
                        value={form.targetGroup}
                        onChange={(event) => setForm({ ...form, targetGroup: event.target.value })}
                      >
                        {reminderTargetGroups.map((target) => (
                          <option key={target} value={target}>
                            {target}
                          </option>
                        ))}
                      </CFormSelect>
                    </CCol>
                    <CCol md={4} className="d-flex align-items-center">
                      <CFormSwitch
                        id="notifyWhatsApp"
                        label="Enviar también por WhatsApp"
                        checked={form.notifyWhatsApp}
                        onChange={(event) =>
                          setForm({ ...form, notifyWhatsApp: event.target.checked })
                        }
                      />
                    </CCol>
                    <CCol md={4}>
                      <CFormInput
                        type="datetime-local"
                        label="Programado para"
                        value={form.scheduleAt}
                        onChange={(event) => setForm({ ...form, scheduleAt: event.target.value })}
                      />
                    </CCol>
                    <CCol md={4}>
                      <CFormInput
                        type="number"
                        label="Intervalo"
                        value={form.intervalValue}
                        min={0}
                        onChange={(event) =>
                          setForm({ ...form, intervalValue: event.target.value })
                        }
                      />
                    </CCol>
                    <CCol md={4}>
                      <CFormSelect
                        label="Unidad"
                        value={form.intervalUnit}
                        onChange={(event) => setForm({ ...form, intervalUnit: event.target.value })}
                      >
                        {reminderUnits.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </CFormSelect>
                    </CCol>
                    <CCol md={4} className="d-flex align-items-center">
                      <CFormSwitch
                        id="reminderActive"
                        label="Activo"
                        checked={form.active}
                        onChange={(event) => setForm({ ...form, active: event.target.checked })}
                      />
                    </CCol>
                    <CCol className="text-end">
                      <CButton type="submit" color="success">
                        <CIcon icon={cilBell} className="me-2" /> Agregar recordatorio
                      </CButton>
                    </CCol>
                  </CRow>
                </CForm>
              </CCol>
              <CCol md={8}>
                <div className="table-responsive">
                  <table className="table table-striped mb-0">
                    <thead>
                      <tr>
                        <th>Estudiante</th>
                        <th>Programado</th>
                        <th>Grupo</th>
                        <th>Canal</th>
                        <th>Intervalo</th>
                        <th>Último envío</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {upcomingReminders.map((reminder) => (
                        <tr key={reminder.id}>
                          <td>
                            {reminder.target_group === 'Individual'
                              ? reminder.profiles?.full_name || reminder.target_group
                              : reminder.target_group}
                          </td>
                          <td>{formatDateTime(reminder.schedule_at)}</td>
                          <td>{reminder.target_group || 'Individual'}</td>
                          <td>{reminder.notify_whatsapp ? 'App + WhatsApp' : 'App'}</td>
                          <td>
                            {reminder.interval_value > 0
                              ? `${reminder.interval_value} ${reminder.interval_unit}`
                              : 'Sólo una vez'}
                          </td>
                          <td>
                            {reminder.last_sent ? formatDateTime(reminder.last_sent) : 'Nunca'}
                          </td>
                          <td>
                            <CButton
                              size="sm"
                              color="warning"
                              onClick={() => onSendReminder(reminder, 'Manual')}
                            >
                              <CIcon icon={cilSend} className="me-1" /> Enviar ahora
                            </CButton>
                          </td>
                        </tr>
                      ))}
                      {upcomingReminders.length === 0 && (
                        <tr>
                          <td colSpan={7}>No hay recordatorios programados.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CCol>
            </CRow>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default React.memo(ReminderPanel)
