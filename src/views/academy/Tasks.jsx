import React, { useMemo, useState } from 'react'
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
import { students, tasks as initialTasks } from '../../data/academy'

const statusColors = {
  Pendiente: 'warning',
  'En progreso': 'info',
  Completado: 'success',
}

const Tasks = () => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [tasks, setTasks] = useState(() => initialTasks.map((t) => ({ ...t })))
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    student: students[0]?.name || '',
    dueDate: '',
    status: 'Pendiente',
    progress: 0,
  })

  const studentTasks = useMemo(
    () => tasks.filter((task) => task.student === user?.name),
    [tasks, user],
  )

  const visibleTasks = isAdmin ? tasks : studentTasks

  const handleAddTask = (event) => {
    event.preventDefault()
    if (!newTask.title || !newTask.description || !newTask.dueDate || !newTask.student) {
      return
    }
    setTasks((current) => [
      ...current,
      {
        id: current.length + 1,
        ...newTask,
        assignedBy: user?.name || 'Administrador',
      },
    ])
    setNewTask({
      title: '',
      description: '',
      student: students[0]?.name || '',
      dueDate: '',
      status: 'Pendiente',
      progress: 0,
    })
  }

  const handleDelete = (taskId) => {
    setTasks((current) => current.filter((task) => task.id !== taskId))
  }

  const handleStatusChange = (taskId, status) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? { ...task, status, progress: status === 'Completado' ? 100 : task.progress }
          : task,
      ),
    )
  }

  const handleProgressChange = (taskId, value) => {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId
          ? {
              ...task,
              progress: Number(value),
              status: Number(value) === 100 ? 'Completado' : task.status,
            }
          : task,
      ),
    )
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
                        value={newTask.student}
                        onChange={(event) =>
                          setNewTask({ ...newTask, student: event.target.value })
                        }
                      >
                        {students.map((student) => (
                          <option key={student.id} value={student.name}>
                            {student.name}
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
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>ID</CTableHeaderCell>
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
                    <CTableDataCell>{task.id}</CTableDataCell>
                    <CTableDataCell>
                      <div className="fw-semibold">{task.title}</div>
                      <div className="text-medium-emphasis small">{task.description}</div>
                    </CTableDataCell>
                    <CTableDataCell>{task.student}</CTableDataCell>
                    <CTableDataCell>{task.dueDate}</CTableDataCell>
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
                  <CTableDataCell colSpan={isAdmin ? 7 : 6} className="text-center">
                    {isAdmin
                      ? 'No hay tareas registradas todavía.'
                      : 'No tienes tareas asignadas por el momento.'}
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

export default Tasks
