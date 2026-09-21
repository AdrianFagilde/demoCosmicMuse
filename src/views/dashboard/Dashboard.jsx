import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { CCard, CCardBody, CCardHeader, CCol, CRow, CButton } from '@coreui/react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import CIcon from '@coreui/icons-react'
import {
  cilSchool,
  cilPeople,
  cilCalendar,
  cilChart,
  cilFire,
  cilMediaPlay,
  cilMusicNote,
} from '@coreui/icons'

import { useAuth } from '../../context/AuthContext'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import useSupabaseTasks from '../../hooks/useSupabaseTasks'
import useSupabasePractice from '../../hooks/useSupabasePractice'
import useSupabaseCourses from '../../hooks/useSupabaseCourses'
import supabase from '../../lib/supabase'
import KpiCard from '../../components/KpiCard'

// New Duolingo-style components
import JourneyPath from '../../components/dashboard/JourneyPath'
import ActionCard from '../../components/dashboard/ActionCard'
import DailyGoalCard from '../../components/dashboard/DailyGoalCard'
import WeeklyDots from '../../components/dashboard/WeeklyDots'
import { getInstrumentColor } from '../../utils/colors'

// Import compact styles
import '../../components/dashboard/dashboard-styles.css'

const BRAND = {
  purple: '#712771',
  cyan: '#16c1d6',
  magenta: '#b42d75',
  navy: '#161a3c',
}

const COLORS = [BRAND.purple, BRAND.cyan, BRAND.magenta, BRAND.navy, '#9a3f9e', '#5fd6e8']

const formatTimeAgo = (date) => {
  if (!date) return '—'
  const diff = Date.now() - new Date(date).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor(diff / (1000 * 60))

  if (days > 0) return `hace ${days} día${days > 1 ? 's' : ''}`
  if (hours > 0) return `hace ${hours} hora${hours > 1 ? 's' : ''}`
  if (minutes > 0) return `hace ${minutes} min`
  return 'ahora mismo'
}

const getNextLessonCountdown = (nextLesson) => {
  if (!nextLesson) return { text: 'Sin programar', isOverdue: false }
  const now = new Date()
  const lesson = new Date(nextLesson)

  if (isNaN(lesson.getTime())) {
    return { text: 'Fecha inválida', isOverdue: false }
  }

  const diff = lesson - now

  if (diff < 0) return { text: 'Pasada', isOverdue: true }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return { text: `${days}d ${hours}h`, isOverdue: false }
  if (hours > 0) return { text: `${hours}h ${minutes}m`, isOverdue: false }
  return { text: `${minutes}m`, isOverdue: false }
}

import { buildHash } from '../../utils/version'

