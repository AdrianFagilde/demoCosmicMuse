import React, { useState } from 'react'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormSelect,
  CFormTextarea,
  CFormInput,
  CInputGroup,
  CInputGroupText,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { cilCheckCircle, cilPencil, cilTrash } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useAuth } from '../../context/AuthContext'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import useSupabaseTasks from '../../hooks/useSupabaseTasks'

const statusColors = {
  Pendiente: 'warning',
  'En progreso': 'info',
  Completado: 'success',
}

const Tasks = () => {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { students } = useSupabaseStudents()
  const { tasks, loading, addTask, deleteTask, changeTaskStatus, changeTaskProgress } =
    useSupabaseTasks(user?.id)
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    studentId: students[0]?.id || '',
    dueDate: '',
    status: 'Pendiente',
    progress: 0,
  })

  const studentTasks = tasks.filter((task) => task.student_id === user?.id)
  const visibleTasks = isAdmin ? tasks : studentTasks

  const handleAddTask = async (event) => {
    event.preventDefault()
    if (!newTask.title || !newTask.description || !newTask.dueDate || !newTask.studentId) {
      return
    }
    await addTask({
      title: newTask.title,
      description: newTask.description,
      studentId: newTask.studentId,
      assignedBy: profile.id,
      dueDate: newTask.dueDate,
      status: newTask.status,
      progress: newTask.progress,
    })
    setNewTask({
      title: '',
      description: '',
      studentId: students[0]?.id || '',
      dueDate: '',
      status: 'Pendiente',
      progress: 0,
    })
  }

  const handleDelete = async (taskId) => {
    await deleteTask(taskId)
  }

  const handleStatusChange = async (taskId, status) => {
    await changeTaskStatus(taskId, status)
  }

  const handleProgressChange = async (taskId, value) => {
    await changeTaskProgress(taskId, value)
  }

  return (
    <>
      <CRow className="mb-4">
        <CCol>
          <CCard>
            <CCardHeader>Tareas</CCardHeader>
            <CCardBody>
              <p>
                {isAdmin
                  ? 'Administra, asigna y controla el progreso de las tareas de los estudiantes.'
                  : 'Consulta tus tareas asignadas y revisa tu progreso actual.'}
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {isAdmin && (
        <CRow className="mb-4">
          <CCol>
            <CCard>
              <CCardHeader>Crear nueva tarea</CCardHeader>
              <CCardBody>
                <CForm onSubmit={handleAddTask}>
                  <CRow className="g-3">
                    <CCol md={6}>
                      <CFormInput
                        label="Título"
                        value={newTask.title}
                        onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
                        placeholder="Ej. Practicar escalas"
                      />
                    </CCol>
                    <CCol md={6}>
                      <CFormSelect
                        label="Asignar a"
                        value={newTask.studentId}
                        onChange={(event) =>
                          setNewTask({ ...newTask, studentId: event.target.value })
                        }
                      >
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.full_name}
                          </option>
                        ))}
                      </CFormSelect>
                    </CCol>
                    <CCol md={6}>
                      <CFormInput
                        type="date"
                        label="Fecha de entrega"
                        value={newTask.dueDate}
                        onChange={(event) =>
                          setNewTask({ ...newTask, dueDate: event.target.value })
                        }
                      />
                    </CCol>
                    <CCol md={6}>
                      <CFormSelect
                        label="Estado inicial"
                        value={newTask.status}
                        onChange={(event) => setNewTask({ ...newTask, status: event.target.value })}
                      >
                        <option value="Pendiente">Pendiente</option>
                        <option value="En progreso">En progreso</option>
                        <option value="Completado">Completado</option>
                      </CFormSelect>
                    </CCol>
                    <CCol md={12}>
                      <CFormTextarea
                        label="Descripción"
                        rows={3}
                        value={newTask.description}
                        onChange={(event) =>
                          setNewTask({ ...newTask, description: event.target.value })
                        }
                        placeholder="Describe la tarea y los objetivos de la práctica"
                      />
                    </CCol>
                    <CCol md={12} className="text-end">
                      <CButton type="submit" color="primary">
                        Guardar tarea
                      </CButton>
                    </CCol>
                  </CRow>
                </CForm>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      )}

      <CCard>
        <CCardHeader>{isAdmin ? 'Tareas asignadas' : 'Tus tareas'}</CCardHeader>
        <CCardBody>
          {loading ? (
            <CSpinner color="primary" />
          ) : (
            <CTable hover responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Título</CTableHeaderCell>
                  <CTableHeaderCell>Estudiante</CTableHeaderCell>
                  <CTableHeaderCell>Fecha de entrega</CTableHeaderCell>
                  <CTableHeaderCell>Estado</CTableHeaderCell>
                  <CTableHeaderCell>Progreso</CTableHeaderCell>
                  {isAdmin && <CTableHeaderCell>Acciones</CTableHeaderCell>}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {visibleTasks.length > 0 ? (
                  visibleTasks.map((task) => (
                    <CTableRow key={task.id}>
                      <CTableDataCell>
                        <div className="fw-semibold">{task.title}</div>
                        <div className="text-medium-emphasis small">{task.description}</div>
                      </CTableDataCell>
                      <CTableDataCell>{task.profiles?.full_name || '—'}</CTableDataCell>
                      <CTableDataCell>{task.due_date}</CTableDataCell>
                      <CTableDataCell>
                        <CBadge color={statusColors[task.status] || 'secondary'}>
                          {task.status}
                        </CBadge>
                      </CTableDataCell>
                      <CTableDataCell>
                        <div className="d-flex align-items-center gap-2">
                          <span>{task.progress}%</span>
                          <div className="progress flex-grow-1" style={{ minWidth: 120 }}>
                            <div
                              className="progress-bar"
                              role="progressbar"
                              style={{ width: `${task.progress}%` }}
                              aria-valuenow={task.progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            />
                          </div>
                        </div>
                      </CTableDataCell>
                      {isAdmin && (
                        <CTableDataCell>
                          <div className="d-flex gap-2">
                            <CButton
                              color="info"
                              size="sm"
                              onClick={() => handleStatusChange(task.id, 'En progreso')}
                            >
                              <CIcon icon={cilPencil} className="me-1" />
                              En progreso
                            </CButton>
                            <CButton
                              color="success"
                              size="sm"
                              onClick={() => handleStatusChange(task.id, 'Completado')}
                            >
                              <CIcon icon={cilCheckCircle} className="me-1" />
                              Completar
                            </CButton>
                            <CButton color="danger" size="sm" onClick={() => handleDelete(task.id)}>
                              <CIcon icon={cilTrash} className="me-1" />
                              Eliminar
                            </CButton>
                          </div>
                          <div className="mt-2">
                            <CInputGroup size="sm">
                              <CInputGroupText>Progreso</CInputGroupText>
                              <CFormInput
                                type="number"
                                min={0}
                                max={100}
                                value={task.progress}
                                onChange={(event) =>
                                  handleProgressChange(task.id, event.target.value)
                                }
                              />
                            </CInputGroup>
                          </div>
                        </CTableDataCell>
                      )}
                    </CTableRow>
                  ))
                ) : (
                  <CTableRow>
                    <CTableDataCell colSpan={isAdmin ? 6 : 5} className="text-center">
                      {isAdmin
                        ? 'No hay tareas registradas todavía.'
                        : 'No tienes tareas asignadas por el momento.'}
                    </CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
          )}
        </CCardBody>
      </CCard>
    </>
  )
}

export default Tasks
