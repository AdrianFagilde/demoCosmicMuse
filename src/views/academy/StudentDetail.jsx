import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  CAvatar,
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CRow,
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
import useSupabaseCourses from '../../hooks/useSupabaseCourses'
import useSupabaseGamification from '../../hooks/useSupabaseGamification'
import supabase from '../../lib/supabase'
import { formatInstrument } from '../../utils/students'
import RestrictedAccess from '../../components/RestrictedAccess'
import LinkifiedText from '../../components/LinkifiedText'
import EmptyState from '../../components/EmptyState'
import Skeleton, { TableSkeleton } from '../../components/Skeleton'
import XPLevelCard from '../../components/dashboard/XPLevelCard'
import BadgesGallery from '../../components/dashboard/BadgesGallery'

const StudentDetail = () => {
  const { id } = useParams()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { getStudent, updateStudentMetrics, loading: studentsLoading } = useSupabaseStudents()
  const { tasks, addTask, changeTaskStatus, loading: tasksLoading } = useSupabaseTasks()
  const { courses } = useSupabaseCourses()
  const gamification = useSupabaseGamification(id)

  const student = getStudent(id)

  // Las tareas de curso no tienen student_id (el CHECK
  // assignments_context_xor obliga a que sea NULL cuando hay course_id),
  // asi que el filtro por student_id las dejaba fuera y el admin veia una
  // lista incompleta sin avisar. Las de este alumno son las suyas mas las
  // de los cursos en los que esta matriculado.
  const studentCourseIds = new Set(
    courses
      .filter((c) => (c.course_enrollments || []).some((e) => String(e.student_id) === String(id)))
      .map((c) => c.id),
  )
  const studentTasks = tasks.filter(
    (t) => String(t.student_id) === String(id) || studentCourseIds.has(t.course_id),
  )

  const [localProgress, setLocalProgress] = useState(student?.progress || 0)
  const [localAttendance, setLocalAttendance] = useState(student?.attendance || 0)
  const [syncedId, setSyncedId] = useState(null)
  const [savingMetrics, setSavingMetrics] = useState(false)
  const [quickTaskLoading, setQuickTaskLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  const [goalMinutes, setGoalMinutes] = useState(30)
  const [savingGoal, setSavingGoal] = useState(false)
  const [goalError, setGoalError] = useState('')
  const [goalSaved, setGoalSaved] = useState(false)

  useEffect(() => {
    if (student && syncedId !== student.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSyncedId(student.id)
      setLocalProgress(student.progress || 0)
      setLocalAttendance(student.attendance || 0)
    }
  }, [student, syncedId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoalMinutes(gamification.dailyGoalMinutes || 30)
  }, [gamification.dailyGoalMinutes])

  const clamp = (v) => Math.min(100, Math.max(0, Math.round(Number(v) || 0)))

  if (!isAdmin) {
    return (
      <RestrictedAccess message="Sólo los administradores pueden ver y editar perfiles de estudiantes." />
    )
  }

  if (studentsLoading) {
    return (
      <div className="d-flex flex-column gap-3">
        <Skeleton height="9rem" rounded="md" />
        <Skeleton height="14rem" rounded="md" />
      </div>
    )
  }

  if (!student) {
    return (
      <CCard className="app-card mb-4">
        <CCardBody>
          <h4>Estudiante no encontrado</h4>
          <p>El estudiante solicitado no existe.</p>
        </CCardBody>
      </CCard>
    )
  }

  const handleSaveMetrics = async () => {
    setSavingMetrics(true)
    setMetricsError('')
    const progress = clamp(localProgress)
    const attendance = clamp(localAttendance)
    const ok = await updateStudentMetrics(id, progress, attendance)
    setSavingMetrics(false)
    if (!ok) {
      setMetricsError('No se pudo guardar. Intenta de nuevo.')
    } else {
      setLocalProgress(progress)
      setLocalAttendance(attendance)
    }
  }

  const handleAddQuickTask = async () => {
    setQuickTaskLoading(true)
    const ok = await addTask({
      title: 'Nueva tarea rápida',
      studentId: id,
      assignedBy: profile.id,
      dueDate: new Date().toISOString().slice(0, 10),
    })
    setQuickTaskLoading(false)
    if (!ok) setMetricsError('No se pudo crear la tarea rápida.')
  }

  const clampGoal = (v) => Math.min(240, Math.max(5, Math.round(Number(v) || 0)))

  const handleSaveGoal = async () => {
    setSavingGoal(true)
    setGoalError('')
    setGoalSaved(false)
    const minutes = clampGoal(goalMinutes)
    const { error } = await supabase.rpc('set_daily_goal', {
      p_student_id: id,
      p_minutes: minutes,
    })
    setSavingGoal(false)
    if (error) {
      setGoalError('No se pudo guardar la meta. Intenta de nuevo.')
      return
    }
    setGoalMinutes(minutes)
    setGoalSaved(true)
    await gamification.refetch()
  }

  return (
    <>
      <CRow className="mb-4">
        <CCol md={4} className="mb-3">
          <CCard className="app-card">
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
                  <div className="text-medium-emphasis">{formatInstrument(student.instrument)}</div>
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
                  {metricsError && (
                    <CAlert color="danger" className="mb-2">
                      {metricsError}
                    </CAlert>
                  )}
                  <div className="mb-2">
                    <label className="form-label">Ajustar progreso</label>
                    <CFormInput
                      type="number"
                      min={0}
                      max={100}
                      value={localProgress}
                      onChange={(e) => setLocalProgress(clamp(e.target.value))}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Ajustar asistencia</label>
                    <CFormInput
                      type="number"
                      min={0}
                      max={100}
                      value={localAttendance}
                      onChange={(e) => setLocalAttendance(clamp(e.target.value))}
                    />
                  </div>
                  <div className="text-end">
                    <CButton color="primary" onClick={handleSaveMetrics} disabled={savingMetrics}>
                      {savingMetrics ? 'Guardando...' : 'Guardar métricas'}
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
          <CCard className="app-card">
            <CCardHeader>Tareas de {student.full_name}</CCardHeader>
            <CCardBody>
              <div className="mb-3">
                <CButton
                  color="primary"
                  size="sm"
                  onClick={handleAddQuickTask}
                  disabled={quickTaskLoading}
                >
                  {quickTaskLoading ? 'Añadiendo...' : 'Añadir tarea rápida'}
                </CButton>
              </div>
              {tasksLoading ? (
                <TableSkeleton rows={4} columns={5} />
              ) : (
                <CTable hover responsive>
                  <CTableHead>
                    <CTableRow>
                      <CTableHeaderCell>Título</CTableHeaderCell>
                      <CTableHeaderCell>Origen</CTableHeaderCell>
                      <CTableHeaderCell>Entrega</CTableHeaderCell>
                      <CTableHeaderCell>Estado</CTableHeaderCell>
                      <CTableHeaderCell>Acciones</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {studentTasks.map((t) => (
                      <CTableRow key={t.id}>
                        <CTableDataCell>
                          <LinkifiedText text={t.title} />
                        </CTableDataCell>
                        <CTableDataCell>
                          {t.course_id ? t.course?.title || 'Curso' : 'Individual'}
                        </CTableDataCell>
                        <CTableDataCell>{t.due_date || '-'}</CTableDataCell>
                        <CTableDataCell>
                          {t.course_id ? (
                            <span className="text-medium-emphasis">
                              {t.checklist_total
                                ? `${t.checklist_completed}/${t.checklist_total} completados`
                                : 'Sin checklist'}
                            </span>
                          ) : (
                            t.status || 'Pendiente'
                          )}
                        </CTableDataCell>
                        <CTableDataCell>
                          {/* En una tarea de curso el avance no lo marca
                                status (que no pertenece al modelo) sino el
                                checklist compartido, y lo escribe el alumno
                                al marcar cada item. Un boton aqui
                                escribiria un status que nadie lee. */}
                          {t.course_id ? null : (
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
                          )}
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                    {studentTasks.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan={5} className="p-0">
                          <EmptyState
                            compact
                            title="Sin tareas"
                            description="Este estudiante no tiene tareas asignadas."
                          />
                        </CTableDataCell>
                      </CTableRow>
                    )}
                  </CTableBody>
                </CTable>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="mb-4">
        <CCol md={6} className="mb-3">
          <XPLevelCard
            xp={gamification.xp}
            totalPracticeMinutes={gamification.totalPracticeMinutes}
            tasksCompleted={gamification.tasksCompleted}
            coursesCompleted={gamification.coursesCompleted}
          />
        </CCol>
        <CCol md={6} className="mb-3">
          <CCard className="app-card h-100">
            <CCardHeader>Meta diaria de práctica</CCardHeader>
            <CCardBody>
              <p className="text-medium-emphasis small">
                Minutos que este alumno debe practicar cada día. Su panel los usa para calcular el
                progreso diario.
              </p>
              {goalError && (
                <CAlert color="danger" className="mb-2">
                  {goalError}
                </CAlert>
              )}
              <CForm>
                <div className="mb-2">
                  <label className="form-label">Minutos por día (5–240)</label>
                  <CFormInput
                    type="number"
                    min={5}
                    max={240}
                    value={goalMinutes}
                    onChange={(e) => {
                      setGoalMinutes(clampGoal(e.target.value))
                      setGoalSaved(false)
                    }}
                  />
                </div>
                <div className="d-flex align-items-center gap-2">
                  <CButton color="primary" onClick={handleSaveGoal} disabled={savingGoal}>
                    {savingGoal ? 'Guardando...' : 'Guardar meta'}
                  </CButton>
                  {goalSaved && <span className="text-success small">Meta actualizada</span>}
                </div>
              </CForm>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="mb-4">
        <CCol md={12} className="mb-3">
          <BadgesGallery badges={gamification.badges} nextBadges={gamification.nextBadges} />
        </CCol>
      </CRow>
    </>
  )
}

export default StudentDetail
