import React, { useState } from 'react'
import {
  CButton,
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
import CIcon from '@coreui/icons-react'
import { cilExternalLink } from '@coreui/icons'

const PaymentHistory = ({ payments, onViewProof }) => {
  const [loadingProofId, setLoadingProofId] = useState(null)

  const handleViewProof = async (payment) => {
    setLoadingProofId(payment.id)
    const url = await onViewProof?.(payment.proof_url)
    setLoadingProofId(null)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

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
                {payments.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={8} className="text-center text-body-secondary py-4">
                      Todavía no hay pagos registrados.
                    </CTableDataCell>
                  </CTableRow>
                )}
                {payments.map((payment) => (
                  <CTableRow key={payment.id}>
                    <CTableDataCell>{payment.studentName}</CTableDataCell>
                    <CTableDataCell>${Number(payment.amount).toFixed(2)}</CTableDataCell>
                    <CTableDataCell>{payment.date}</CTableDataCell>
                    <CTableDataCell>{payment.method}</CTableDataCell>
                    <CTableDataCell>{payment.frequency}</CTableDataCell>
                    <CTableDataCell>
                      {payment.proof_url ? (
                        <CButton
                          color="link"
                          size="sm"
                          className="p-0"
                          disabled={loadingProofId === payment.id}
                          onClick={() => handleViewProof(payment)}
                        >
                          <CIcon icon={cilExternalLink} className="me-1" />
                          {loadingProofId === payment.id
                            ? 'Abriendo...'
                            : payment.proof_name || 'Ver comprobante'}
                        </CButton>
                      ) : (
                        payment.proof_name || 'No cargado'
                      )}
                    </CTableDataCell>
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
