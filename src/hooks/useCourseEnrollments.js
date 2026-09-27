import { useCallback, useMemo, useState } from 'react'

// Constante a nivel de modulo, no un literal `{}` en el useState: un objeto
// nuevo en cada render haria que `overrides` cambiase de identidad en cada
// render y con ella `isChecked`, que es dependencia de useCallback. Es el mismo
// motivo por el que useSupabaseQuery declara DEFAULT_EMPTY_VALUE fuera del hook.
const EMPTY_OVERRIDES = {}

/**
 * Estado del gestor de inscripcion de un curso.
 *
 * Vive aparte de CourseDetailAdmin porque es la unica parte con estado propio
 * que no se mezcla con el de los formularios de tarea, material o
 * cuestionario: una busqueda por nombre no deberia poder coexistir con un
 * borrador de material a medio rellenar en el mismo useState.
 *
 * `overrides` guarda solo lo que el admin ha tocado en esta sesion. Si se
 * guardara el estado completo habria que reescribir el objeto entero en cada
 * clic y la lista dejaria de reflejar lo que hay en la base de datos.
 */
const useCourseEnrollments = ({
  course,
  students,
  saveEnrollments,
  actorId,
  onSaved,
  reloadToken,
}) => {
  // Los overrides se descartan en el render, no en un efecto: cuando el shell
  // recarga el curso (reloadToken cambia) lo que hay guardado corresponde a la
  // version anterior de `course.course_enrollments`. Hacerlo con un
  // useEffect(setState) provocaria un segundo render en cascada y React lo
  // marca como error. Guardar el token junto al valor hace que la comparacion
  // sea gratis y el estado viejo se haga inalcanzable en el mismo render.
  const [overrideState, setOverrideState] = useState(() => ({
    token: reloadToken,
    value: EMPTY_OVERRIDES,
  }))
  const overrides = overrideState.token === reloadToken ? overrideState.value : EMPTY_OVERRIDES

  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const setOverrides = useCallback(
    (updater) => {
      setOverrideState((prev) => ({
        token: reloadToken,
        value: updater(prev.token === reloadToken ? prev.value : EMPTY_OVERRIDES),
      }))
    },
    [reloadToken],
  )

  const isEnrolledByDefault = useCallback(
    (studentId) => (course?.course_enrollments || []).some((e) => e.student_id === studentId),
    [course],
  )

  const isChecked = useCallback(
    (studentId) => (studentId in overrides ? overrides[studentId] : isEnrolledByDefault(studentId)),
    [overrides, isEnrolledByDefault],
  )

  const toggle = useCallback(
    (studentId, checked) => {
      setOverrides((prev) => ({ ...prev, [studentId]: checked }))
    },
    [setOverrides],
  )

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return students
    return students.filter((student) => String(student.full_name).toLowerCase().includes(term))
  }, [students, search])

  const save = useCallback(async () => {
    setSaving(true)
    const nextIds = students.filter((student) => isChecked(student.id)).map((s) => s.id)
    const ok = await saveEnrollments(course, nextIds, actorId)
    setSaving(false)
    if (ok) {
      setOverrides(() => EMPTY_OVERRIDES)
      await onSaved()
    }
    return ok
  }, [students, isChecked, saveEnrollments, course, actorId, onSaved, setOverrides])

  return {
    search,
    setSearch,
    filteredStudents,
    isChecked,
    toggle,
    save,
    saving,
  }
}

export default useCourseEnrollments
