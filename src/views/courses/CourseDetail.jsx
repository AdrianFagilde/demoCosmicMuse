import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormText,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CProgressBar,
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
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft, cilMenu, cilPencil, cilPlus, cilTrash } from '@coreui/icons'
import { useAuth } from '../../context/AuthContext'
import useSupabaseCourses from '../../hooks/useSupabaseCourses'
import useSupabaseForms from '../../hooks/useSupabaseForms'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import ChecklistBuilder from '../../components/ChecklistBuilder'
import FormEditorModal from '../../components/FormEditorModal'
import FormResponsesModal from '../../components/FormResponsesModal'
import MaterialList from '../../components/MaterialList'
import { INSTRUMENT_OPTIONS, LEVEL_OPTIONS } from '../../utils/students'

const computeStats = (tasks, progressRows = [], studentId = null) => {
  const items = tasks.flatMap((task) => task.task_checklist_items || [])
  const relevant =
    studentId === null ? progressRows : progressRows.filter((row) => row.student_id === studentId)
  const doneIds = new Set(relevant.map((row) => row.item_id))
  const done = items.filter((item) => doneIds.has(item.id)).length
  return {
    totalItems: items.length,
    doneItems: done,
    percent: items.length > 0 ? Math.round((done / items.length) * 100) : 0,
    doneByTask: Object.fromEntries(
      tasks.map((task) => [
        task.id,
        (task.task_checklist_items || []).filter((item) => doneIds.has(item.id)).length,
      ]),
    ),
  }
}

const SortableTaskRow = ({ task, onEdit, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <CCard ref={setNodeRef} style={style} className="mb-2">
      <CCardBody className="d-flex align-items-center gap-3 py-2">
        <span
          {...attributes}
          {...listeners}
          className="text-medium-emphasis"
          style={{ cursor: 'grab', touchAction: 'none' }}
        >
          <CIcon icon={cilMenu} />
        </span>
        <div className="flex-grow-1">
          <div className="fw-semibold">{task.title}</div>
          {task.description && <small className="text-medium-emphasis">{task.description}</small>}
        </div>
        <CBadge color="info">{(task.task_checklist_items || []).length} checks</CBadge>
        {task.due_date && <CBadge color="warning text-dark">Entrega: {task.due_date}</CBadge>}
        <CButton size="sm" color="primary" variant="outline" onClick={() => onEdit(task)}>
          <CIcon icon={cilPencil} />
        </CButton>
        <CButton size="sm" color="danger" variant="outline" onClick={() => onDelete(task.id)}>
          <CIcon icon={cilTrash} />
        </CButton>
      </CCardBody>
    </CCard>
  )
}

const SortableFormRow = ({ form, onEdit, onViewResponses, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: form.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }
  return (
    <CCard ref={setNodeRef} style={style} className="mb-2">
      <CCardBody className="d-flex align-items-center gap-3 py-2">
        <span
          {...attributes}
          {...listeners}
          className="text-medium-emphasis"
          style={{ cursor: 'grab', touchAction: 'none' }}
        >
          <CIcon icon={cilMenu} />
        </span>
        <div className="flex-grow-1">
          <div className="fw-semibold">{form.title}</div>
          {form.description && <small className="text-medium-emphasis">{form.description}</small>}
        </div>
        <CBadge color="info">{(form.form_questions || []).length} preguntas</CBadge>
        {form.due_date && <CBadge color="warning text-dark">Límite: {form.due_date}</CBadge>}
        <CButton size="sm" color="primary" variant="outline" onClick={onViewResponses}>
          Respuestas
        </CButton>
        <CButton size="sm" color="primary" variant="outline" onClick={onEdit}>
          <CIcon icon={cilPencil} />
        </CButton>
        <CButton size="sm" color="danger" variant="outline" onClick={onDelete}>
          <CIcon icon={cilTrash} />
        </CButton>
      </CCardBody>
    </CCard>
  )
}

