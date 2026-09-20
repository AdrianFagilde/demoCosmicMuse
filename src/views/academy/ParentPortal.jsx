import React, { useEffect, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CProgress,
  CRow,
  CSpinner,
  CBadge,
  CFormSelect,
} from '@coreui/react'
import {
  cilUser,
  cilCalendar,
  cilClock,
  cilChartPie,
  cilFire,
  cilBadge,
  cilStar,
} from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useAuth } from '../../context/AuthContext'
import supabase from '../../lib/supabase'

const ParentPortal = () => {
  const { user, profile } = useAuth()
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Student data
  const [studentProfile, setStudentProfile] = useState(null)
  const [studentPractice, setStudentPractice] = useState({
    sessions: [],
    streak: { current_streak: 0, longest_streak: 0 },
    gamification: {
      xp: 0,
      level: 1,
      total_practice_minutes: 0,
      tasks_completed: 0,
      courses_completed: 0,
    },
    badges: [],
    nextBadges: [],
  })
  const [studentTasks, setStudentTasks] = useState([])
  const [studentCourses, setStudentCourses] = useState([])
  const [studentLessons, setStudentLessons] = useState([])
  const [studentPayments, setStudentPayments] = useState([])

  const fetchLinkedStudents = useCallback(async () => {
    if (!user?.id) return
    try {
      // Get students linked to this parent/guardian
      // This assumes a relationship table or field linking guardians to students
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, full_name, instrument, level, progress, attendance, avatar_url, guardian_name, guardian_phone',
        )
        .or(`guardian_name.eq.${profile?.full_name},guardian_phone.eq.${profile?.phone}`)

      if (error) throw error
      setStudents(data || [])
      if (data?.length > 0 && !selectedStudentId) {
        setSelectedStudentId(data[0].id)
      }
    } catch (err) {
      console.error('[ParentPortal] Fetch students error:', err)
      setError(err.message)
    }
  }, [user, profile, selectedStudentId])

  const fetchStudentData = useCallback(async (studentId) => {
    if (!studentId) return
    setLoading(true)
    try {
      // Fetch all student data in parallel
      const [
        { data: profileData, error: profileError },
        { data: practiceData, error: practiceError },
        { data: tasksData, error: tasksError },
        { data: coursesData, error: coursesError },
        { data: lessonsData, error: lessonsError },
        { data: paymentsData, error: paymentsError },
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', studentId).single(),
        supabase.rpc('get_user_practice_summary', { p_student_id: studentId }),
        supabase
          .from('tasks')
          .select('*')
          .eq('student_id', studentId)
          .order('due_date', { ascending: false }),
        supabase.from('course_enrollments').select('*, courses(*)').eq('student_id', studentId),
        supabase
          .from('lessons')
          .select('*')
          .eq('student_id', studentId)
          .order('lesson_date', { ascending: false })
          .limit(10),
        supabase
          .from('payments')
          .select('*')
          .eq('student_id', studentId)
          .order('payment_date', { ascending: false })
          .limit(10),
      ])

      if (profileError) throw profileError
      if (practiceError) console.error('[ParentPortal] Practice error:', practiceError)
      if (tasksError) console.error('[ParentPortal] Tasks error:', tasksError)
      if (coursesError) console.error('[ParentPortal] Courses error:', coursesError)
      if (lessonsError) console.error('[ParentPortal] Lessons error:', lessonsError)
      if (paymentsError) console.error('[ParentPortal] Payments error:', paymentsError)

      setStudentProfile(profileData)
      setStudentPractice(practiceData || {})
      setStudentTasks(tasksData || [])
      setStudentCourses(coursesData || [])
      setStudentLessons(lessonsData || [])
      setStudentPayments(paymentsData || [])
    } catch (err) {
      console.error('[ParentPortal] Fetch student data error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLinkedStudents()
  }, [fetchLinkedStudents])

  useEffect(() => {
    if (selectedStudentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchStudentData(selectedStudentId)
    }
  }, [selectedStudentId, fetchStudentData])

  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}min`
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (error) {
    return (
      <CCard className="border-danger">
        <CCardBody className="text-danger">{error}</CCardBody>
      </CCard>
    )
  }

  if (students.length === 0) {
    return (
      <CCard>
        <CCardBody className="text-center py-5">
          <CIcon icon={cilUser} size="xl" className="text-medium-emphasis mb-3" />
          <h4>No hay estudiantes vinculados</h4>
          <p className="text-medium-emphasis">
            No se encontraron estudiantes asociados a tu cuenta de tutor. Contacta con la academia
            para configurar el acceso.
          </p>
        </CCardBody>
      </CCard>
    )
  }

  const student = studentProfile

  return (
    <>
      {/* Student Selector */}
      <CRow className="mb-4">
        <CCol md={6}>
          <CCard>
            <CCardHeader>Seleccionar estudiante</CCardHeader>
            <CCardBody>
              <CFormSelect
                value={selectedStudentId || ''}
                onChange={(e) => setSelectedStudentId(e.target.value || null)}
                className="w-100"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.instrument})
                  </option>
                ))}
              </CFormSelect>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {student && (
        <>
          {/* Student Header */}
          <CRow className="mb-4">
            <CCol md={3} className="mb-3">
              <CCard className="h-100 text-center">
                <CCardBody className="py-4">
                  <div className="mb-3">
                    {student.avatar_url ? (
                      <img
                        src={student.avatar_url}
                        alt={student.full_name}
                        className="rounded-circle"
                        style={{ width: '80px', height: '80px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div
                        className="rounded-circle bg-primary text-white d-inline-flex align-items-center justify-content-center"
                        style={{
                          width: '80px',
                          height: '80px',
                          fontSize: '2rem',
                          fontWeight: 'bold',
                        }}
                      >
                        {student.full_name
                          ?.split(' ')
                          .map((w) => w[0])
                          .join('')}
                      </div>
                    )}
                  </div>
                  <h4 className="mb-1">{student.full_name}</h4>
                  <div className="text-medium-emphasis small mb-1">{student.instrument}</div>
                  <div className="text-medium-emphasis small">{student.level}</div>
                  <div className="mt-2">
                    <CBadge color="primary">Progreso: {student.progress}%</CBadge>
                    <CBadge color="info" className="ms-1">
                      Asistencia: {student.attendance}%
                    </CBadge>
                  </div>
                </CCardBody>
              </CCard>
            </CCol>
            <CCol md={9} className="mb-3">
              <CRow>
                <CCol md={3} className="mb-3">
                  <CCard className="h-100 text-center">
                    <CCardBody className="py-4">
                      <CIcon icon={cilFire} size="xl" className="text-danger mb-2" />
                      <div className="fs-2 fw-bold text-danger">
                        {student.practice_streak?.current_streak || 0}
                      </div>
                      <div className="text-medium-emphasis small">Días de racha</div>
                      <div className="mt-1 small">
                        <CBadge color="info">
                          Mejor: {student.practice_streak?.longest_streak || 0}
                        </CBadge>
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={3} className="mb-3">
                  <CCard className="h-100 text-center">
                    <CCardBody className="py-4">
                      <CIcon icon={cilClock} size="xl" className="text-primary mb-2" />
                      <div className="fs-2 fw-bold text-primary">
                        {formatTime(student.gamification?.total_practice_minutes || 0)}
                      </div>
                      <div className="text-medium-emphasis small">Práctica total</div>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={3} className="mb-3">
                  <CCard className="h-100 text-center">
                    <CCardBody className="py-4">
                      <CIcon icon={cilAward} size="xl" className="text-warning mb-2" />
                      <div className="fs-2 fw-bold text-warning">
                        Nivel {student.gamification?.level || 1}
                      </div>
                      <div className="text-medium-emphasis small">
                        {student.gamification?.xp || 0} XP
                      </div>
                    </CCardBody>
                  </CCard>
                </CCol>
                <CCol md={3} className="mb-3">
                  <CCard className="h-100 text-center">
                    <CCardBody className="py-4">
                      <CIcon icon={cilAward} size="xl" className="text-success mb-2" />
                      <div className="fs-2 fw-bold text-success">{student.badges?.length || 0}</div>
                      <div className="text-medium-emphasis small">Logros desbloqueados</div>
                    </CCardBody>
                  </CCard>
                </CCol>
              </CRow>
            </CCol>
          </CRow>

          {/* Tabs */}
          <CRow className="mb-4">
            <CCol>
              <CCard>
                <CCardHeader className="d-flex flex-wrap gap-2">
                  <h5 className="mb-0 flex-grow-1">Tareas recientes</h5>
                </CCardHeader>
                <CCardBody className="p-0">
                  {studentTasks.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead>
                          <tr>
                            <th>Título</th>
                            <th>Estado</th>
                            <th>Progreso</th>
                            <th>Fecha entrega</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentTasks.slice(0, 10).map((task) => (
                            <tr key={task.id}>
                              <td className="fw-semibold">{task.title}</td>
                              <td>
                                <CBadge
                                  color={
                                    task.status === 'Completado'
                                      ? 'success'
                                      : task.status === 'En progreso'
                                        ? 'info'
                                        : 'warning'
                                  }
                                >
                                  {task.status}
                                </CBadge>
                              </td>
                              <td>
                                <CProgress
                                  value={task.progress || 0}
                                  height={6}
                                  className="w-50"
                                  color="info"
                                />
                              </td>
                              <td>{formatDate(task.due_date)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center text-medium-emphasis py-4">
                      No hay tareas registradas
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <CRow className="mb-4">
            <CCol lg={6} className="mb-3">
              <CCard className="h-100">
                <CCardHeader>Próximas clases</CCardHeader>
                <CCardBody className="p-0">
                  {studentLessons.length > 0 ? (
                    <div className="list-group list-group-flush">
                      {studentLessons.slice(0, 5).map((lesson) => (
                        <div key={lesson.id} className="list-group-item px-3 py-2">
                          <div className="fw-semibold">{lesson.instrument}</div>
                          <div className="text-medium-emphasis small">
                            {formatDate(lesson.lesson_date)} • {lesson.lesson_time} •{' '}
                            {lesson.duration}
                          </div>
                          <div className="text-medium-emphasis small">
                            Profesor: {lesson.teacher}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-medium-emphasis py-4">
                      No hay clases programadas
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
            <CCol lg={6} className="mb-3">
              <CCard className="h-100">
                <CCardHeader>Cursos inscritos</CCardHeader>
                <CCardBody className="p-0">
                  {studentCourses.length > 0 ? (
                    <div className="list-group list-group-flush">
                      {studentCourses.map((enrollment) => {
                        const course = enrollment.courses
                        return (
                          <div key={enrollment.id} className="list-group-item px-3 py-2">
                            <div className="fw-semibold">{course?.title}</div>
                            <div className="text-medium-emphasis small">
                              {course?.instrument} • {course?.level}
                            </div>
                            <CProgress
                              value={course?.progress || 0}
                              height={6}
                              className="mt-2"
                              color="info"
                            />
                            <div className="text-end mt-1">
                              <small className="text-medium-emphasis">
                                {course?.progress || 0}% completado
                              </small>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-medium-emphasis py-4">
                      No hay cursos inscritos
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          <CRow className="mb-4">
            <CCol>
              <CCard>
                <CCardHeader>Historial de pagos</CCardHeader>
                <CCardBody className="p-0">
                  {studentPayments.length > 0 ? (
                    <div className="table-responsive">
                      <table className="table table-hover mb-0">
                        <thead>
                          <tr>
                            <th>Fecha</th>
                            <th>Monto</th>
                            <th>Método</th>
                            <th>Frecuencia</th>
                            <th>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {studentPayments.map((payment) => (
                            <tr key={payment.id}>
                              <td>{formatDate(payment.payment_date)}</td>
                              <td className="fw-semibold">${Number(payment.amount).toFixed(2)}</td>
                              <td>{payment.method}</td>
                              <td>{payment.frequency}</td>
                              <td>
                                <CBadge color="success">Pagado</CBadge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center text-medium-emphasis py-4">
                      No hay pagos registrados
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>

          {/* Badges */}
          <CRow className="mb-4">
            <CCol>
              <CCard>
                <CCardHeader className="d-flex justify-content-between align-items-center">
                  <span className="fw-semibold d-flex align-items-center gap-2">
                    <CIcon icon={cilStar} className="text-warning" />
                    Logros desbloqueados
                  </span>
                  <CBadge color="primary">{student.badges?.length || 0}</CBadge>
                </CCardHeader>
                <CCardBody>
                  {student.badges?.length > 0 ? (
                    <div className="d-flex flex-wrap gap-2">
                      {student.badges.map((badge) => (
                        <CBadge
                          key={badge.badge_key}
                          color="warning"
                          className="fs-6 px-3 py-2 d-flex align-items-center gap-1"
                        >
                          <CIcon icon={cilStar} size="sm" />
                          {badge.badge_key}
                        </CBadge>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-medium-emphasis py-4">
                      <CIcon icon={cilStar} size="xl" className="mb-2" />
                      <p>No hay logros desbloqueados aún</p>
                    </div>
                  )}
                </CCardBody>
              </CCard>
            </CCol>
          </CRow>
        </>
      )}
    </>
  )
}

export default ParentPortal