const Dashboard = () => {
  const { user, profile } = useAuth()
  const isStudent = profile?.role === 'student'
  const { students, getSummary } = useSupabaseStudents()
  const { tasks } = useSupabaseTasks()
  const { courses, fetchStudentCourseProgress } = useSupabaseCourses()
  const practice = useSupabasePractice(user?.id)
  const [summary, setSummary] = useState({
    activeStudents: 0,
    lessonsThisWeek: 0,
    teachers: 0,
    availableInstruments: [],
  })
  const [paymentsByMonth, setPaymentsByMonth] = useState([])
  const [myProgressRows, setMyProgressRows] = useState([])

  const instrumentData = useMemo(() => {
    const counts = {}
    students.forEach((s) => {
      const inst = s.instrument || 'Otro'
      counts[inst] = (counts[inst] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [students])

  const progressData = useMemo(() => {
    const active = students.filter((s) => s.status === 'Activo')
    const total = active.length || 1
    const avg = Math.round(active.reduce((sum, s) => sum + (s.progress || 0), 0) / total)
    return [
      { name: 'General', progreso: avg },
      ...active.slice(0, 6).map((s) => ({
        name: s.full_name?.split(' ')[0] || '?',
        progreso: s.progress || 0,
      })),
    ]
  }, [students])

  const fetchPaymentsByMonth = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('payments')
        .select('amount, payment_date')
        .order('payment_date', { ascending: true })

      if (!data) return

      const monthMap = {}
      data.forEach((p) => {
        const d = new Date(p.payment_date)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
        if (!monthMap[key]) monthMap[key] = { key, label, total: 0 }
        monthMap[key].total += Number(p.amount)
      })

      setPaymentsByMonth(Object.values(monthMap).slice(-6))
    } catch (err) {
      console.error('[Dashboard] fetchPaymentsByMonth error:', err)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const s = await getSummary()
        setSummary(s)
      } catch (err) {
        console.error('[Dashboard] getSummary error:', err)
      }
    })()
  }, [getSummary])

  useEffect(() => {
    if (isStudent) return
    ;(async () => {
      await fetchPaymentsByMonth()
    })()
  }, [isStudent, fetchPaymentsByMonth])

  const recentTasks = tasks
    .filter((task) => (isStudent ? task.student_id === user?.id : true))
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
    .slice(0, 5)

  const studentTasks = tasks.filter((t) => t.student_id === user?.id)
  const pendingTasks = studentTasks.filter((t) => t.status !== 'Completado')
  const completedTasks = studentTasks.filter((t) => t.status === 'Completado')

  const nextLessonCountdown = getNextLessonCountdown(profile?.next_lesson)

  const enrolledCourses = courses.filter((c) =>
    c.course_enrollments?.some((e) => e.student_id === user?.id),
  )

  useEffect(() => {
    if (!isStudent || !user?.id) return
    ;(async () => {
      const progress = await fetchStudentCourseProgress(user.id)
      setMyProgressRows(progress)
    })()
  }, [isStudent, user?.id, fetchStudentCourseProgress])

  const sortTasksByUrgency = (taskList) => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return [...taskList].sort((a, b) => {
      const aDue = a.due_date ? new Date(a.due_date) : null
      const bDue = b.due_date ? new Date(b.due_date) : null
      const aOverdue = aDue && aDue < now
      const bOverdue = bDue && bDue < now
      if (aOverdue && !bOverdue) return -1
      if (!aOverdue && bOverdue) return 1
      if (aDue && bDue) return aDue - bDue
      return 0
    })
  }

  const urgentTasks = sortTasksByUrgency(pendingTasks).slice(0, 4)

  const practiceToday =
    practice.sessions
      ?.filter((s) => {
        if (!s.started_at) return false
        const sessionDate = new Date(s.started_at).toDateString()
        return sessionDate === new Date().toDateString()
      })
      .reduce((sum, s) => sum + (s.duration_minutes || 0), 0) || 0

  const instrumentColor = enrolledCourses[0]
    ? getInstrumentColor(enrolledCourses[0].instrument)
    : '#6366f1'
  const streakDays = practice.streak?.current_streak || 0
  const hasNextLesson =
    Boolean(profile?.next_lesson) && !isNaN(new Date(profile.next_lesson).getTime())

  if (isStudent) {
    return (
      <div className="student-dashboard d-flex flex-column">
        <div data-build-version={buildHash} style={{ display: 'none' }} />

        {/* TOP BAR - Compact greeting + stats */}
        <div className="dash-topbar px-2">
          <div className="dash-greeting">
            ¡Hola, {profile?.full_name?.split(' ')[0] || 'estudiante'}! 👋
          </div>
          <div className="dash-stats-inline">
            <div className="dash-stat-mini">
              <CIcon icon={cilFire} className="icon text-danger" /> <span>{streakDays}</span>
            </div>
          </div>
        </div>

        {/* DAILY GOAL CARD - Hero */}
        <DailyGoalCard
          practiceMinutesToday={practiceToday}
          streak={streakDays}
          onStartPractice={() => practice.startPractice({})}
        />

        {/* MAIN ROW: Journey Path + Urgent Actions */}
        <CRow className="mb-4 g-3">
          <CCol lg={7} className="mb-0">
            <JourneyPath
              courses={enrolledCourses}
              myProgressRows={myProgressRows}
              onViewCourse={(courseId) => {
                window.location.href = `/courses/${courseId}`
              }}
              onViewAll={() => {
                window.location.href = '/courses'
              }}
            />
          </CCol>
          <CCol lg={5} className="mb-0">
            <div className="dash-card dash-card-compact h-100 d-flex flex-column justify-content-center">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span className="fw-semibold d-flex align-items-center gap-2">
                  <CIcon icon={cilMusicNote} className="text-primary" size="lg" />
                  Ahora mismo
                </span>
                {urgentTasks.length > 4 && (
                  <button
                    className="btn btn-sm btn-outline-primary"
                    onClick={() => {
                      window.location.href = '/tasks'
                    }}
                    type="button"
                  >
                    Ver todas
                  </button>
                )}
              </div>
              <div className="d-flex flex-column gap-2">
                {urgentTasks.length > 0 ? (
                  urgentTasks.map((task) => (
                    <ActionCard
                      key={task.id}
                      task={{ ...task, instrument_color: getInstrumentColor(profile?.instrument) }}
                      onClick={() => {
                        window.location.href = '/tasks'
                      }}
                    />
                  ))
                ) : (
                  <div className="text-center text-medium-emphasis py-4">
                    <CIcon icon={cilMusicNote} size="xl" className="mb-2" />
                    <div className="fw-semibold mb-1">¡Todo al día!</div>
                    <div className="small mb-3">No tienes tareas urgentes</div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => practice.startPractice({})}
                      type="button"
                    >
                      <CIcon icon={cilMediaPlay} className="me-1" size="sm" /> Práctica libre
                    </button>
                  </div>
                )}
              </div>
            </div>
          </CCol>
        </CRow>

        {/* BOTTOM ROW: Weekly + Próxima clase */}
        <CRow className="mb-4 g-3 flex-grow-1">
          <CCol lg={hasNextLesson ? 8 : 12} className="mb-0">
            <WeeklyDots
              weeklySummary={practice.weeklySummary}
              instrumentColor={instrumentColor}
              onStartPractice={() => practice.startPractice({})}
            />
          </CCol>
          {hasNextLesson && (
            <CCol lg={4} className="mb-0">
              <div
                className="dash-card dash-card-compact h-100 d-flex flex-column justify-content-center"
                style={{
                  background: 'linear-gradient(135deg, var(--cui-primary) 0%, #5c6bc0 100%)',
                  color: 'white',
                }}
              >
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                    style={{ width: 44, height: 44, background: 'rgba(255,255,255,0.2)' }}
                  >
                    <CIcon icon={cilCalendar} size="xl" color="white" />
                  </div>
                  <div className="flex-grow-1">
                    <div className="fw-bold">Próxima clase</div>
                    <div className="text-white-50 small">
                      {new Date(profile.next_lesson).toLocaleString('es-ES', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    {profile?.teacher && (
                      <div className="text-white-50 small">Con {profile.teacher}</div>
                    )}
                  </div>
                </div>
                <div className="d-flex align-items-center justify-content-between mt-3">
                  <span
                    className={`fw-bold ${nextLessonCountdown.isOverdue ? 'text-warning' : ''}`}
                  >
                    {nextLessonCountdown.text}
                  </span>
                  <button
                    className="btn btn-outline-light btn-sm"
                    onClick={() => {
                      window.location.href = '/lessons'
                    }}
                    type="button"
                  >
                    Ver detalles
                  </button>
                </div>
              </div>
            </CCol>
          )}
        </CRow>
      </div>
    )
  }

  // Admin view - unchanged
  return (
    <>
      <CRow className="mb-4">
        <KpiCard
          color="purple"
          label="Estudiantes activos"
          value={summary.activeStudents}
          subtext="Total en la academia"
          icon={cilPeople}
        />
        <KpiCard
          color="cyan"
          label="Clases esta semana"
          value={summary.lessonsThisWeek}
          subtext="Horarios programados"
          icon={cilCalendar}
        />
        <KpiCard
          color="magenta"
          label="Profesores"
          value={summary.teachers}
          subtext="Mentores disponibles"
          icon={cilSchool}
        />
        <KpiCard
          color="navy"
          label="Instrumentos"
          value={summary.availableInstruments.length}
          subtext="Categorías activas"
          icon={cilChart}
        />
      </CRow>

      <CCard className="welcome-banner mb-4">
        <CCardBody>
          <h5 className="welcome-title">Bienvenido a Cosmic Muse</h5>
          <p className="welcome-text">
            Administra estudiantes, horarios y performance de la academia desde un solo lugar.
          </p>
        </CCardBody>
      </CCard>

      <CRow className="mb-4">
        <CCol md={6} className="mb-3">
          <CCard className="chart-card h-100">
            <CCardHeader>Ingresos mensuales</CCardHeader>
            <CCardBody>
              {paymentsByMonth.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={paymentsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                    <Bar dataKey="total" fill={BRAND.purple} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-medium-emphasis py-5">Sin datos de pagos</div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
        <CCol md={6} className="mb-3">
          <CCard className="chart-card h-100">
            <CCardHeader>Estudiantes por instrumento</CCardHeader>
            <CCardBody>
              {instrumentData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={instrumentData}
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {instrumentData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-medium-emphasis py-5">Sin datos</div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="mb-4">
        <CCol>
          <CCard className="chart-card">
            <CCardHeader>Progreso de estudiantes activos</CCardHeader>
            <CCardBody>
              {progressData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Line
                      type="monotone"
                      dataKey="progreso"
                      stroke={BRAND.cyan}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-medium-emphasis py-5">Sin datos</div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      <CRow className="mb-4">
        {students.slice(0, 3).map((student, idx) => (
          <CCol xs={12} md={4} key={student.id} className="mb-3">
            <CCard
              className={`h-100 student-card student-card--${['purple', 'cyan', 'magenta'][idx % 3]}`}
            >
              <CCardHeader>{student.full_name}</CCardHeader>
              <CCardBody>
                <div className="text-medium-emphasis small">Instrumento</div>
                <div className="fw-semibold mb-2">{student.instrument}</div>
                <div className="text-medium-emphasis small">Profesor</div>
                <div className="fw-semibold mb-2">{student.teacher}</div>
                <div className="d-flex justify-content-between align-items-center">
                  <span className="text-medium-emphasis">Progreso</span>
                  <strong>{student.progress}%</strong>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        ))}
      </CRow>

      <CRow>
        <CCol>
          <CCard className="chart-card">
            <CCardHeader>Tareas recientes</CCardHeader>
            <CCardBody>
              <div className="text-medium-emphasis mb-3">
                Las últimas tareas registradas en la academia.
              </div>
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Título</th>
                    <th>Estudiante</th>
                    <th>Entrega</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.title}</td>
                      <td>{task.profiles?.full_name || '—'}</td>
                      <td>{task.due_date}</td>
                      <td>{task.status}</td>
                    </tr>
                  ))}
                  {recentTasks.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-medium-emphasis">
                        No hay tareas registradas todavía.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default Dashboard
