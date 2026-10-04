import React, { useState } from 'react'
import {
  CButton,
  CCol,
  CForm,
  CFormInput,
  CFormSelect,
  CFormSwitch,
  CFormTextarea,
  CRow,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBell } from '@coreui/icons'

const reminderUnits = ['Días', 'Horas']
const reminderTargetGroups = ['Individual', 'Todos', 'Morosos', 'Pagados']

const emptyForm = (studentId = '') => ({
  studentId,
  message: 'Recordatorio de pago próximo.',
  scheduleAt: '',
  intervalValue: 7,
  intervalUnit: reminderUnits[0],
  targetGroup: reminderTargetGroups[2],
  notifyWhatsApp: false,
  active: true,
})

// Al editar se parte del recordatorio existente; al crear, del formulario
// vacio con el primer estudiante preseleccionado.
const formFromReminder = (reminder, fallbackStudentId = '') => ({
  studentId: reminder?.student_id || fallbackStudentId,
  message: reminder?.message || emptyForm().message,
  scheduleAt: reminder?.schedule_at ? String(reminder.schedule_at).slice(0, 16) : '',
  intervalValue: reminder?.interval_value ?? 7,
  intervalUnit: reminder?.interval_unit || reminderUnits[0],
  targetGroup: reminder?.target_group || reminderTargetGroups[2],
  notifyWhatsApp: !!reminder?.notify_whatsapp,
  active: reminder ? !!reminder.active : true,
})

/**
 * Alta y edicion de recordatorios de pago en modal. El formulario se cierra
 * solo cuando el recordatorio queda guardado, igual que el de pagos.
 *
 * El padre lo monta solo mientras esta abierto y cambia la `key` entre crear y
 * editar: asi el estado nace ya con los datos correctos, sin un efecto que lo
 * reinicie al abrir y sin arrastrar el formulario anterior.
 */
const ReminderFormModal = ({ onClose, studentOptions, onSubmit, reminder }) => {
  const [form, setForm] = useState(() => formFromReminder(reminder, studentOptions[0]?.value || ''))
  const [submitError, setSubmitError] = useState('')

  const effectiveStudentId = form.studentId || studentOptions[0]?.value || ''

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (!form.scheduleAt) {
      setSubmitError('Selecciona la fecha de programación del recordatorio.')
      return
    }
    if (!form.message.trim()) {
      setSubmitError('El mensaje del recordatorio no puede estar vacío.')
      return
    }
    if (form.targetGroup === 'Individual' && !effectiveStudentId) {
      setSubmitError('Selecciona el estudiante destinatario.')
      return
    }

    const interval = Number(form.intervalValue)
    if (form.intervalValue !== '' && (!Number.isFinite(interval) || interval < 0)) {
      setSubmitError('El intervalo debe ser un número mayor o igual a 0.')
      return
    }

    const ok = await onSubmit({ ...form, studentId: effectiveStudentId }, reminder)
    if (!ok) {
      setSubmitError('No se pudo guardar el recordatorio. Intenta de nuevo.')
      return
    }
    onClose()
  }

  return (
    <CModal visible onClose={onClose} size="lg" scrollable>
      <CModalHeader>{reminder ? 'Editar recordatorio' : 'Nuevo recordatorio'}</CModalHeader>
      <CModalBody>
        <CForm onSubmit={handleSubmit}>
          {submitError && <div className="alert alert-danger mb-3">{submitError}</div>}
          <CRow className="g-3">
            <CCol md={12}>
              <CFormTextarea
                rows={3}
                label="Mensaje"
                value={form.message}
                onChange={(event) => setForm({ ...form, message: event.target.value })}
              />
            </CCol>
            <CCol md={6}>
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
            {form.targetGroup === 'Individual' && (
              <CCol md={6}>
                <CFormSelect
                  label="Estudiante"
                  value={effectiveStudentId}
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
            <CCol md={6}>
              <CFormInput
                type="datetime-local"
                label="Programado para"
                value={form.scheduleAt}
                onChange={(event) => setForm({ ...form, scheduleAt: event.target.value })}
                required
              />
            </CCol>
            <CCol md={3}>
              <CFormInput
                type="number"
                label="Intervalo (0 = una sola vez)"
                value={form.intervalValue}
                min={0}
                onChange={(event) => setForm({ ...form, intervalValue: event.target.value })}
              />
            </CCol>
            <CCol md={3}>
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
            <CCol md={6} className="d-flex align-items-center">
              <CFormSwitch
                id="notifyWhatsApp"
                label="Enviar también por WhatsApp"
                checked={form.notifyWhatsApp}
                onChange={(event) => setForm({ ...form, notifyWhatsApp: event.target.checked })}
              />
            </CCol>
            <CCol md={6} className="d-flex align-items-center">
              <CFormSwitch
                id="reminderActive"
                label="Activo"
                checked={form.active}
                onChange={(event) => setForm({ ...form, active: event.target.checked })}
              />
            </CCol>
          </CRow>
        </CForm>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>
          Cancelar
        </CButton>
        <CButton color="success" onClick={handleSubmit}>
          <CIcon icon={cilBell} className="me-2" aria-hidden="true" />
          {reminder ? 'Guardar cambios' : 'Agregar recordatorio'}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default React.memo(ReminderFormModal)
