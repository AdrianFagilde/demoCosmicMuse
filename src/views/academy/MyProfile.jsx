import React from 'react'
import {
  CAvatar,
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
import { useAuth } from '../../context/AuthContext'
import useSupabaseLessons from '../../hooks/useSupabaseLessons'

const MyProfile = () => {
  const { user, profile } = useAuth()
  const { lessons, loading } = useSupabaseLessons(user?.id)

  if (!profile || profile.role !== 'student') {
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
                  {profile.full_name
                    .split(' ')
                    .map((word) => word[0])
                    .join('')}
                </CAvatar>
                <div>
                  <h4 className="mb-1">{profile.full_name}</h4>
                  <div className="text-medium-emphasis">Estudiante</div>
                </div>
              </div>
              <div className="mb-3">
                <strong>Instrumento:</strong> {profile.instrument}
              </div>
              <div className="mb-3">
                <strong>Nivel:</strong> {profile.level}
              </div>
              <div className="mb-3">
                <strong>Profesor:</strong> {profile.teacher}
              </div>
              <div className="mb-3">
                <strong>Email:</strong> {profile.email}
              </div>
              <div>
                <strong>Progreso:</strong>{' '}
                <CBadge color="success">{profile.progress}%</CBadge>
              </div>
              <div className="mt-2">
                <strong>Asistencia:</strong> {profile.attendance}%
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={8} className="mb-3">
          <CCard>
            <CCardHeader>Próximas clases</CCardHeader>
            <CCardBody>
              {loading ? (
                <CSpinner color="primary" />
              ) : (
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
                    {lessons.length > 0 ? (
                      lessons.map((lesson) => (
                        <CTableRow key={lesson.id}>
                          <CTableDataCell>{lesson.lesson_date}</CTableDataCell>
                          <CTableDataCell>{lesson.lesson_time}</CTableDataCell>
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
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default MyProfile
