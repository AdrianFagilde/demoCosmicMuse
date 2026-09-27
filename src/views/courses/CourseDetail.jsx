import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CButton, CCard, CCardBody, CSpinner } from '@coreui/react'
import { KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import CIcon from '@coreui/icons-react'
import { cilArrowLeft } from '@coreui/icons'
import { useAuth } from '../../context/AuthContext'
import useSupabaseCourses from '../../hooks/useSupabaseCourses'
import useSupabaseForms from '../../hooks/useSupabaseForms'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import CourseDetailAdmin from './CourseDetailAdmin'
import CourseDetailStudent from './CourseDetailStudent'
import { computeStats } from '../../utils/courses'

/**
 * Shell del detalle de curso.
 *
 * Solo carga: el curso, el progreso segun rol y los estados de
 * carga/error. El render de cada rol vive en CourseDetailAdmin y
 * CourseDetailStudent. Antes esto eran 983 lineas con las dos ramas en el mismo
 * componente, lo que obligaba a mantener en un solo useState el estado del
 * formulario de material, el de tarea en edicion y el del checklist del alumno.
 *
 * Los hooks de Supabase se instancian aqui y no en las ramas, a proposito:
 * useSupabaseCourses tiene estado propio, y montarlo en los dos sitios lo
 * duplicaria (con su correspondiente doble fetch).
 */
const CourseDetail = () => {
  const { id } = useParams()
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const courses = useSupabaseCourses()
  const { deleteForm: deleteFormApi, reorderForms, fetchMySubmissions } = useSupabaseForms()
  const { students } = useSupabaseStudents()

  const [course, setCourse] = useState(null)
  const [detailLoading, setDetailLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [progressRows, setProgressRows] = useState([])
  const [myProgressRows, setMyProgressRows] = useState([])
  const [mySubmissions, setMySubmissions] = useState({})
  // El estado de la tarjeta de inscripcion vive en CourseDetailAdmin, asi que el
  // shell no puede limpiarlo directamente. En vez de remontar el componente
  // (que perderia el tipo de material que el admin eligio), se incrementa este
  // contador en cada recarga y el hook lo usa como senal de reseteo.
  const [reloadToken, setReloadToken] = useState(0)

  const loadSeqRef = useRef(0)

  const loadDetail = async () => {
    const seq = ++loadSeqRef.current
    setDetailLoading(true)
    const { detail, error: detailError } = await courses.fetchCourseDetail(id)
    if (seq !== loadSeqRef.current) return
    if (!detail) {
      setLoadError(
        detailError?.message
          ? `No se pudo cargar el curso: ${detailError.message}`
          : 'No se pudo cargar el curso o no tienes acceso.',
      )
    } else {
      setLoadError(null)
      setCourse(detail)
      setReloadToken((n) => n + 1)
      if (isAdmin) {
        const itemIds = detail.course_tasks.flatMap((t) =>
          (t.task_checklist_items || []).map((item) => item.id),
        )
        const progress = await courses.fetchCourseProgress(itemIds)
        if (seq !== loadSeqRef.current) return
        setProgressRows(progress)
      } else if (user?.id) {
        const formIds = (detail.course_forms || []).map((f) => f.id)
        const [progress, submissions] = await Promise.all([
          courses.fetchStudentCourseProgress(user.id),
          fetchMySubmissions(user.id, formIds),
        ])
        if (seq !== loadSeqRef.current) return
        setMyProgressRows(progress)
        setMySubmissions(submissions)
      }
    }
    setDetailLoading(false)
  }

  useEffect(() => {
    ;(async () => {
      await loadDetail()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAdmin, user?.id])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const myStats = useMemo(
    () => computeStats(course?.course_tasks || [], myProgressRows),
    [course, myProgressRows],
  )

  const api = useMemo(
    () => ({
      addTask: courses.addTask,
      updateTask: courses.updateTask,
      deleteTask: courses.deleteTask,
      reorderTasks: courses.reorderTasks,
      updateCourse: courses.updateCourse,
      saveEnrollments: courses.saveEnrollments,
      addChecklistItem: courses.addChecklistItem,
      deleteChecklistItem: courses.deleteChecklistItem,
      reorderChecklistItems: courses.reorderChecklistItems,
      addMaterial: courses.addMaterial,
      deleteMaterial: courses.deleteMaterial,
      reorderMaterials: courses.reorderMaterials,
      deleteForm: deleteFormApi,
      reorderForms,
      toggleProgressItem: courses.toggleProgressItem,
    }),
    [courses, deleteFormApi, reorderForms],
  )

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
        <CCard className="app-card app-card-bordered app-card-danger">
          <CCardBody className="text-danger">{loadError}</CCardBody>
        </CCard>
      </>
    )
  }

  if (isAdmin) {
    return (
      <CourseDetailAdmin
        course={course}
        setCourse={setCourse}
        reload={loadDetail}
        api={api}
        actor={profile}
        students={students}
        progressRows={progressRows}
        sensors={sensors}
        reloadToken={reloadToken}
      />
    )
  }

  return (
    <CourseDetailStudent
      course={course}
      courseId={id}
      student={user}
      canReorder={isAdmin}
      sensors={sensors}
      myStats={myStats}
      myProgressRows={myProgressRows}
      setMyProgressRows={setMyProgressRows}
      mySubmissions={mySubmissions}
      api={api}
      setCourse={setCourse}
    />
  )
}

export default CourseDetail
