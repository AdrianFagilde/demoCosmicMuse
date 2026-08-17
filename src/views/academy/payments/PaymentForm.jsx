import React, { useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
  CRow,
} from '@coreui/react'
import { cilCloudUpload, cilPlus } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

const paymentMethods = ['Pago móvil', 'Efectivo', 'Transferencia']
const paymentsFrequency = ['Mensual', 'Quincenal', 'Semanal']

const PaymentForm = ({ studentOptions, onSubmit }) => {
  const [form, setForm] = useState({
    studentId: studentOptions[0]?.value || '',
    amount: '',
    date: '',
    method: paymentMethods[0],
    frequency: paymentsFrequency[0],
    proof: '',
    notes: '',
  })

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit(form)
    setForm({
      studentId: studentOptions[0]?.value || '',
      amount: '',
      date: '',
      method: paymentMethods[0],
      frequency: paymentsFrequency[0],
      proof: '',
      notes: '',
    })
  }

  const handleProofChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setForm((current) => ({ ...current, proof: file.name }))
  }

  return (
    <CForm onSubmit={handleSubmit}>
      <CRow className="g-3">
        <CCol md={6}>
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
        <CCol md={6}>
          <CFormInput
            type="number"
            label="Monto"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            placeholder="Ej. 50"
          />
        </CCol>
        <CCol md={6}>
          <CFormInput
            type="date"
            label="Fecha de pago"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
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
              onChange={handleProofChange}
              accept="image/*"
            />
          </CInputGroup>
          {form.proof && <div className="form-text">Archivo seleccionado: {form.proof}</div>}
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
          <CButton type="submit" color="primary">
            <CIcon icon={cilPlus} className="me-2" /> Registrar pago
          </CButton>
        </CCol>
      </CRow>
    </CForm>
  )
}

export default React.memo(PaymentForm)