const CourseDetail = () => {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const {
    fetchCourseDetail,
    updateCourse,
    saveEnrollments,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
    deleteChecklistItem,
    addChecklistItem,
    reorderChecklistItems,
    fetchCourseProgress,
    toggleProgressItem,
    fetchStudentCourseProgress,
    addMaterial,
    deleteMaterial,
    reorderMaterials,
  } = useSupabaseCourses()
  const { deleteForm: deleteFormApi, reorderForms, fetchMySubmissions } = useSupabaseForms()
  const { students } = useSupabaseStudents()

  const [course, setCourse] = useState(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  // Admin state
  const [progressRows, setProgressRows] = useState([])
  const [enrollmentOverrides, setEnrollmentOverrides] = useState({})
  const [enrollmentSearch, setEnrollmentSearch] = useState('')
  const [savingEnrollments, setSavingEnrollments] = useState(false)
  const [showEditMeta, setShowEditMeta] = useState(false)
  const [metaForm, setMetaForm] = useState(null)
  const [metaError, setMetaError] = useState('')
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [addingTask, setAddingTask] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [formEditorTarget, setFormEditorTarget] = useState(null) // null | 'new' | form
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

  // Student state
  const [myProgressRows, setMyProgressRows] = useState([])
  const [mySubmissions, setMySubmissions] = useState({})

  const loadDetail = async () => {
    setDetailLoading(true)
    const detail = await fetchCourseDetail(id)
    if (!detail) {
      setLoadError('No se pudo cargar el curso o no tienes acceso.')
    } else {
      setLoadError(null)
      setCourse(detail)
      setEnrollmentOverrides({})
      if (isAdmin) {
        const itemIds = detail.course_tasks.flatMap((t) =>
          (t.task_checklist_items || []).map((item) => item.id),
        )
        setProgressRows(await fetchCourseProgress(itemIds))
      }
    }
    setDetailLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      await loadDetail()
    })()
    if (!isAdmin && user?.id) {
      ;(async () => {
        setMyProgressRows(await fetchStudentCourseProgress(user.id))
        const formIds = (detail.course_forms || []).map((f) => f.id)
        setMySubmissions(await fetchMySubmissions(user.id, formIds))
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAdmin, user?.id])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const isEnrolledByDefault = (studentId) =>
    (course?.course_enrollments || []).some((e) => e.student_id === studentId)

  const isCheckedForEnrollment = (studentId) =>
    studentId in enrollmentOverrides
      ? enrollmentOverrides[studentId]
      : isEnrolledByDefault(studentId)

  const myStats = useMemo(
    () => computeStats(course?.course_tasks || [], myProgressRows),
    [course, myProgressRows],
  )

  const filteredStudents = useMemo(() => {
    const term = enrollmentSearch.trim().toLowerCase()
    if (!term) return students
    return students.filter((student) => String(student.full_name).toLowerCase().includes(term))
  }, [students, enrollmentSearch])

  if (detailLoading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (loadError || !course) {
    return (
      <>
        <CButton as={Link} to="/courses" color="secondary" variant="outline" className="mb-3">
          <CIcon icon={cilArrowLeft} className="me-1" /> Volver a cursos
        </CButton>
        <CCard className="border-danger">
          <CCardBody className="text-danger">{loadError}</CCardBody>
        </CCard>
      </>
    )
  }

  /* ================= ADMIN ================= */
  if (isAdmin) {
    const allItemIds = course.course_tasks.flatMap((t) =>
      (t.task_checklist_items || []).map((item) => item.id),
    )

    const handleDragEndTasks = async (event) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = course.course_tasks.findIndex((t) => t.id === active.id)
      const newIndex = course.course_tasks.findIndex((t) => t.id === over.id)
      const reordered = arrayMove(course.course_tasks, oldIndex, newIndex)
      setCourse({ ...course, course_tasks: reordered })
      await reorderTasks(reordered.map((t) => t.id))
    }

    const handleAddTask = async () => {
      const title = newTaskTitle.trim()
      if (!title) return
      setAddingTask(true)
      const created = await addTask(course, { title, createdBy: profile.id })
      setAddingTask(false)
      if (created) {
        setNewTaskTitle('')
        await loadDetail()
      }
    }

    const handleDeleteTask = async (taskId) => {
      if (window.confirm('¿Eliminar esta tarea y su checklist?')) {
        const ok = await deleteTask(taskId)
        if (ok) await loadDetail()
      }
    }

    const handleSaveEnrollments = async () => {
      setSavingEnrollments(true)
      const nextIds = students
        .filter((student) => isCheckedForEnrollment(student.id))
        .map((s) => s.id)
      const ok = await saveEnrollments(course, nextIds, profile.id)
      setSavingEnrollments(false)
      if (ok) {
        setEnrollmentOverrides({})
        await loadDetail()
      }
    }

    const handleDeleteForm = async (formId) => {
      if (!window.confirm('¿Eliminar este cuestionario y todas sus respuestas?')) return
      const ok = await deleteFormApi(formId)
      if (ok) await loadDetail()
    }

    const handleDragEndForms = async (event) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = course.course_forms.findIndex((f) => f.id === active.id)
      const newIndex = course.course_forms.findIndex((f) => f.id === over.id)
      const reordered = arrayMove(course.course_forms, oldIndex, newIndex)
      setCourse({ ...course, course_forms: reordered })
      await reorderForms(reordered.map((f) => f.id))
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
      setAddingMaterial(true)
      const created = await addMaterial(course, { ...materialDraft, title }, profile.id)
      setAddingMaterial(false)
      if (!created) {
        setMaterialError('No se pudo guardar el material.')
        return
      }
      setMaterialDraft({ type: materialDraft.type, title: '', body: '', url: '', file: null })
      setMaterialError('')
      await loadDetail()
    }

    const handleDeleteMaterial = async (material) => {
      if (!window.confirm(`¿Eliminar el material "${material.title}"?`)) return
      const ok = await deleteMaterial(material)
      if (ok) await loadDetail()
    }

    const handleReorderMaterials = async (orderedMaterials) => {
      setCourse({ ...course, course_materials: orderedMaterials })
      await reorderMaterials(orderedMaterials.map((m) => m.id))
    }

    return (
      <>
        <CButton as={Link} to="/courses" color="secondary" variant="outline" className="mb-3">
          <CIcon icon={cilArrowLeft} className="me-1" /> Volver a cursos
        </CButton>

        <CCard className="mb-4">
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
              <CIcon icon={cilPencil} className="me-1" /> Editar curso
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

        {/* Inscripción */}
        <CCard className="mb-4">
          <CCardHeader>Inscripción de estudiantes</CCardHeader>
          <CCardBody>
            <CFormInput
              placeholder="Buscar estudiante..."
              value={enrollmentSearch}
              onChange={(e) => setEnrollmentSearch(e.target.value)}
              className="mb-3"
            />
            {filteredStudents.length === 0 ? (
              <p className="text-medium-emphasis mb-0">Sin resultados.</p>
            ) : (
              <CRow xs={{ cols: 'auto' }} className="g-2 mb-3">
                {filteredStudents.map((student) => (
                  <CCol key={student.id}>
                    <CFormCheck
                      id={`enroll-${student.id}`}
                      label={student.full_name}
                      checked={isCheckedForEnrollment(student.id)}
                      onChange={(e) =>
                        setEnrollmentOverrides({
                          ...enrollmentOverrides,
                          [student.id]: e.target.checked,
                        })
                      }
                    />
                  </CCol>
                ))}
              </CRow>
            )}
            <CButton color="primary" onClick={handleSaveEnrollments} disabled={savingEnrollments}>
              {savingEnrollments ? <CSpinner size="sm" /> : 'Guardar inscripción'}
            </CButton>
          </CCardBody>
        </CCard>

        {/* Tareas */}
        <CCard className="mb-4">
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
                      onEdit={setEditingTask}
                      onDelete={handleDeleteTask}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
            <CInputGroup className="mt-3">
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
              />
              <CButton type="button" color="primary" onClick={handleAddTask} disabled={addingTask}>
                {addingTask ? <CSpinner size="sm" /> : <CIcon icon={cilPlus} />}
              </CButton>
            </CInputGroup>
          </CCardBody>
        </CCard>

        {/* Contenido del curso */}
        <CCard className="mb-4">
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
        <CCard className="mb-4">
          <CCardHeader>Cuestionarios (arrastra para ordenar)</CCardHeader>
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
                  {course.course_forms.map((form) => (
                    <SortableFormRow
                      key={form.id}
                      form={form}
                      onEdit={() => setFormEditorTarget(form)}
                      onViewResponses={() => setResponsesForm(form)}
                      onDelete={() => handleDeleteForm(form.id)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
            <CButton
              color="primary"
              variant="outline"
              className="mt-3"
              onClick={() => setFormEditorTarget('new')}
            >
              <CIcon icon={cilPlus} className="me-1" /> Nuevo cuestionario
            </CButton>
          </CCardBody>
        </CCard>

        {/* Progreso por estudiante */}
        <CCard className="mb-4">
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
        <CModal visible={showEditMeta} onClose={() => setShowEditMeta(false)} backdrop="static">
          <CForm
            onSubmit={async (event) => {
              event.preventDefault()
              if (!metaForm.title.trim()) {
                setMetaError('El título es obligatorio.')
                return
              }
              const ok = await updateCourse(course.id, {
                title: metaForm.title.trim(),
                description: metaForm.description.trim(),
                instrument: metaForm.instrument || null,
                level: metaForm.level || null,
              })
              if (ok) {
                setShowEditMeta(false)
                await loadDetail()
              } else {
                setMetaError('No se pudo actualizar el curso.')
              }
            }}
          >
            <CModalHeader closeButton>
              <CModalTitle>Editar curso</CModalTitle>
            </CModalHeader>
            <CModalBody>
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

        {/* Modal editor de tarea */}
        {editingTask && (
          <TaskEditorModal
            key={editingTask.id}
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onUpdateTask={updateTask}
            onAddItem={addChecklistItem}
            onDeleteItem={deleteChecklistItem}
            onReorderItems={reorderChecklistItems}
            onSaved={loadDetail}
          />
        )}

        {/* Modal editor de cuestionario */}
        {formEditorTarget && (
          <FormEditorModal
            course={course}
            form={formEditorTarget === 'new' ? null : formEditorTarget}
            actorId={profile.id}
            onClose={() => setFormEditorTarget(null)}
            onSaved={loadDetail}
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

  /* ================= ESTUDIANTE ================= */
  return (
    <>
      <CButton as={Link} to="/courses" color="secondary" variant="outline" className="mb-3">
        <CIcon icon={cilArrowLeft} className="me-1" /> Volver a cursos
      </CButton>

      <CCard className="mb-4">
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
        <CCard className="mb-4">
          <CCardHeader>Contenido del curso</CCardHeader>
          <CCardBody>
            <MaterialList materials={course.course_materials} readOnly />
          </CCardBody>
        </CCard>
      )}

      {(course.course_forms || []).length > 0 && (
        <CCard className="mb-4">
          <CCardHeader>Cuestionarios</CCardHeader>
          <CCardBody>
            {course.course_forms.map((form) => {
              const submitted = Boolean(mySubmissions[form.id])
              const overdue = form.due_date && !submitted && new Date(form.due_date) < new Date()
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
                      to={`/courses/${id}/forms/${form.id}`}
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
        <CCard>
          <CCardBody className="text-center text-medium-emphasis">
            Tu profesor todavía no ha publicado tareas en este curso.
          </CCardBody>
        </CCard>
      ) : (
        course.course_tasks.map((task) => {
          const taskDone = myStats.doneByTask[task.id] || 0
          const taskTotal = (task.task_checklist_items || []).length
          const taskPercent = taskTotal > 0 ? Math.round((taskDone / taskTotal) * 100) : 0
          return (
            <CCard key={task.id} className="mb-3">
              <CCardHeader className="d-flex justify-content-between align-items-center">
                <span className="fw-semibold">{task.title}</span>
                {task.due_date && (
                  <CBadge color="warning text-dark">Entrega: {task.due_date}</CBadge>
                )}
              </CCardHeader>
              <CCardBody>
                {task.description && <p className="mb-2">{task.description}</p>}
                {(task.task_checklist_items || []).length === 0 ? (
                  <p className="text-medium-emphasis mb-0">Esta tarea no tiene checklist.</p>
                ) : (
                  <>
                    {(task.task_checklist_items || []).map((item) => {
                      const checked = myProgressRows.some((row) => row.item_id === item.id)
                      return (
                        <CFormCheck
                          key={item.id}
                          id={`check-${item.id}`}
                          label={item.label}
                          checked={checked}
                          onChange={async (event) => {
                            const next = event.target.checked
                            setMyProgressRows((rows) =>
                              next
                                ? [...rows, { item_id: item.id, student_id: user.id }]
                                : rows.filter(
                                    (row) =>
                                      !(row.item_id === item.id && row.student_id === user.id),
                                  ),
                            )
                            const ok = await toggleProgressItem(item.id, user.id, next)
                            if (!ok) {
                              setMyProgressRows((rows) =>
                                !next
                                  ? [...rows, { item_id: item.id, student_id: user.id }]
                                  : rows.filter((row) => row.item_id !== item.id),
                              )
                            }
                          }}
                        />
                      )
                    })}
                    <div className="d-flex align-items-center gap-2 mt-3">
                      <CProgress value={taskPercent} height={6} className="flex-grow-1" />
                      <small className="text-medium-emphasis">
                        {taskDone}/{taskTotal}
                      </small>
                    </div>
                  </>
                )}
              </CCardBody>
            </CCard>
          )
        })
      )}
    </>
  )
}

const TaskEditorModal = ({
  task,
  onClose,
  onUpdateTask,
  onAddItem,
  onDeleteItem,
  onReorderItems,
  onSaved,
}) => {
  const original = useMemo(() => task.task_checklist_items || [], [task])
  const [form, setForm] = useState({
    title: task.title,
    description: task.description || '',
    dueDate: task.due_date || '',
  })
  const [items, setItems] = useState([...original])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('La tarea necesita un título.')
      return
    }
    setSaving(true)
    let ok = await onUpdateTask(task.id, {
      title: form.title.trim(),
      description: form.description.trim(),
      due_date: form.dueDate || null,
    })
    if (!ok) {
      setSaving(false)
      setError('No se pudo guardar la tarea.')
      return
    }
    const currentIds = new Set(original.map((item) => item.id))
    const nextIds = new Set(items.map((item) => item.id))

    for (const removed of original.filter((item) => !nextIds.has(item.id))) {
      ok = (await onDeleteItem(removed.id)) && ok
    }
    for (const added of items.filter((item) => !currentIds.has(item.id))) {
      const position = items.indexOf(added)
      const created = await onAddItem(task.id, added.label, position)
      if (!created) ok = false
    }
    const reorderedExisting = items.filter((item) => currentIds.has(item.id))
    const orderChanged = reorderedExisting.some((item, index) => item.position !== index)
    if (orderChanged) {
      ok = (await onReorderItems(items)) && ok
    }
    setSaving(false)
    if (!ok) {
      setError('Hubo un problema guardando algunos cambios. Revisa y vuelve a intentar.')
      return
    }
    onClose()
    await onSaved()
  }

  return (
    <CModal visible onClose={onClose} backdrop="static" size="lg">
      <CForm
        onSubmit={(event) => {
          event.preventDefault()
          handleSave()
        }}
      >
        <CModalHeader closeButton>
          <CModalTitle>Editar tarea</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="mb-3">
            <CFormLabel>Título *</CFormLabel>
            <CFormInput
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <CFormLabel>Descripción</CFormLabel>
            <CFormTextarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <CFormLabel>Fecha de entrega (opcional)</CFormLabel>
            <CFormInput
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
          <hr />
          <CFormLabel className="fw-semibold">Checklist (arrastra para ordenar)</CFormLabel>
          <ChecklistBuilder items={items} onChange={setItems} />
          {error && <div className="text-danger mt-3">{error}</div>}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose}>
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={saving}>
            {saving ? <CSpinner size="sm" /> : 'Guardar tarea'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

export default CourseDetail
