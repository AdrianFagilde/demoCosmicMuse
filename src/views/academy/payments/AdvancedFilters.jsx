import React from 'react'
import { CBadge, CButton, CCol, CFormInput, CFormSelect, CRow } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilFilter, cilX } from '@coreui/icons'
import { EMPTY_PAYMENT_FILTERS, countActivePaymentFilters } from '../../../utils/payments'

const methodOptions = ['Pago móvil', 'Efectivo', 'Transferencia']
const frequencyOptions = ['Mensual', 'Quincenal', 'Semanal']

/**
 * Filtros del historial de pagos. Se muestran siempre visibles en una sola
 * banda compacta: ocultarlos tras un desplegable los hacia forgets, y el filtro
 * es la forma natural de consultar el archivo.
 */
const AdvancedFilters = ({ filters, onChange, students, collapsed, onToggle }) => {
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value })
  const activeCount = countActivePaymentFilters(filters)

  const clearAll = () => onChange({ ...EMPTY_PAYMENT_FILTERS })

  return (
    <div className="app-filters">
      <div className="app-filters-head">
        <CIcon icon={cilFilter} aria-hidden="true" />
        <span className="app-filters-title">Filtros</span>
        {activeCount > 0 && (
          <CBadge color="primary" className="rounded-pill">
            {activeCount}
          </CBadge>
        )}
        <CButton
          size="sm"
          color="secondary"
          variant="ghost"
          className="ms-auto"
          onClick={onToggle}
          aria-expanded={!collapsed}
        >
          {collapsed ? 'Mostrar' : 'Ocultar'}
        </CButton>
      </div>

      {!collapsed && (
        <>
          <CRow className="g-3">
            <CCol xs={12} md={6} xl={4}>
              <CFormInput
                label="Buscar"
                placeholder="Estudiante, notas, comprobante..."
                value={filters.text}
                onChange={set('text')}
              />
            </CCol>
            <CCol xs={12} md={6} xl={4}>
              <CFormSelect label="Estudiante" value={filters.studentId} onChange={set('studentId')}>
                <option value="">Todos</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.full_name}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol xs={6} md={4} xl={2}>
              <CFormSelect label="Metodo" value={filters.method} onChange={set('method')}>
                <option value="">Todos</option>
                {methodOptions.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol xs={6} md={4} xl={2}>
              <CFormSelect label="Frecuencia" value={filters.frequency} onChange={set('frequency')}>
                <option value="">Todas</option>
                {frequencyOptions.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {frequency}
                  </option>
                ))}
              </CFormSelect>
            </CCol>
            <CCol xs={6} md={4} xl={2}>
              <CFormInput
                label="Desde"
                type="date"
                value={filters.dateFrom}
                onChange={set('dateFrom')}
              />
            </CCol>
            <CCol xs={6} md={4} xl={2}>
              <CFormInput
                label="Hasta"
                type="date"
                value={filters.dateTo}
                onChange={set('dateTo')}
              />
            </CCol>
            <CCol xs={6} md={4} xl={2}>
              <CFormInput
                label="Monto minimo"
                type="number"
                min="0"
                step="0.01"
                value={filters.minAmount}
                onChange={set('minAmount')}
              />
            </CCol>
            <CCol xs={6} md={4} xl={2}>
              <CFormInput
                label="Monto maximo"
                type="number"
                min="0"
                step="0.01"
                value={filters.maxAmount}
                onChange={set('maxAmount')}
              />
            </CCol>
          </CRow>
          {activeCount > 0 && (
            <div className="mt-3">
              <CButton size="sm" color="secondary" variant="outline" onClick={clearAll}>
                <CIcon icon={cilX} className="me-1" aria-hidden="true" />
                Limpiar filtros
              </CButton>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default React.memo(AdvancedFilters)
