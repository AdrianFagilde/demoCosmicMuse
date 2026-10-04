import React from 'react'
import { CCol, CRow } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMoney, cilUser, cilCheck } from '@coreui/icons'

/**
 * Fila de indicadores del panel de Pagos.
 *
 * Tres tarjetas de solo lectura: total cobrado en el mes, estudiantes con pago
 * vencido (morosos) y quantos han pagado al menos una vez. Sin max-width, la
 * fila ocupa el ancho del contenido como el resto de tarjetas de la app.
 */
const KPICard = ({ label, value, hint, color, icon }) => (
  <CCol xs={12} md={4}>
    <div className={`app-card app-kpi app-kpi-${color}`}>
      <div className="app-kpi-head">
        <CIcon icon={icon} aria-hidden="true" />
        <span className="app-kpi-label">{label}</span>
      </div>
      <div className="app-kpi-value">{value}</div>
      {hint && <div className="app-kpi-hint">{hint}</div>}
    </div>
  </CCol>
)

const KPICards = ({ totalMonth, delinquentCount, paidCount, studentCount }) => (
  <CRow className="g-3 mb-4">
    <KPICard
      label="Cobrado este mes"
      value={totalMonth}
      hint="Suma de los pagos registrados del mes en curso"
      color="success"
      icon={cilMoney}
    />
    <KPICard
      label="Morosos"
      value={delinquentCount}
      hint={
        studentCount === 0
          ? 'Sin estudiantes dados de alta'
          : `${studentCount - delinquentCount} de ${studentCount} al día`
      }
      color="danger"
      icon={cilUser}
    />
    <KPICard
      label="Con pagos"
      value={`${paidCount}/${studentCount}`}
      hint="Estudiantes con al menos un pago registrado"
      color="info"
      icon={cilCheck}
    />
  </CRow>
)

export default React.memo(KPICards)
