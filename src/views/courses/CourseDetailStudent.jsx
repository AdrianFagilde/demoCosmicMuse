import React from 'react'
import { Link } from 'react-router-dom'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CProgress,
  CProgressBar,
} from '@coreui/react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft } from '@coreui/icons'
import { StudentSortableChecklistItem } from '../../components/CourseSortableRows'
import MaterialList from '../../components/MaterialList'
import LinkifiedText from '../../components/LinkifiedText'
import { isOverdue } from '../../utils/dates'

/**
 * Vista del alumno: progreso propio, materiales en solo lectura, cuestionarios
 * y checklist de cada tarea.
 *
 * `canReorder` llega siempre en false desde CourseDetail.jsx, porque este
 * componente solo se monta cuando el rol no es admin. Se conserva como prop en
 * lugar de borrarse porque es la garantia que impide que un alumno alcance
 * `reorderChecklistItems`, una escritura de admin: si mañana alguien reutiliza
 * este componente desde otro sitio, la defensa sigue en su sitio.
 */
const CourseDetailStudent = ({
  course,
  courseId,
  student,
  canReorder,
  sensors,
  myStats,
  myProgressRows,
  setMyProgressRows,
  mySubmissions,
  api,
  setCourse,
}) => (
  <>
    <CButton as={Link} to="/courses" color="secondary" variant="outline" className="mb-3">
      <CIcon icon={cilArrowLeft} className="me-1" aria-hidden="true" /> Volver a cursos
    </CButton>

    <CCard className="app-card mb-4">
      <CCardHeader className="d-flex justify-content-between align-items-center">
        <span className="fw-bold">{course.title}</span>
        <CBadge color={myStats.percent >= 100 ? 'success' : 'info'}>{myStats.percent}%</CBadge>
      </CCardHeader>
      <CCardBody>
        {course.description && <p>{course.description}</p>}
        {(course.instrument || course.level) && (
          <div className="d-flex gap-2 mb-2">
            {course.instrument && <CBadge color="primary">{course.instrument}</CBadge>}
            {course.level && <CBadge color="dark">{course.level}</CBadge>}
          </div>
        )}
        <CProgressBar variant="thin" value={myStats.percent} />
      </CCardBody>
    </CCard>

    {(course.course_materials || []).length > 0 && (
      <CCard className="app-card mb-4">
        <CCardHeader>Contenido del curso</CCardHeader>
        <CCardBody>
          <MaterialList materials={course.course_materials} readOnly />
        </CCardBody>
      </CCard>
    )}

    {(course.course_forms || []).some((f) => !f.task_id) && (
      <CCard className="app-card mb-4">
        <CCardHeader>Cuestionarios del curso</CCardHeader>
        <CCardBody>
          {course.course_forms
            .filter((f) => !f.task_id)
            .map((form) => {
              const submitted = Boolean(mySubmissions[form.id])
              const overdue = form.due_date && !submitted && isOverdue(form.due_date)
              return (
                <div
                  key={form.id}
                  className="border rounded p-2 mb-2 d-flex justify-content-between align-items-center gap-2"
                >
                  <div>
                    <div className="fw-semibold">{form.title}</div>
                    {form.description && (
                      <small className="text-medium-emphasis">{form.description}</small>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    {overdue ? (
                      <CBadge color="danger">Vencido</CBadge>
                    ) : (
                      <CBadge color={submitted ? 'success' : 'warning text-dark'}>
                        {submitted ? 'Enviado' : 'Pendiente'}
                      </CBadge>
                    )}
                    {form.due_date && !submitted && (
                      <small className="text-medium-emphasis">Límite: {form.due_date}</small>
                    )}
                    <CButton
                      size="sm"
                      color={submitted ? 'secondary' : 'primary'}
                      variant={submitted ? 'outline' : 'solid'}
                      as={Link}
                      to={`/courses/${courseId}/forms/${form.id}`}
                    >
                      {submitted ? 'Ver respuestas' : 'Responder'}
                    </CButton>
                  </div>
                </div>
              )
            })}
        </CCardBody>
      </CCard>
    )}

    {course.course_tasks.length === 0 ? (
      <CCard className="app-card">
        <CCardBody className="text-center text-medium-emphasis">
          Tu profesor todavía no ha publicado tareas en este curso.
        </CCardBody>
      </CCard>
    ) : (
      course.course_tasks.map((task) => {
        const taskDone = myStats.doneByTask[task.id] || 0
        const taskTotal = (task.task_checklist_items || []).length
        const taskPercent = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0
        const taskForm = (course.course_forms || []).find((f) => f.task_id === task.id)
        const formSubmitted = taskForm ? Boolean(mySubmissions[taskForm.id]) : false
        const formOverdue = taskForm?.due_date && !formSubmitted && isOverdue(taskForm.due_date)
        const sortedItems = [...(task.task_checklist_items || [])].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0),
        )

        return (
          <CCard key={task.id} className="app-card mb-3">
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <LinkifiedText className="fw-semibold" text={task.title} />
              <div className="d-flex align-items-center gap-2">
                {task.due_date && (
                  <CBadge color="warning text-dark">Entrega: {task.due_date}</CBadge>
                )}
                <CBadge color={taskPercent >= 100 ? 'success' : 'info'}>{taskPercent}%</CBadge>
              </div>
            </CCardHeader>
            <CCardBody>
              {task.description && (
                <p className="mb-2">
                  <LinkifiedText text={task.description} />
                </p>
              )}
              {(task.task_checklist_items || []).length === 0 ? (
                <p className="text-medium-emphasis mb-0">Esta tarea no tiene checklist.</p>
              ) : (
                <>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={async (event) => {
                      // Defensa en profundidad: aunque los items ya van
                      // deshabilitados para el alumno, reorderChecklistItems
                      // es la escritura de admin y no debe alcanzarse nunca.
                      if (!canReorder) return
                      const { active, over } = event
                      if (!over || active.id === over.id) return
                      const oldIndex = sortedItems.findIndex((i) => i.id === active.id)
                      const newIndex = sortedItems.findIndex((i) => i.id === over.id)
                      const reordered = arrayMove(sortedItems, oldIndex, newIndex)
                      const ok = await api.reorderChecklistItems(reordered)
                      if (!ok) {
                        // Sin estado optimista: los items se releen del
                        // estado del curso, que no cambio, asi que la lista
                        // vuelve sola a su orden real.
                        setCourse((prev) => ({ ...prev }))
                      }
                    }}
                  >
                    <SortableContext
                      items={sortedItems.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {sortedItems.map((item) => {
                        const checked = myProgressRows.some((row) => row.item_id === item.id)
                        return (
                          <StudentSortableChecklistItem
                            key={item.id}
                            item={item}
                            checked={checked}
                            disabled={!canReorder}
                            onChange={async (next) => {
                              // Estado optimista: refleja el clic al instante.
                              const apply = (checked) =>
                                setMyProgressRows((rows) =>
                                  checked
                                    ? rows.some((r) => r.item_id === item.id)
                                      ? rows
                                      : [...rows, { item_id: item.id, student_id: student.id }]
                                    : rows.filter(
                                        (row) =>
                                          !(
                                            row.item_id === item.id && row.student_id === student.id
                                          ),
                                      ),
                                )

                              apply(next)
                              const ok = await api.toggleProgressItem(item.id, student.id, next)
                              // Se revierte al valor ANTERIOR, que es !next.
                              // Antes invertia las ramas y dejaba la UI
                              // espejada respecto a la base de datos.
                              if (!ok) apply(!next)
                            }}
                          />
                        )
                      })}
                    </SortableContext>
                  </DndContext>
                  <div className="d-flex align-items-center gap-2 mt-3">
                    <CProgress value={taskPercent} height={6} className="flex-grow-1" />
                    <small className="text-medium-emphasis">
                      {taskDone}/{taskTotal}
                    </small>
                  </div>
                </>
              )}
              {taskForm && (
                <div className="d-flex justify-content-end align-items-center gap-2 mt-3 border-top pt-2">
                  {formOverdue ? (
                    <CBadge color="danger">Formulario vencido</CBadge>
                  ) : (
                    <CBadge color={formSubmitted ? 'success' : 'warning text-dark'}>
                      {formSubmitted ? 'Formulario enviado' : 'Formulario pendiente'}
                    </CBadge>
                  )}
                  <CButton
                    size="sm"
                    color={formSubmitted ? 'secondary' : 'primary'}
                    variant={formSubmitted ? 'outline' : 'solid'}
                    as={Link}
                    to={`/courses/${courseId}/forms/${taskForm.id}`}
                  >
                    {formSubmitted ? 'Ver mis respuestas' : 'Responder formulario'}
                  </CButton>
                </div>
              )}
            </CCardBody>
          </CCard>
        )
      })
    )}
  </>
)

export default CourseDetailStudent
