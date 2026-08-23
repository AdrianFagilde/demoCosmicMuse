import React, { useMemo, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CFormInput,
  CRow,
} from '@coreui/react'
import { formatDateTime } from '../../../utils/format'

const StudentBalances = ({
  studentBalances,
  filterText,
  filterStatus,
  onFilterTextChange,
  onFilterStatusChange,
}) => {
  const filteredStudents = useMemo(() => {
    return studentBalances.filter((student) => {
      const matchesText =
        filterText === '' ||
        student.name?.toLowerCase().includes(filterText.toLowerCase()) ||
        (student.instrument || '').toLowerCase().includes(filterText.toLowerCase()) ||
        (student.teacher || '').toLowerCase().includes(filterText.toLowerCase())
      const matchesStatus = filterStatus === 'Todos' || student.paymentStatus === filterStatus
      return matchesText && matchesStatus
    })
  }, [studentBalances, filterText, filterStatus])

  return (
    <CRow className="mb-4">
      <CCol>
        <CCard>
          <CCardHeader>Listado de estudiantes</CCardHeader>
          <CCardBody>
            <CRow className="g-3 mb-3">
              <CCol md={6}>
                <CFormInput
                  placeholder="Buscar estudiante, instrumento o profesor"
                  value={filterText}
                  onChange={(event) => onFilterTextChange(event.target.value)}
                />
              </CCol>
              <CCol md={6}>
                <CFormSelect
                  value={filterStatus}
                  onChange={(event) => onFilterStatusChange(event.target.value)}
                >
                  <option value="Todos">Todos</option>
                  <option value="Moroso">Moroso</option>
                  <option value="Pagado">Pagado</option>
                </CFormSelect>
              </CCol>
            </CRow>
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Estudiante</th>
                    <th>Instrumento</th>
                    <th>Profesor</th>
                    <th>Estado</th>
                    <th>Último pago</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => (
                    <tr key={student.id}>
                      <td>{student.name}</td>
                      <td>{student.instrument}</td>
                      <td>{student.teacher}</td>
                      <td>{student.paymentStatus}</td>
                      <td>
                        {student.lastPaidDate ? formatDateTime(student.lastPaidDate) : 'Sin pago'}
                      </td>
                    </tr>
                  ))}
                  {filteredStudents.length === 0 && (
                    <tr>
                      <td colSpan={5}>No se encontraron estudiantes.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CCardBody>
        </CCard>
      </CCol>
    </CRow>
  )
}

export default React.memo(StudentBalances)
