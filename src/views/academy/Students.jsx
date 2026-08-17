import React, { useEffect, useState } from 'react'
import {
  CBadge,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { cilSchool, cilPeople, cilCalendar, cilCheckCircle } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'

const Students = () => {
  const { profile } = useAuth()
  const { students, loading } = useSupabaseStudents()
  const [summary, setSummary] = useState({
    activeStudents: 0,
    lessonsThisWeek: 0,
    teachers: 0,
    availableInstruments: [],
  })

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
        <CCardHeader>Perfiles</CCardHeader>
        <CCardBody>
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
              {students.map((student) => (
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
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>
    </>
  )
}

export default Students
