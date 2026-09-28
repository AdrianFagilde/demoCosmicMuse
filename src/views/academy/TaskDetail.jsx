import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CListGroup,
  CListGroupItem,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilBook, cilCheckCircle, cilPencil, cilUser } from '@coreui/icons'
import { useAuth } from '../../context/AuthContext'
import useSupabaseTask from '../../hooks/useSupabaseTask'
import TaskDetailEditorModal from '../../components/TaskDetailEditorModal'
import LinkifiedText from '../../components/LinkifiedText'
import { isOverdue } from '../../utils/dates'

const statusColors = {
  Pendiente: 'warning',
  'En progreso': 'info',
  Completado: 'success',
}

// Una tarea de curso no tiene status ni progress propios: el CHECK
// assignments_context_xor impide que tenga course_id y student_id a la vez, y
// su avance real es el checklist. El mismo criterio que usa el listado.
const isCourseTask = (task) => Boolean(task?.course_id)

const TaskDetail = () => {
  const { id } = useParams()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [editing, setEditing] = useState(false)

  const {
    task,
    items,
    doneSet,
    completedItems,
    totalItems,
    percent,
    canEditProgress,
    loading,
    error,
    toggleItem,
    updateTask,
    addChecklistItem,
    deleteChecklistItem,
    reorderChecklistItems,
  } = useSupabaseTask(id)

  if (loading) {
    return (
      <div className="text-center pt-4">
        <CSpinner color="primary" />
      </div>
    )
  }

  // El RLS ya impide ver una tarea ajena, asi que "no existe" aqui significa
  // que no existe para este usuario. No se distingue el caso del RLS del
  // borrado porque el dato no llega en ninguno de los dos.
  if (error || !task) {
    return (
      <>
        <CCard className="app-card">
          <CCardBody>
            <div className="alert alert-warning mb-3" role="alert">
              {error
                ? `No se pudo cargar la tarea: ${error.message}`
                : 'Esta tarea no existe o ya no está disponible.'}
            </div>
            <CButton color="secondary" variant="outline" as={Link} to="/tasks">
              <CIcon icon={cilArrowLeft} className="me-1" aria-hidden="true" />
              Volver a tareas
            </CButton>
          </CCardBody>
        </CCard>
      </>
    )
  }

  const isDone = isCourseTask(task) ? percent === 100 : task.status === 'Completado'
  const overdue = isOverdue(task.due_date) && !isDone

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <Link to="/tasks" className="text-decoration-none">
          <CIcon icon={cilArrowLeft} aria-hidden="true" /> Volver a tareas
        </Link>
        {isAdmin && (
          <CButton color="primary" onClick={() => setEditing(true)}>
            <CIcon icon={cilPencil} className="me-1" aria-hidden="true" />
            Editar detalle
          </CButton>
        )}
      </div>

      <CRow className="g-4">
        <CCol lg={8}>
          <CCard className="app-card mb-4">
            <CCardHeader className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <h2 className="h5 mb-0">{task.title}</h2>
              {isCourseTask(task) ? (
                <CBadge color={percent === 100 ? 'success' : 'info'}>
                  {completedItems}/{totalItems} checklist
                </CBadge>
              ) : (
                <CBadge color={statusColors[task.status] || 'secondary'}>{task.status}</CBadge>
              )}
            </CCardHeader>
            <CCardBody>
              {task.description ? (
                <LinkifiedText text={task.description} />
              ) : (
                <p className="text-medium-emphasis mb-0">Sin descripción.</p>
              )}
            </CCardBody>
          </CCard>

          {totalItems > 0 && (
            <CCard className="app-card">
              <CCardHeader>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <span>Checklist</span>
                  <span className="small text-medium-emphasis">
                    {completedItems} de {totalItems} completados
                  </span>
                </div>
              </CCardHeader>
              <CCardBody>
                {canEditProgress ? (
                  <>
                    <CListGroup flush>
                      {items.map((item) => (
                        <CListGroupItem key={item.id}>
                          <CFormCheck
                            id={`task-item-${item.id}`}
                            label={item.label}
                            checked={doneSet.has(item.id)}
                            onChange={(event) => toggleItem(item.id, event.target.checked)}
                          />
                        </CListGroupItem>
                      ))}
                    </CListGroup>
                    <p className="small text-medium-emphasis mt-3 mb-0">
                      El avance se calcula al marcar cada ítem. No se edita a mano.
                    </p>
                  </>
                ) : (
                  <>
                    <CListGroup flush>
                      {items.map((item) => (
                        <CListGroupItem key={item.id}>
                          <span
                            className={doneSet.has(item.id) ? 'text-decoration-line-through' : ''}
                          >
                            {item.label}
                          </span>
                        </CListGroupItem>
                      ))}
                    </CListGroup>
                    {!isAdmin && (
                      <p className="small text-medium-emphasis mt-3 mb-0">
                        {isCourseTask(task)
                          ? 'Esta tarea no se puede marcar desde aquí.'
                          : 'El progreso de una tarea individual lo define tu profesor.'}
                      </p>
                    )}
                  </>
                )}
              </CCardBody>
            </CCard>
          )}
        </CCol>

        <CCol lg={4}>
          <CCard className="app-card mb-4">
            <CCardHeader>Progreso</CCardHeader>
            <CCardBody>
              {isCourseTask(task) ? (
                isAdmin ? (
                  <p className="text-medium-emphasis mb-0">
                    El avance se registra por alumno. Inicia sesión como alumno para ver el tuyo.
                  </p>
                ) : (
                  <>
                    <div className="d-flex justify-content-between mb-1">
                      <span>{percent}%</span>
                      <span className="text-medium-emphasis">
                        {completedItems}/{totalItems}
                      </span>
                    </div>
                    <div
                      className="progress"
                      role="progressbar"
                      aria-label="Progreso del checklist"
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="progress-bar" style={{ width: `${percent}%` }} />
                    </div>
                  </>
                )
              ) : (
                <>
                  <div className="d-flex justify-content-between mb-1">
                    <span>{task.progress ?? 0}%</span>
                  </div>
                  <div
                    className="progress"
                    role="progressbar"
                    aria-label="Progreso de la tarea"
                    aria-valuenow={task.progress ?? 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div className="progress-bar" style={{ width: `${task.progress ?? 0}%` }} />
                  </div>
                </>
              )}
              {isDone && (
                <div className="d-flex align-items-center gap-2 mt-3 text-success">
                  <CIcon icon={cilCheckCircle} aria-hidden="true" />
                  <span className="fw-semibold">Tarea completada</span>
                </div>
              )}
            </CCardBody>
          </CCard>

          <CCard className="app-card">
            <CCardHeader>Detalles</CCardHeader>
            <CCardBody>
              <dl className="mb-0">
                {task.profiles?.full_name && (
                  <>
                    <dt className="small text-medium-emphasis fw-semibold d-flex align-items-center gap-1">
                      <CIcon icon={cilUser} aria-hidden="true" /> Alumno
                    </dt>
                    <dd>{task.profiles.full_name}</dd>
                  </>
                )}
                {task.assigned_by_profile?.full_name && (
                  <>
                    <dt className="small text-medium-emphasis fw-semibold">Asignada por</dt>
                    <dd>{task.assigned_by_profile.full_name}</dd>
                  </>
                )}
                {task.course?.title && (
                  <>
                    <dt className="small text-medium-emphasis fw-semibold d-flex align-items-center gap-1">
                      <CIcon icon={cilBook} aria-hidden="true" /> Curso
                    </dt>
                    <dd>
                      <Link to={`/courses/${task.course_id}`}>{task.course.title}</Link>
                    </dd>
                  </>
                )}
                <dt className="small text-medium-emphasis fw-semibold">Fecha de entrega</dt>
                <dd className={overdue ? 'text-danger fw-semibold mb-0' : 'mb-0'}>
                  {task.due_date || '—'}
                  {overdue && (
                    <CBadge color="danger" className="ms-2" style={{ fontSize: '0.65rem' }}>
                      Vencida
                    </CBadge>
                  )}
                </dd>
              </dl>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {editing && (
        <TaskDetailEditorModal
          task={task}
          onClose={() => setEditing(false)}
          onUpdateTask={updateTask}
          onAddItem={addChecklistItem}
          onDeleteItem={deleteChecklistItem}
          onReorderItems={reorderChecklistItems}
        />
      )}
    </>
  )
}

export default TaskDetail
