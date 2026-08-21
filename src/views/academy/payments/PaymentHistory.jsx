import React from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'

const PaymentHistory = ({ payments }) => {
  return (
    <CRow className="mb-4">
      <CCol>
        <CCard>
          <CCardHeader>Historial de pagos</CCardHeader>
          <CCardBody>
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Estudiante</CTableHeaderCell>
                  <CTableHeaderCell>Monto</CTableHeaderCell>
                  <CTableHeaderCell>Fecha</CTableHeaderCell>
                  <CTableHeaderCell>Método</CTableHeaderCell>
                  <CTableHeaderCell>Frecuencia</CTableHeaderCell>
                  <CTableHeaderCell>Comprobante</CTableHeaderCell>
                  <CTableHeaderCell>Notas</CTableHeaderCell>
                  <CTableHeaderCell>Registrado por</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {payments.map((payment) => (
                  <CTableRow key={payment.id}>
                    <CTableDataCell>{payment.studentName}</CTableDataCell>
                    <CTableDataCell>${Number(payment.amount).toFixed(2)}</CTableDataCell>
                    <CTableDataCell>{payment.date}</CTableDataCell>
                    <CTableDataCell>{payment.method}</CTableDataCell>
                    <CTableDataCell>{payment.frequency}</CTableDataCell>
                    <CTableDataCell>{payment.proof_name || 'No cargado'}</CTableDataCell>
                    <CTableDataCell>{payment.notes}</CTableDataCell>
                    <CTableDataCell>{payment.recordedBy}</CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default React.memo(PaymentHistory)
