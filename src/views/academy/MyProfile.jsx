import React from 'react'
import {
  CAvatar,
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
import { useAuth } from '../../context/AuthContext'
import { lessons, students } from '../../data/academy'

const MyProfile = () => {
  const { user } = useAuth()
  const student = students.find((item) => item.email === user?.email)
  const nextLessons = lessons.filter((lesson) => lesson.student === student?.name)

  if (!user || user.role !== 'student') {
    return (
      <CCard className="mb-4">
        <CCardBody>
          <h4>Acceso restringido</h4>
          <p>Esta sección solo está disponible para los estudiantes de Cosmo Music.</p>
        </CCardBody>
      </CCard>
    )
  }

  return (
    <>
      <CRow className="mb-4">
        <CCol md={4} className="mb-3">
          <CCard>
            <CCardBody>
              <div className="d-flex align-items-center gap-3 mb-3">
                <CAvatar color="primary" size="xl">
                  {student?.name
                    .split(' ')
                    .map((word) => word[0])
                    .join('')}
                </CAvatar>
                <div>
                  <h4 className="mb-1">{student?.name}</h4>
                  <div className="text-medium-emphasis">Estudiante</div>
                </div>
              </div>
              <div className="mb-3">
                <strong>Instrumento:</strong> {student?.instrument}
              </div>
              <div className="mb-3">
                <strong>Nivel:</strong> {student?.level}
              </div>
              <div className="mb-3">
                <strong>Profesor:</strong> {student?.teacher}
              </div>
              <div className="mb-3">
                <strong>Email:</strong> {student?.email}
              </div>
              <div>
                <strong>Progreso:</strong> <CBadge color="success">{student?.progress}%</CBadge>
              </div>
              <div className="mt-2">
                <strong>Asistencia:</strong> {student?.attendance}%
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={8} className="mb-3">
          <CCard>
            <CCardHeader>Próximas clases</CCardHeader>
            <CCardBody>
              <CTable hover responsive>
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell>Fecha</CTableHeaderCell>
                    <CTableHeaderCell>Hora</CTableHeaderCell>
                    <CTableHeaderCell>Instrumento</CTableHeaderCell>
                    <CTableHeaderCell>Profesor</CTableHeaderCell>
                    <CTableHeaderCell>Duración</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {nextLessons.length > 0 ? (
                    nextLessons.map((lesson, index) => (
                      <CTableRow key={index}>
                        <CTableDataCell>{lesson.date}</CTableDataCell>
                        <CTableDataCell>{lesson.time}</CTableDataCell>
                        <CTableDataCell>{lesson.instrument}</CTableDataCell>
                        <CTableDataCell>{lesson.teacher}</CTableDataCell>
                        <CTableDataCell>{lesson.duration}</CTableDataCell>
                      </CTableRow>
                    ))
                  ) : (
                    <CTableRow>
                      <CTableDataCell colSpan={5}>No hay clases programadas.</CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default MyProfile
