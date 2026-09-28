import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormText,
  CFormTextarea,
  CInputGroup,
  CInputGroupText,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CProgress,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilCalendar, cilPencil, cilPlus } from '@coreui/icons'
import useCourseEnrollments from '../../hooks/useCourseEnrollments'
import { SortableFormRow, SortableTaskRow } from '../../components/CourseSortableRows'
import CourseEnrollmentManager from './CourseEnrollmentManager'
import FormEditorModal from '../../components/FormEditorModal'
import FormResponsesModal from '../../components/FormResponsesModal'
import MaterialList from '../../components/MaterialList'
import TaskEditorModal from '../../components/TaskEditorModal'
import { INSTRUMENT_OPTIONS, LEVEL_OPTIONS } from '../../utils/students'
import { FILE_ACCEPT, validateCourseFile } from '../../utils/forms'
import { computeStats } from '../../utils/courses'

/**
 * Vista de administracion de un curso: meta, inscripcion, tareas, materiales,
 * cuestionarios y progreso.
 *
 * Solo renderiza; la carga del curso y los hooks de Supabase viven en
 * CourseDetail.jsx. Recibe `api` con las mutaciones ya enlazadas y `course` /
 * `setCourse` para el estado optimista de los reordenamientos.
 */
const CourseDetailAdmin = ({
  course,
  setCourse,
  reload,
  api,
  actor,
  students,
  progressRows,
  sensors,
  reloadToken,
}) => {
  const [showEditMeta, setShowEditMeta] = useState(false)
  const [metaForm, setMetaForm] = useState(null)
  const [metaError, setMetaError] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [formEditorTarget, setFormEditorTarget] = useState(null) // { form|null, taskId|null, taskTitle }
  const [responsesForm, setResponsesForm] = useState(null)
  const [materialDraft, setMaterialDraft] = useState({
    type: 'text',
    title: '',
    body: '',
    url: '',
    file: null,
  })
  const [materialError, setMaterialError] = useState('')
  const [addingMaterial, setAddingMaterial] = useState(false)

  const {
    search,
    setSearch,
    filteredStudents,
    isChecked,
    toggle,
    save: saveEnrollments,
    saving,
  } = useCourseEnrollments({
    course,
    students,
    saveEnrollments: api.saveEnrollments,
    actorId: actor.id,
    onSaved: reload,
    reloadToken,
  })

  const allItemIds = useMemo(
    () => course.course_tasks.flatMap((t) => (t.task_checklist_items || []).map((item) => item.id)),
    [course],
  )

  const formsByTask = useMemo(
    () =>
      (course.course_forms || []).reduce((acc, f) => {
        if (f.task_id) acc[f.task_id] = f
        return acc
      }, {}),
    [course],
  )

  const handleDragEndTasks = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = course.course_tasks.findIndex((t) => t.id === active.id)
    const newIndex = course.course_tasks.findIndex((t) => t.id === over.id)
    const reordered = arrayMove(course.course_tasks, oldIndex, newIndex)
    setCourse({ ...course, course_tasks: reordered })
    const ok = await api.reorderTasks(reordered.map((t) => t.id))
    if (!ok) await reload()
  }

  const handleAddTask = async () => {
    const title = newTaskTitle.trim()
    if (!title) return
    setAddingTask(true)
    const created = await api.addTask(course, {
      title,
      dueDate: newTaskDueDate || null,
      createdBy: actor.id,
    })
    setAddingTask(false)
    if (created) {
      setNewTaskTitle('')
      setNewTaskDueDate('')
      await reload()
    }
  }

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('¿Eliminar esta tarea, su checklist y su cuestionario asociado?')) {
      const ok = await api.deleteTask(taskId)
      if (ok) await reload()
    }
  }

  const handleDeleteForm = async (formId) => {
    if (!window.confirm('¿Eliminar este cuestionario y todas sus respuestas?')) return
    const ok = await api.deleteForm(formId)
    if (ok) await reload()
  }

  const handleDragEndForms = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = course.course_forms.findIndex((f) => f.id === active.id)
    const newIndex = course.course_forms.findIndex((f) => f.id === over.id)
    const reordered = arrayMove(course.course_forms, oldIndex, newIndex)
    setCourse({ ...course, course_forms: reordered })
    const ok = await api.reorderForms(reordered.map((f) => f.id))
    if (!ok) await reload()
  }

  const handleAddMaterial = async () => {
    const title = materialDraft.title.trim()
    if (!title) {
      setMaterialError('El material necesita un título.')
      return
    }
    if (materialDraft.type === 'link' && !materialDraft.url.trim()) {
      setMaterialError('Ingresa la URL del enlace.')
      return
    }
    if (materialDraft.type === 'file' && !materialDraft.file) {
      setMaterialError('Selecciona un archivo para subir.')
      return
    }
    if (materialDraft.type === 'file') {
      const fileError = validateCourseFile(materialDraft.file)
      if (fileError) {
        setMaterialError(fileError)
        return
      }
    }
    setAddingMaterial(true)
    const created = await api.addMaterial(course, { ...materialDraft, title }, actor.id)
    setAddingMaterial(false)
    if (!created) {
      setMaterialError('No se pudo guardar el material.')
      return
    }
    setMaterialDraft({ type: materialDraft.type, title: '', body: '', url: '', file: null })
    setMaterialError('')
    await reload()
  }

  const handleDeleteMaterial = async (material) => {
    if (!window.confirm(`¿Eliminar el material "${material.title}"?`)) return
    const ok = await api.deleteMaterial(material)
    if (ok) await reload()
  }

  const handleReorderMaterials = async (orderedMaterials) => {
    setCourse({ ...course, course_materials: orderedMaterials })
    const ok = await api.reorderMaterials(orderedMaterials.map((m) => m.id))
    if (!ok) await reload()
  }

  return (
    <>
      <CButton as={Link} to="/courses" color="secondary" variant="outline" className="mb-3">
        <CIcon icon={cilArrowLeft} className="me-1" aria-hidden="true" /> Volver a cursos
      </CButton>

      <CCard className="app-card mb-4">
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <span className="fw-bold">{course.title}</span>
          <CButton
            size="sm"
            color="primary"
            variant="outline"
            onClick={() => {
              setMetaForm({
                title: course.title,
                description: course.description || '',
                instrument: course.instrument || '',
                level: course.level || '',
              })
              setMetaError('')
              setShowEditMeta(true)
            }}
          >
            <CIcon icon={cilPencil} className="me-1" aria-hidden="true" /> Editar curso
          </CButton>
        </CCardHeader>
        <CCardBody>
          {course.description && <p className="mb-2">{course.description}</p>}
          {(course.instrument || course.level) && (
            <div className="d-flex gap-2 mb-1">
              {course.instrument && <CBadge color="primary">{course.instrument}</CBadge>}
              {course.level && <CBadge color="dark">{course.level}</CBadge>}
            </div>
          )}
        </CCardBody>
      </CCard>

      <CourseEnrollmentManager
        search={search}
        onSearchChange={setSearch}
        students={filteredStudents}
        isChecked={isChecked}
        onToggle={toggle}
        onSave={saveEnrollments}
        saving={saving}
      />

      {/* Tareas */}
      <CCard className="app-card mb-4">
        <CCardHeader>Tareas del curso (arrastra para ordenar)</CCardHeader>
        <CCardBody>
          {course.course_tasks.length === 0 ? (
            <p className="text-medium-emphasis">Aún no hay tareas. Añade la primera abajo.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEndTasks}
            >
              <SortableContext
                items={course.course_tasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                {course.course_tasks.map((task) => (
                  <SortableTaskRow
                    key={task.id}
                    task={task}
                    attachedForm={formsByTask[task.id]}
                    onEdit={setEditingTask}
                    onAddForm={() =>
                      setFormEditorTarget({ form: null, taskId: task.id, taskTitle: task.title })
                    }
                    onEditForm={() =>
                      setFormEditorTarget({
                        form: formsByTask[task.id],
                        taskId: task.id,
                        taskTitle: task.title,
                      })
                    }
                    onViewFormResponses={() => setResponsesForm(formsByTask[task.id])}
                    onDelete={handleDeleteTask}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}
          <CInputGroup className="mt-3 task-input-group">
            <CFormInput
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTask()
                }
              }}
              placeholder="Título de la nueva tarea..."
              aria-label="Título de la nueva tarea"
            />
            <CInputGroupText>
              <CIcon icon={cilCalendar} size="sm" aria-hidden="true" />
            </CInputGroupText>
            <CFormInput
              className="task-due-date"
              type="date"
              value={newTaskDueDate}
              onChange={(e) => setNewTaskDueDate(e.target.value)}
              aria-label="Fecha de entrega (opcional)"
            />
            <CButton
              type="button"
              color="primary"
              onClick={handleAddTask}
              disabled={addingTask}
              aria-label="Añadir la tarea"
            >
              {addingTask ? <CSpinner size="sm" /> : <CIcon icon={cilPlus} aria-hidden="true" />}
            </CButton>
          </CInputGroup>
        </CCardBody>
      </CCard>

      {/* Contenido del curso */}
      <CCard className="app-card mb-4">
        <CCardHeader>Contenido del curso (materiales para estudiantes)</CCardHeader>
        <CCardBody>
          {(course.course_materials || []).length === 0 ? (
            <p className="text-medium-emphasis">
              Aún no hay materiales. Agrega texto, enlaces o archivos abajo.
            </p>
          ) : (
            <MaterialList
              materials={course.course_materials}
              onDelete={handleDeleteMaterial}
              onReorder={handleReorderMaterials}
            />
          )}
          <hr />
          <CFormLabel className="fw-semibold">Agregar material</CFormLabel>
          <CRow className="g-2 mb-2">
            <CCol md={4}>
              <CFormSelect
                value={materialDraft.type}
                onChange={(e) => setMaterialDraft({ ...materialDraft, type: e.target.value })}
              >
                <option value="text">Texto</option>
                <option value="link">Enlace / video</option>
                <option value="file">Archivo</option>
              </CFormSelect>
            </CCol>
            <CCol md={8}>
              <CFormInput
                placeholder="Título del material..."
                value={materialDraft.title}
                onChange={(e) => setMaterialDraft({ ...materialDraft, title: e.target.value })}
              />
            </CCol>
          </CRow>
          {materialDraft.type === 'text' && (
            <CFormTextarea
              className="mb-2"
              rows={3}
              placeholder="Contenido de texto para tus estudiantes..."
              value={materialDraft.body}
              onChange={(e) => setMaterialDraft({ ...materialDraft, body: e.target.value })}
            />
          )}
          {materialDraft.type === 'link' && (
            <CFormInput
              className="mb-2"
              type="url"
              placeholder="https://youtube.com/watch?v=..."
              value={materialDraft.url}
              onChange={(e) => setMaterialDraft({ ...materialDraft, url: e.target.value })}
            />
          )}
          {materialDraft.type === 'file' && (
            <>
              <CFormInput
                className="mb-1"
                type="file"
                accept={FILE_ACCEPT}
                onChange={(e) =>
                  setMaterialDraft({ ...materialDraft, file: e.target.files?.[0] || null })
                }
              />
              <CFormText className="mb-2 d-block">
                Se subirá al almacenamiento privado del curso (máx. 10&nbsp;MB).
              </CFormText>
            </>
          )}
          {materialError && <div className="text-danger small mb-2">{materialError}</div>}
          <CButton color="primary" onClick={handleAddMaterial} disabled={addingMaterial}>
            {addingMaterial ? <CSpinner size="sm" /> : 'Agregar material'}
          </CButton>
        </CCardBody>
      </CCard>

      {/* Cuestionarios */}
      <CCard className="app-card mb-4">
        <CCardHeader>
          Cuestionarios del curso (arrastra para ordenar · los generales sin tarea)
        </CCardHeader>
        <CCardBody>
          {(course.course_forms || []).length === 0 ? (
            <p className="text-medium-emphasis">Aún no hay cuestionarios en este curso.</p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEndForms}
            >
              <SortableContext
                items={course.course_forms.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {course.course_forms.map((form) => {
                  const taskLabel = form.task_id
                    ? course.course_tasks.find((t) => t.id === form.task_id)?.title
                    : null
                  return (
                    <SortableFormRow
                      key={form.id}
                      form={form}
                      taskLabel={taskLabel}
                      onEdit={() =>
                        setFormEditorTarget({
                          form,
                          taskId: form.task_id,
                          taskTitle: taskLabel || '',
                        })
                      }
                      onViewResponses={() => setResponsesForm(form)}
                      onDelete={() => handleDeleteForm(form.id)}
                    />
                  )
                })}
              </SortableContext>
            </DndContext>
          )}
          <CButton
            color="primary"
            variant="outline"
            className="mt-3"
            onClick={() => setFormEditorTarget({ form: null, taskId: null, taskTitle: '' })}
          >
            <CIcon icon={cilPlus} className="me-1" aria-hidden="true" /> Nuevo cuestionario general
          </CButton>
        </CCardBody>
      </CCard>

      {/* Progreso por estudiante */}
      <CCard className="app-card mb-4">
        <CCardHeader>Progreso del curso</CCardHeader>
        <CCardBody>
          {course.enrolled_profiles.length === 0 ? (
            <p className="text-medium-emphasis mb-0">
              Inscribe estudiantes para ver su progreso aquí.
            </p>
          ) : (
            <CTable small align="middle" responsive>
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Estudiante</CTableHeaderCell>
                  <CTableHeaderCell>Avance</CTableHeaderCell>
                  <CTableHeaderCell>Ítems completados</CTableHeaderCell>
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {course.enrolled_profiles.map((studentProfile) => {
                  const stats = computeStats(course.course_tasks, progressRows, studentProfile.id)
                  return (
                    <CTableRow key={studentProfile.id}>
                      <CTableDataCell>{studentProfile.full_name}</CTableDataCell>
                      <CTableDataCell style={{ minWidth: 160 }}>
                        <CProgress value={stats.percent} height={8} />
                      </CTableDataCell>
                      <CTableDataCell>
                        {stats.doneItems}/{stats.totalItems} ({stats.percent}%)
                      </CTableDataCell>
                    </CTableRow>
                  )
                })}
              </CTableBody>
            </CTable>
          )}
          {allItemIds.length === 0 && (
            <p className="text-medium-emphasis mb-0 mt-2">
              Añade checklist a tus tareas para medir el progreso.
            </p>
          )}
        </CCardBody>
      </CCard>

      {/* Modal meta curso */}
      {metaForm && (
        <CModal
          visible={showEditMeta}
          onClose={() => setShowEditMeta(false)}
          backdrop="static"
          scrollable
        >
          <CForm
            onSubmit={async (event) => {
              event.preventDefault()
              if (!metaForm.title.trim()) {
                setMetaError('El título es obligatorio.')
                return
              }
              const ok = await api.updateCourse(course.id, {
                title: metaForm.title.trim(),
                description: metaForm.description.trim(),
                instrument: metaForm.instrument || null,
                level: metaForm.level || null,
              })
              if (ok) {
                setShowEditMeta(false)
                await reload()
              } else {
                setMetaError('No se pudo actualizar el curso.')
              }
            }}
          >
            <CModalHeader closeButton>
              <CModalTitle>Editar curso</CModalTitle>
            </CModalHeader>
            <CModalBody style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="mb-3">
                <CFormLabel>Título *</CFormLabel>
                <CFormInput
                  value={metaForm.title}
                  onChange={(e) => setMetaForm({ ...metaForm, title: e.target.value })}
                />
              </div>
              <div className="mb-3">
                <CFormLabel>Descripción</CFormLabel>
                <CFormTextarea
                  rows={3}
                  value={metaForm.description}
                  onChange={(e) => setMetaForm({ ...metaForm, description: e.target.value })}
                />
              </div>
              <div className="mb-3">
                <CFormLabel>Instrumento</CFormLabel>
                <CFormSelect
                  value={metaForm.instrument}
                  onChange={(e) => setMetaForm({ ...metaForm, instrument: e.target.value })}
                >
                  <option value="">Sin instrumento</option>
                  {INSTRUMENT_OPTIONS.map((instrument) => (
                    <option key={instrument} value={instrument}>
                      {instrument}
                    </option>
                  ))}
                </CFormSelect>
              </div>
              <div className="mb-1">
                <CFormLabel>Nivel</CFormLabel>
                <CFormSelect
                  value={metaForm.level}
                  onChange={(e) => setMetaForm({ ...metaForm, level: e.target.value })}
                >
                  <option value="">Sin nivel</option>
                  {LEVEL_OPTIONS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </CFormSelect>
              </div>
              {metaError && <div className="text-danger mt-3">{metaError}</div>}
            </CModalBody>
            <CModalFooter>
              <CButton color="secondary" variant="outline" onClick={() => setShowEditMeta(false)}>
                Cancelar
              </CButton>
              <CButton type="submit" color="primary">
                Guardar cambios
              </CButton>
            </CModalFooter>
          </CForm>
        </CModal>
      )}

      {/* Modal editor de tarea */}
      {editingTask && (
        <TaskEditorModal
          key={editingTask.id}
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onUpdateTask={api.updateTask}
          onAddItem={api.addChecklistItem}
          onDeleteItem={api.deleteChecklistItem}
          onReorderItems={api.reorderChecklistItems}
          onSaved={reload}
        />
      )}

      {/* Modal editor de cuestionario */}
      {formEditorTarget && (
        <FormEditorModal
          course={course}
          form={formEditorTarget.form}
          actorId={actor.id}
          taskId={formEditorTarget.taskId}
          taskTitle={formEditorTarget.taskTitle}
          onClose={() => setFormEditorTarget(null)}
          onSaved={reload}
        />
      )}

      {/* Modal de respuestas del cuestionario */}
      {responsesForm && (
        <FormResponsesModal
          key={responsesForm.id}
          course={course}
          form={{
            ...responsesForm,
            form_questions: responsesForm.form_questions || [],
          }}
          onClose={() => setResponsesForm(null)}
        />
      )}
    </>
  )
}

export default CourseDetailAdmin
