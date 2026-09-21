import React, { useRef, useState } from 'react'
import {
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
  CRow,
  CCol,
} from '@coreui/react'
import { cilCloudUpload, cilPlus } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from '../../../utils/forms'

const paymentMethods = ['Pago móvil', 'Efectivo', 'Transferencia']
const paymentsFrequency = ['Mensual', 'Quincenal', 'Semanal']

const emptyForm = (studentId = '') => ({
  studentId,
  amount: '',
  date: '',
  method: paymentMethods[0],
  frequency: paymentsFrequency[0],
  notes: '',
})

const PaymentForm = ({ studentOptions, onSubmit }) => {
  const [form, setForm] = useState(() => emptyForm(studentOptions[0]?.value || ''))
  const [proofFile, setProofFile] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  const effectiveStudentId = form.studentId || studentOptions[0]?.value || ''

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitError('')

    if (!effectiveStudentId) {
      setSubmitError('Selecciona un estudiante.')
      return
    }
    const amount = Number(form.amount)
    if (!form.amount || !Number.isFinite(amount) || amount <= 0) {
      setSubmitError('Introduce un monto válido mayor que 0.')
      return
    }
    if (!form.date) {
      setSubmitError('Selecciona la fecha del pago.')
      return
    }

    setSaving(true)
    const ok = await onSubmit(form, proofFile)
    setSaving(false)
    if (!ok) {
      setSubmitError('No se pudo registrar el pago. Revisa los datos e intenta de nuevo.')
      return
    }
    setForm(emptyForm(studentOptions[0]?.value || ''))
    setProofFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleProofChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setSubmitError(`El comprobante supera el límite de ${MAX_FILE_SIZE_MB} MB.`)
      event.target.value = ''
      return
    }
    setSubmitError('')
    setProofFile(file)
  }

  return (
    <CForm onSubmit={handleSubmit}>
      {submitError && <div className="alert alert-danger">{submitError}</div>}
      <CRow className="g-3">
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
        <CCol md={6}>
          <CFormInput
            type="number"
            label="Monto"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            placeholder="Ej. 50"
            required
          />
        </CCol>
        <CCol md={6}>
          <CFormInput
            type="date"
            label="Fecha de pago"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
            required
          />
        </CCol>
        <CCol md={6}>
          <CFormSelect
            label="Método"
            value={form.method}
            onChange={(event) => setForm({ ...form, method: event.target.value })}
          >
            {paymentMethods.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={6}>
          <CFormSelect
            label="Frecuencia"
            value={form.frequency}
            onChange={(event) => setForm({ ...form, frequency: event.target.value })}
          >
            {paymentsFrequency.map((frequency) => (
              <option key={frequency} value={frequency}>
                {frequency}
              </option>
            ))}
          </CFormSelect>
        </CCol>
        <CCol md={6}>
          <CFormLabel htmlFor="proofUpload">Comprobante</CFormLabel>
          <CInputGroup>
            <CInputGroupText>
              <CIcon icon={cilCloudUpload} />
            </CInputGroupText>
            <CFormInput
              id="proofUpload"
              type="file"
              ref={fileInputRef}
              onChange={handleProofChange}
              accept="image/*"
            />
          </CInputGroup>
          <div className="form-text">Imagen de máx. {MAX_FILE_SIZE_MB} MB.</div>
          {proofFile && <div className="form-text">Archivo seleccionado: {proofFile.name}</div>}
        </CCol>
        <CCol md={12}>
          <CFormTextarea
            rows={3}
            label="Notas"
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Observaciones del pago"
          />
        </CCol>
        <CCol className="text-end">
          <CButton type="submit" color="primary" disabled={saving}>
            <CIcon icon={cilPlus} className="me-2" />
            {saving ? 'Registrando...' : 'Registrar pago'}
          </CButton>
        </CCol>
      </CRow>
    </CForm>
  )
}

export default React.memo(PaymentForm)
