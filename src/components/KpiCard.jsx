import React from 'react'
import { CCard, CCardBody, CCol } from '@coreui/react'
import CIcon from '@coreui/icons-react'

const KpiCard = ({ color = 'purple', label, value, subtext, icon, md = 3, sm = 6 }) => (
  <CCol md={md} sm={sm} className="mb-3">
    <CCard className={`app-card app-card-brand app-card-brand--${color} kpi-card h-100`}>
      <CCardBody className="d-flex align-items-center justify-content-between gap-3">
        <div>
          <div className="kpi-label">{label}</div>
          <div className="fs-3 fw-semibold">{value}</div>
          <div className="kpi-subtext mt-2">{subtext}</div>
        </div>
        {icon && <CIcon icon={icon} customClassName="kpi-icon" aria-hidden="true" />}
      </CCardBody>
    </CCard>
  </CCol>
)

export default KpiCard
