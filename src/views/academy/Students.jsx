import React, { useMemo, useState } from 'react'
import {
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormSelect,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { cilPeople, cilSearch } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'

const Students = () => {
  const { profile } = useAuth()
  const { students, loading } = useSupabaseStudents()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')

  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return students.filter((s) => {
      const matchesSearch =
        !term ||
        s.full_name?.toLowerCase().includes(term) ||
        s.instrument?.toLowerCase().includes(term) ||
        s.teacher?.toLowerCase().includes(term)
      const matchesStatus =
        statusFilter === 'Todos' || s.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [students, search, statusFilter])

  if (!profile || profile.role !== 'admin') {
    return (
      <CCard className="mb-4">
        <CCardBody>
          <h4>Acceso restringido</h4>
          <p>
            Solo los administradores pueden ver la lista de estudiantes y el control de la academia.
          </p>
        </CCardBody>
      </CCard>
    )
  }

  if (loading) {
    return (
      <div className="text-center pt-4">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <>
      <CRow className="mb-4">
        <CCol md={3} sm={6} className="mb-3">
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Estudiantes activos</div>
              <div className="fs-3 fw-semibold">{students.length}</div>
              <div className="text-body-secondary mt-2 d-flex align-items-center">
                <CIcon icon={cilPeople} className="me-2" /> Total registrado
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
      <CCard>
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <span>Perfiles</span>
          <span className="text-medium-emphasis small">{filtered.length} resultado(s)</span>
        </CCardHeader>
        <CCardBody>
          <CRow className="mb-3">
            <CCol md={8} sm={12} className="mb-2 mb-md-0">
              <CFormInput
                type="text"
                placeholder="Buscar por nombre, instrumento o profesor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prepend={<CIcon icon={cilSearch} />}
              />
            </CCol>
            <CCol md={4} sm={12}>
              <CFormSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="Todos">Todos los estados</option>
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </CFormSelect>
            </CCol>
          </CRow>
          <CTable align="middle" className="mb-0 border" hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Nombre</CTableHeaderCell>
                <CTableHeaderCell>Instrumento</CTableHeaderCell>
                <CTableHeaderCell>Profesor</CTableHeaderCell>
                <CTableHeaderCell>Progreso</CTableHeaderCell>
                <CTableHeaderCell>Asistencia</CTableHeaderCell>
                <CTableHeaderCell>Próxima clase</CTableHeaderCell>
                <CTableHeaderCell>Estado</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {filtered.map((student) => (
                <CTableRow key={student.id}>
                  <CTableDataCell>
                    <Link to={`/students/${student.id}`}>{student.full_name}</Link>
                  </CTableDataCell>
                  <CTableDataCell>{student.instrument}</CTableDataCell>
                  <CTableDataCell>{student.teacher}</CTableDataCell>
                  <CTableDataCell>
                    <div className="d-flex align-items-center gap-2">
                      <CBadge color="primary">{student.progress}%</CBadge>
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>{student.attendance}%</CTableDataCell>
                  <CTableDataCell>
                    {student.next_lesson
                      ? new Date(student.next_lesson).toLocaleString('es-ES', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={student.status === 'Activo' ? 'success' : 'secondary'}>
                      {student.status}
                    </CBadge>
                  </CTableDataCell>
                </CTableRow>
              ))}
              {filtered.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={7} className="text-center text-medium-emphasis">
                    No se encontraron estudiantes con esos filtros.
                  </CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </>
  )
}

export default Students
