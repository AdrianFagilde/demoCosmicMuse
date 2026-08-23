import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  CAvatar,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
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
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import useSupabaseTasks from '../../hooks/useSupabaseTasks'
import RestrictedAccess from '../../components/RestrictedAccess'

const StudentDetail = () => {
  const { id } = useParams()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { getStudent, updateStudentMetrics, loading: studentsLoading } = useSupabaseStudents()
  const { tasks, addTask, changeTaskStatus, loading: tasksLoading } = useSupabaseTasks()

  const student = getStudent(id)
  const studentTasks = tasks.filter((t) => t.student_id === id)

  const [localProgress, setLocalProgress] = useState(student?.progress || 0)
  const [localAttendance, setLocalAttendance] = useState(student?.attendance || 0)
  const [syncedId, setSyncedId] = useState(null)
  if (student && syncedId !== student.id) {
    setSyncedId(student.id)
    setLocalProgress(student.progress || 0)
    setLocalAttendance(student.attendance || 0)
  }

  if (!isAdmin) {
    return (
      <RestrictedAccess message="Sólo los administradores pueden ver y editar perfiles de estudiantes." />
    )
  }

  if (studentsLoading) {
    return (
      <div className="text-center pt-4">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (!student) {
    return (
      <CCard className="mb-4">
        <CCardBody>
          <h4>Estudiante no encontrado</h4>
          <p>El estudiante solicitado no existe.</p>
        </CCardBody>
      </CCard>
    )
  }

  const handleSaveMetrics = async () => {
    await updateStudentMetrics(id, localProgress, localAttendance)
  }

  const handleAddQuickTask = async () => {
    await addTask({
      title: 'Nueva tarea rápida',
      studentId: id,
      assignedBy: profile.id,
      dueDate: new Date().toISOString().slice(0, 10),
    })
  }

  return (
    <>
      <CRow className="mb-4">
        <CCol md={4} className="mb-3">
          <CCard>
            <CCardHeader>Perfil de {student.full_name}</CCardHeader>
            <CCardBody>
              <div className="d-flex align-items-center gap-3 mb-3">
                <CAvatar color="primary" size="xl">
                  {student.full_name
                    .split(' ')
                    .map((w) => w[0])
                    .join('')}
                </CAvatar>
                <div>
                  <h4 className="mb-1">{student.full_name}</h4>
                  <div className="text-medium-emphasis">{student.instrument}</div>
                </div>
              </div>
              <div className="mb-2">
                <strong>Progreso:</strong> <CBadge color="success">{student.progress}%</CBadge>
              </div>
              <div className="mb-2">
                <strong>Asistencia:</strong> {student.attendance}%
              </div>
              <div className="mb-2">
                <strong>Profesor:</strong> {student.teacher}
              </div>
              <div className="mt-3">
                <CForm>
                  <div className="mb-2">
                    <label className="form-label">Ajustar progreso</label>
                    <CFormInput
                      type="number"
                      min={0}
                      max={100}
                      value={localProgress}
                      onChange={(e) => setLocalProgress(e.target.value)}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Ajustar asistencia</label>
                    <CFormInput
                      type="number"
                      min={0}
                      max={100}
                      value={localAttendance}
                      onChange={(e) => setLocalAttendance(e.target.value)}
                    />
                  </div>
                  <div className="text-end">
                    <CButton color="primary" onClick={handleSaveMetrics}>
                      Guardar métricas
                    </CButton>
                  </div>
                </CForm>
              </div>
              <div className="mt-3">
                <Link to="/students">← Volver a Perfiles</Link>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={8} className="mb-3">
          <CCard>
            <CCardHeader>Tareas de {student.full_name}</CCardHeader>
            <CCardBody>
              <div className="mb-3">
                <CButton color="primary" size="sm" onClick={handleAddQuickTask}>
                  Añadir tarea rápida
                </CButton>
              </div>
              {tasksLoading ? (
                <CSpinner color="primary" />
              ) : (
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Título</CTableHeaderCell>
                      <CTableHeaderCell>Entrega</CTableHeaderCell>
                      <CTableHeaderCell>Estado</CTableHeaderCell>
                      <CTableHeaderCell>Acciones</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {studentTasks.map((t) => (
                      <CTableRow key={t.id}>
                        <CTableDataCell>{t.title}</CTableDataCell>
                        <CTableDataCell>{t.due_date}</CTableDataCell>
                        <CTableDataCell>{t.status}</CTableDataCell>
                        <CTableDataCell>
                          <div className="d-flex gap-2">
                            <CButton
                              size="sm"
                              color="info"
                              onClick={() => changeTaskStatus(t.id, 'En progreso')}
                            >
                              En progreso
                            </CButton>
                            <CButton
                              size="sm"
                              color="success"
                              onClick={() => changeTaskStatus(t.id, 'Completado')}
                            >
                              Completar
                            </CButton>
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
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

export default StudentDetail
