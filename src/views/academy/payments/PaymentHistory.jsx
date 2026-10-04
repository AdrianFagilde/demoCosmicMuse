import React, { useMemo, useState } from 'react'
import {
  CButton,
  CCol,
  CPagination,
  CPaginationItem,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableFoot,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilExternalLink } from '@coreui/icons'
import { sortPayments } from '../../../utils/payments'

const PAGE_SIZE = 10

const escapeCsvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

/**
 * Cabecera ordenable. Vive fuera del componente principal a proposito: declarado
 * dentro, React lo recrearia en cada render y perderia el estado propio.
 */
const SortableHead = ({ columnKey, label, activeKey, direction, onSort }) => {
  const isActive = columnKey === activeKey
  return (
    <CTableHeaderCell
      onClick={() => onSort(columnKey)}
      className="app-sortable"
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label}
      {isActive ? (direction === 'asc' ? ' ↑' : ' ↓') : null}
    </CTableHeaderCell>
  )
}

/**
 * Tabla del historial de pagos. Recibe la lista ya filtrada desde Payments y
 * solo resuelve orden, paginacion y exportacion: asi el filtro vive en un solo
 * sitio (utils/payments) y la tabla no vuelve a interpretar los datos.
 *
 * `showToolbar=false` recorta la fila de exportar cuando la tabla se usa como
 * resumen de "ultimos pagos": alli exportar un recorte de 8 filas seria una
 * version incompleta del archivo, que es justo lo que el admin no quiere.
 */
const PaymentHistory = ({ payments, onViewProof, totalAll, showToolbar = true }) => {
  const [loadingProofId, setLoadingProofId] = useState(null)
  const [sortKey, setSortKey] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [page, setPage] = useState(1)

  const handleViewProof = async (payment) => {
    setLoadingProofId(payment.id)
    const url = await onViewProof?.(payment.proof_url)
    setLoadingProofId(null)
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  const sorted = useMemo(
    () => sortPayments(payments, sortKey, sortDirection),
    [payments, sortKey, sortDirection],
  )

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  // Un filtro mas estrecho puede dejar la pagina actual fuera de rango; se
  // muestra la ultima pagina valida en lugar de una tabla vacia.
  const currentPage = Math.min(page, pageCount)
  const visible = useMemo(
    () => sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sorted, currentPage],
  )

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection('asc')
  }

  const handleExport = () => {
    const header = [
      'Estudiante',
      'Monto',
      'Fecha',
      'Método',
      'Frecuencia',
      'Notas',
      'Registrado por',
    ]
    const rows = sorted.map((p) => [
      p.profiles?.full_name || '',
      Number(p.amount).toFixed(2),
      p.payment_date || '',
      p.method || '',
      p.frequency || '',
      p.notes || '',
      p.recorder?.full_name || '',
    ])
    const csv = [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n')
    // El BOM hace que Excel abra el archivo en UTF-8 y no rompa los acentos.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'historial-pagos.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {showToolbar && (
        <CRow className="mb-3">
          <CCol className="d-flex justify-content-end gap-2">
            <CButton
              size="sm"
              color="secondary"
              variant="outline"
              onClick={handleExport}
              disabled={sorted.length === 0}
            >
              Exportar CSV
            </CButton>
          </CCol>
        </CRow>
      )}

      <div className="table-responsive">
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <SortableHead
                columnKey="student"
                label="Estudiante"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHead
                columnKey="amount"
                label="Monto"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHead
                columnKey="date"
                label="Fecha"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <SortableHead
                columnKey="method"
                label="Método"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={handleSort}
              />
              <CTableHeaderCell>Frecuencia</CTableHeaderCell>
              <CTableHeaderCell>Comprobante</CTableHeaderCell>
              <CTableHeaderCell>Notas</CTableHeaderCell>
              <CTableHeaderCell>Registrado por</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {sorted.length === 0 && (
              <CTableRow>
                <CTableDataCell colSpan={8} className="text-center text-body-secondary py-4">
                  Todavía no hay pagos registrados.
                </CTableDataCell>
              </CTableRow>
            )}
            {visible.map((payment) => (
              <CTableRow key={payment.id}>
                <CTableDataCell>{payment.profiles?.full_name || '—'}</CTableDataCell>
                <CTableDataCell className="fw-semibold">
                  ${Number(payment.amount).toFixed(2)}
                </CTableDataCell>
                <CTableDataCell>{payment.payment_date}</CTableDataCell>
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
                      <CIcon icon={cilExternalLink} className="me-1" aria-hidden="true" />
                      {loadingProofId === payment.id ? 'Abriendo...' : payment.proof_name || 'Ver'}
                    </CButton>
                  ) : (
                    <span className="text-body-secondary">
                      {payment.proof_name || 'No cargado'}
                    </span>
                  )}
                </CTableDataCell>
                <CTableDataCell>{payment.notes}</CTableDataCell>
                <CTableDataCell>{payment.recorder?.full_name || 'Administrador'}</CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
          {showToolbar && sorted.length > 0 && (
            <CTableFoot>
              <CTableRow>
                <CTableDataCell colSpan={8}>
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="text-body-secondary">
                      Mostrando {visible.length} de {sorted.length} pagos
                      {totalAll != null && sorted.length !== totalAll
                        ? ` (de ${totalAll} en total)`
                        : ''}
                    </small>
                    {pageCount > 1 && (
                      <CPagination size="sm" aria-label="Paginacion del historial de pagos">
                        {Array.from({ length: pageCount }, (_, index) => index + 1).map((n) => (
                          <CPaginationItem
                            key={n}
                            active={n === currentPage}
                            onClick={() => setPage(n)}
                          >
                            {n}
                          </CPaginationItem>
                        ))}
                      </CPagination>
                    )}
                  </div>
                </CTableDataCell>
              </CTableRow>
            </CTableFoot>
          )}
        </CTable>
      </div>
    </>
  )
}

export default React.memo(PaymentHistory)
