import React, { useEffect, useState } from 'react'
import { CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/react'
import { cilSchool, cilPeople, cilCalendar, cilChart } from '@coreui/icons'
import CIcon from '@coreui/icons-react'

import { useAuth } from '../../context/AuthContext'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import useSupabaseTasks from '../../hooks/useSupabaseTasks'

const Dashboard = () => {
  const { user, profile } = useAuth()
  const isStudent = profile?.role === 'student'
  const { students, getSummary } = useSupabaseStudents()
  const { tasks } = useSupabaseTasks(user?.id)
  const [summary, setSummary] = useState({
    activeStudents: 0,
    lessonsThisWeek: 0,
    teachers: 0,
    availableInstruments: [],
  })

  useEffect(() => {
    getSummary().then(setSummary)
  }, [getSummary])

  const recentTasks = tasks
    .filter((task) => (isStudent ? task.student_id === user?.id : true))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 3)

  const currentStudent = students.find((s) => s.email === user?.email)

  return (
    <>
      <CRow className="mb-4">
        <CCol md={3} sm={6} className="mb-3">
          <CCard>
            <CCardBody>
              <div className="text-medium-emphasis small">Estudiantes activos</div>
              <div className="fs-3 fw-semibold">{summary.activeStudents}</div>
              <div className="text-body-secondary mt-2 d-flex align-items-center gap-2">
                <CIcon icon={cilPeople} /> Total en la academia
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6} className="mb-3">
          <CCard>
            <CCardBody>
              <div className="text-medium-emphasis small">Clases esta semana</div>
              <div className="fs-3 fw-semibold">{summary.lessonsThisWeek}</div>
              <div className="text-body-secondary mt-2 d-flex align-items-center gap-2">
                <CIcon icon={cilCalendar} /> Horarios programados
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6} className="mb-3">
          <CCard>
            <CCardBody>
              <div className="text-medium-emphasis small">Profesores</div>
              <div className="fs-3 fw-semibold">{summary.teachers}</div>
              <div className="text-body-secondary mt-2 d-flex align-items-center gap-2">
                <CIcon icon={cilSchool} /> Mentores disponibles
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={3} sm={6} className="mb-3">
          <CCard>
            <CCardBody>
              <div className="text-medium-emphasis small">Instrumentos</div>
              <div className="fs-3 fw-semibold">{summary.availableInstruments.length}</div>
              <div className="text-body-secondary mt-2 d-flex align-items-center gap-2">
                <CIcon icon={cilChart} /> Categorías activas
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CCard className="mb-4">
        <CCardHeader>Bienvenido a Cosmo Music Academy</CCardHeader>
        <CCardBody>
          <p className="text-body-secondary">
            {isStudent
              ? 'Revisa tu progreso, próximas clases y comunicación con tu profesor.'
              : 'Administra estudiantes, horarios y performance de la academia desde un solo lugar.'}
          </p>
        </CCardBody>
      </CCard>

      {!isStudent && (
        <CRow className="mb-4">
          {students.slice(0, 3).map((student) => (
            <CCol xs={12} md={4} key={student.id} className="mb-3">
              <CCard>
                <CCardHeader>{student.full_name}</CCardHeader>
                <CCardBody>
                  <div className="text-medium-emphasis small">Instrumento</div>
                  <div className="fw-semibold mb-2">{student.instrument}</div>
                  <div className="text-medium-emphasis small">Profesor</div>
                  <div className="fw-semibold mb-2">{student.teacher}</div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-medium-emphasis">Progreso</span>
                    <strong>{student.progress}%</strong>
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
          ))}
        </CRow>
      )}

      {isStudent && (
        <CRow>
          <CCol xs={12} md={6} className="mb-3">
            <CCard>
              <CCardHeader>Tu próxima clase</CCardHeader>
              <CCardBody>
                <div className="fw-semibold">
                  {currentStudent?.next_lesson
                    ? new Date(currentStudent.next_lesson).toLocaleString('es-ES', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : 'Sin programar'}
                </div>
                <div className="text-body-secondary">Horario asignado por tu profesor</div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={12} md={6} className="mb-3">
            <CCard>
              <CCardHeader>Progreso actual</CCardHeader>
              <CCardBody>
                <div className="fw-semibold">{currentStudent?.progress || 0}%</div>
                <div className="text-body-secondary">Avance en tu plan de estudio</div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      )}

      <CRow>
        <CCol>
          <CCard>
            <CCardHeader>Tareas recientes</CCardHeader>
            <CCardBody>
              <div className="text-medium-emphasis mb-3">
                {isStudent
                  ? 'Tus tareas más recientes asignadas por el profesor.'
                  : 'Las últimas tareas registradas en la academia.'}
              </div>
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Estudiante</th>
                    <th>Entrega</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.title}</td>
                      <td>{task.profiles?.full_name || '—'}</td>
                      <td>{task.due_date}</td>
                      <td>{task.status}</td>
                    </tr>
                  ))}
                  {recentTasks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-medium-emphasis">
                        {isStudent
                          ? 'No tienes tareas recientes asignadas.'
                          : 'No hay tareas registradas todavía.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default Dashboard
