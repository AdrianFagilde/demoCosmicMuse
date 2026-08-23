import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardFooter,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
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
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus, cilTrash } from '@coreui/icons'
import { useAuth } from '../../context/AuthContext'
import useSupabaseCourses from '../../hooks/useSupabaseCourses'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import { INSTRUMENT_OPTIONS, LEVEL_OPTIONS } from '../../utils/students'

const emptyForm = {
  title: '',
  description: '',
  instrument: '',
  level: '',
}

const Courses = () => {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { courses, loading, error, createCourse, deleteCourse, fetchStudentCourseProgress } =
    useSupabaseCourses()
  const { students } = useSupabaseStudents()
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [myProgressRows, setMyProgressRows] = useState([])

  useEffect(() => {
    if (isAdmin || !user?.id) return
    let cancelled = false
    ;(async () => {
      const rows = await fetchStudentCourseProgress(user.id)
      if (!cancelled) setMyProgressRows(rows)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, user?.id])

  const courseStats = useMemo(() => {
    const map = {}
    courses.forEach((course) => {
      map[course.id] = {
        tasks: (course.course_tasks || []).length,
        students: (course.course_enrollments || []).length,
      }
    })
    return map
  }, [courses])

  const handleOpenCreate = () => {
    setForm(emptyForm)
    setFormError('')
    setShowCreate(true)
  }

  const handleSaveCreate = async (event) => {
    event.preventDefault()
    if (!form.title.trim()) {
      setFormError('El título del curso es obligatorio.')
      return
    }
    setSaving(true)
    const created = await createCourse({
      title: form.title.trim(),
      description: form.description.trim(),
      instrument: form.instrument || null,
      level: form.level || null,
      createdBy: profile.id,
    })
    setSaving(false)
    if (!created) {
      setFormError('No se pudo crear el curso. Intenta de nuevo.')
      return
    }
    setShowCreate(false)
  }

  const handleDelete = async (courseId) => {
    if (window.confirm('¿Eliminar el curso? Se borrarán sus tareas, checklists e inscripciones.')) {
      await deleteCourse(courseId)
    }
  }

  return (
    <>
      <CRow className="mb-4">
        <CCol>
          <CCard>
            <CCardHeader>Cursos</CCardHeader>
            <CCardBody>
              <p>
                {isAdmin
                  ? 'Crea cursos, arma sus tareas con checklist y controla el progreso de cada estudiante.'
                  : 'Estos son los cursos en los que estás inscrito. Entra para ver tus tareas y marcar tu avance.'}
              </p>
              {isAdmin && (
                <CButton color="primary" onClick={handleOpenCreate}>
                  <CIcon icon={cilPlus} className="me-1" />
                  Nuevo curso
                </CButton>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {error && (
        <CRow className="mb-4">
          <CCol>
            <CCard className="border-danger">
              <CCardBody className="text-danger">
                No se pudieron cargar los cursos: {error.message}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      )}

      <CRow>
        <CCol xs={12}>
          {loading ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
            </div>
          ) : isAdmin ? (
            courses.length === 0 ? (
              <CCard>
                <CCardBody className="text-center text-medium-emphasis">
                  Todavía no hay cursos. Crea el primero con el botón "Nuevo curso".
                </CCardBody>
              </CCard>
            ) : (
              courses.map((course) => (
                <CCard key={course.id} className="mb-3">
                  <CCardHeader className="d-flex justify-content-between align-items-center">
                    <span className="fw-semibold">{course.title}</span>
                    <span>
                      <CBadge color="info" className="me-2">
                        {courseStats[course.id]?.tasks ?? 0} tareas
                      </CBadge>
                      <CBadge color="secondary">
                        {courseStats[course.id]?.students ?? 0} estudiantes
                      </CBadge>
                    </span>
                  </CCardHeader>
                  <CCardBody>
                    {course.description && <p className="mb-2">{course.description}</p>}
                    {(course.instrument || course.level) && (
                      <div className="mb-0 d-flex gap-2">
                        {course.instrument && <CBadge color="primary">{course.instrument}</CBadge>}
                        {course.level && <CBadge color="dark">{course.level}</CBadge>}
                      </div>
                    )}
                  </CCardBody>
                  <CCardFooter className="d-flex gap-2">
                    <CButton as={Link} to={`/courses/${course.id}`} size="sm" color="primary">
                      Abrir curso
                    </CButton>
                    <CButton
                      size="sm"
                      color="danger"
                      variant="outline"
                      onClick={() => handleDelete(course.id)}
                    >
                      <CIcon icon={cilTrash} />
                    </CButton>
                  </CCardFooter>
                </CCard>
              ))
            )
          ) : courses.length === 0 ? (
            <CCard>
              <CCardBody className="text-center text-medium-emphasis">
                No estás inscrito en ningún curso todavía. Cuando tu profesor te inscriba, lo verás
                aquí.
              </CCardBody>
            </CCard>
          ) : (
            courses.map((course) => {
              const items =
                (course.course_tasks || []).flatMap((t) => t.task_checklist_items || []) || []
              const totalItems = items.length
              const doneItems = myProgressRows.filter((row) =>
                items.some((item) => item.id === row.item_id),
              ).length
              const percent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0
              return (
                <CCard key={course.id} className="mb-3">
                  <CCardHeader className="d-flex justify-content-between align-items-center">
                    <span className="fw-semibold">{course.title}</span>
                    <CBadge color={percent >= 100 ? 'success' : 'info'}>{percent}%</CBadge>
                  </CCardHeader>
                  <CCardBody>
                    {course.description && <p className="mb-2">{course.description}</p>}
                    <CProgress value={percent} height={8} />
                  </CCardBody>
                  <CCardFooter>
                    <CButton as={Link} to={`/courses/${course.id}`} size="sm" color="primary">
                      Ver tareas
                    </CButton>
                  </CCardFooter>
                </CCard>
              )
            })
          )}
        </CCol>
      </CRow>

      <CModal visible={showCreate} onClose={() => setShowCreate(false)} backdrop="static">
        <CForm onSubmit={handleSaveCreate}>
          <CModalHeader closeButton>
            <CModalTitle>Nuevo curso</CModalTitle>
          </CModalHeader>
          <CModalBody>
            <div className="mb-3">
              <CFormLabel>Título *</CFormLabel>
              <CFormInput
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ej: Fundamentos de piano"
              />
            </div>
            <div className="mb-3">
              <CFormLabel>Descripción</CFormLabel>
              <CFormTextarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="De qué trata el curso..."
              />
            </div>
            <div className="mb-3">
              <CFormLabel>Instrumento</CFormLabel>
              <CFormSelect
                value={form.instrument}
                onChange={(e) => setForm({ ...form, instrument: e.target.value })}
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
                value={form.level}
                onChange={(e) => setForm({ ...form, level: e.target.value })}
              >
                <option value="">Sin nivel</option>
                {LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </CFormSelect>
            </div>
            {formError && <div className="text-danger mt-3">{formError}</div>}
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </CButton>
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? <CSpinner size="sm" /> : 'Crear curso'}
            </CButton>
          </CModalFooter>
        </CForm>
      </CModal>
    </>
  )
}

export default Courses
