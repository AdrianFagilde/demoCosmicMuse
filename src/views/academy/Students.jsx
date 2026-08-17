import React from 'react'
import {
  CBadge,
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
import { cilSchool, cilPeople, cilCalendar, cilCheckCircle } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { getCurrentUser } from '../../auth'
import { Link } from 'react-router-dom'
import { students, summary } from '../../data/academy'

const Students = () => {
  const user = getCurrentUser()

  if (!user || user.role !== 'admin') {
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

  return (
    <>
      <CRow className="mb-4">
        <CCol md={3} sm={6} className="mb-3">
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Estudiantes activos</div>
              <div className="fs-3 fw-semibold">{summary.activeStudents}</div>
              <div className="text-body-secondary mt-2 d-flex align-items-center">
                <CIcon icon={cilPeople} className="me-2" /> Total registrado
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6} className="mb-3">
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Clases esta semana</div>
              <div className="fs-3 fw-semibold">{summary.lessonsThisWeek}</div>
              <div className="text-body-secondary mt-2 d-flex align-items-center">
                <CIcon icon={cilCalendar} className="me-2" /> Horarios próximos
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6} className="mb-3">
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Profesores</div>
              <div className="fs-3 fw-semibold">{summary.teachers}</div>
              <div className="text-body-secondary mt-2 d-flex align-items-center">
                <CIcon icon={cilSchool} className="me-2" /> Mentores disponibles
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6} className="mb-3">
          <CCard className="h-100">
            <CCardBody>
              <div className="text-medium-emphasis small">Instrumentos</div>
              <div className="fs-3 fw-semibold">{summary.availableInstruments.length}</div>
              <div className="text-body-secondary mt-2 d-flex align-items-center">
                <CIcon icon={cilCheckCircle} className="me-2" /> Secciones abiertas
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
                <CTableHeaderCell>ID</CTableHeaderCell>
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
                  <CTableDataCell>{student.id}</CTableDataCell>
                  <CTableDataCell>
                    <Link to={`/students/${student.id}`}>{student.name}</Link>
                  </CTableDataCell>
                  <CTableDataCell>{student.instrument}</CTableDataCell>
                  <CTableDataCell>{student.teacher}</CTableDataCell>
                  <CTableDataCell>
                    <div className="d-flex align-items-center gap-2">
                      <CBadge color="primary">{student.progress}%</CBadge>
                    </div>
                  </CTableDataCell>
                  <CTableDataCell>{student.attendance}%</CTableDataCell>
                  <CTableDataCell>{student.nextLesson}</CTableDataCell>
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
