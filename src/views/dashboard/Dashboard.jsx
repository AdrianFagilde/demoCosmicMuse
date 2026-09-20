import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CButton,
  CBadge,
  CProgress,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilSchool,
  cilPeople,
  cilCalendar,
  cilChart,
  cilFire,
  cilStar,
  cilClock,
  cilMediaPlay,
  cilBook,
  cilMusicNote,
} from '@coreui/icons'

import { useAuth } from '../../context/AuthContext'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import useSupabaseTasks from '../../hooks/useSupabaseTasks'
import useSupabasePractice from '../../hooks/useSupabasePractice'
import useSupabaseCourses from '../../hooks/useSupabaseCourses'
import supabase from '../../lib/supabase'
import KpiCard from '../../components/KpiCard'
import StatPill from '../../components/dashboard/StatPill'
import TaskUrgencyRow from '../../components/dashboard/TaskUrgencyRow'
import LearningPathCard from '../../components/dashboard/LearningPathCard'
import WeeklySparkline from '../../components/dashboard/WeeklySparkline'
import NextBadgeCard from '../../components/dashboard/NextBadgeCard'

const BRAND = {
  purple: '#712771',
  cyan: '#16c1d6',
  magenta: '#b42d75',
  navy: '#161a3c',
}

const COLORS = [BRAND.purple, BRAND.cyan, BRAND.magenta, BRAND.navy, '#9a3f9e', '#5fd6e8']

const BADGE_DEFINITIONS = {
  first_task: {
    name: 'Primera Tarea',
    icon: cilStar,
    color: 'warning',
    description: 'Completaste tu primera tarea',
  },
  tasks_10: {
    name: '10 Tareas',
    icon: cilStar,
    color: 'info',
    description: 'Completaste 10 tareas',
  },
  tasks_50: {
    name: '50 Tareas',
    icon: cilStar,
    color: 'primary',
    description: 'Completaste 50 tareas',
  },
  tasks_100: {
    name: '100 Tareas',
    icon: cilStar,
    color: 'success',
    description: 'Completaste 100 tareas',
  },
  first_course: {
    name: 'Primer Curso',
    icon: cilBook,
    color: 'warning',
    description: 'Completaste tu primer curso',
  },
  courses_5: {
    name: '5 Cursos',
    icon: cilBook,
    color: 'primary',
    description: 'Completaste 5 cursos',
  },
  week_streak: {
    name: 'Racha de 7 Días',
    icon: cilFire,
    color: 'danger',
    description: 'Practicaste 7 días seguidos',
  },
  month_streak: {
    name: 'Racha de 30 Días',
    icon: cilFire,
    color: 'magenta',
    description: 'Practicaste 30 días seguidos',
  },
  century_streak: {
    name: 'Racha de 100 Días',
    icon: cilFire,
    color: 'purple',
    description: 'Practicaste 100 días seguidos',
  },
}

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

const xpForLevel = (level) => (level - 1) ** 2 * 100
const xpForNextLevel = (level) => level ** 2 * 100

const BUILD_VERSION = '2026.09.20.1'

const Dashboard = () => {
  const { user, profile } = useAuth()
  const isStudent = profile?.role === 'student'
  const { students, getSummary } = useSupabaseStudents()
  const { tasks } = useSupabaseTasks()
  const { courses } = useSupabaseCourses()
  const practice = useSupabasePractice(user?.id)
  const [summary, setSummary] = useState({
    activeStudents: 0,
    lessonsThisWeek: 0,
    teachers: 0,
    availableInstruments: [],
  })
  const [paymentsByMonth, setPaymentsByMonth] = useState([])

  const buildVersion = BUILD_VERSION
  const buildHash = `v${BUILD_VERSION}`

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
  const currentXP = practice.gamification?.xp || 0
  const currentLevel = practice.gamification?.level || 1
  const xpCurrentLevel = xpForLevel(currentLevel)
  const xpNextLevel = xpForNextLevel(currentLevel)
  const xpProgress =
    xpNextLevel > xpCurrentLevel
      ? Math.round(((currentXP - xpCurrentLevel) / (xpNextLevel - xpCurrentLevel)) * 100)
      : 100

  const enrolledCourses = courses.filter((c) =>
    c.course_enrollments?.some((e) => e.student_id === user?.id),
  )
  const myProgressRows = practice.gamification ? [] : []

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

  const urgentTasks = sortTasksByUrgency(pendingTasks).slice(0, 3)

  const getPrimaryCTA = () => {
    if (urgentTasks.length > 0) {
      const task = urgentTasks[0]
      const due = task.due_date ? new Date(task.due_date) : null
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const isOverdue = due && due < now
      const isDueToday = due && due.toDateString() === now.toDateString()
      return {
        label: isOverdue
          ? `Ponerte al día: ${task.title}`
          : isDueToday
            ? `Hacer hoy: ${task.title}`
            : `Continuar: ${task.title}`,
        onClick: () => (window.location.href = `/courses/${task.course_id}?task=${task.id}`),
        variant: 'solid',
      }
    }
    if (nextLessonCountdown.text !== 'Sin programar' && !nextLessonCountdown.isOverdue) {
      const diff = new Date(profile.next_lesson) - new Date()
      const hours = diff / (1000 * 60 * 60)
      if (hours < 24) {
        return {
          label: 'Preparar clase',
          onClick: () => (window.location.href = '/lessons'),
          variant: 'outline',
        }
      }
    }
    return {
      label: 'Iniciar práctica libre',
      onClick: () => practice.startPractice({}),
      variant: 'solid',
    }
  }

  const primaryCTA = getPrimaryCTA()

  if (isStudent) {
    return (
      <>
        <div data-build-version={buildHash} style={{ display: 'none' }} />

        {/* HERO SECTION */}
        <CRow className="mb-4">
          <CCol lg={8} className="mb-3">
            <CCard className="hero-card h-100">
              <CCardBody className="d-flex flex-column justify-content-center py-4 px-4">
                <h4 className="welcome-title mb-2">
                  Bienvenido, {profile?.full_name?.split(' ')[0] || 'estudiante'} 👋
                </h4>
                <p className="welcome-text mb-3 text-medium-emphasis">
                  {urgentTasks.length > 0
                    ? `Tienes ${urgentTasks.length} tarea${urgentTasks.length > 1 ? 's' : ''} urgente${urgentTasks.length > 1 ? 's' : ''}.`
                    : 'Tu panel de práctica y progreso personal.'}
                </p>
                <div className="d-flex flex-wrap gap-2">
                  <CButton
                    color="primary"
                    size="lg"
                    variant={primaryCTA.variant}
                    onClick={primaryCTA.onClick}
                    className="fw-semibold"
                  >
                    <CIcon icon={cilMediaPlay} className="me-2" />
                    {primaryCTA.label}
                  </CButton>
                  <CButton
                    color="secondary"
                    variant="outline"
                    size="lg"
                    onClick={() => (window.location.href = '/tasks')}
                  >
                    <CIcon icon={cilMusicNote} className="me-2" /> Ver todas las tareas
                  </CButton>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={4} className="mb-3">
            <CCard className="h-100 next-lesson-card">
              <CCardHeader className="py-2">Próxima clase</CCardHeader>
              <CCardBody className="d-flex flex-column align-items-center text-center py-3">
                <div
                  className={`fs-3 fw-bold ${nextLessonCountdown.isOverdue ? 'text-danger' : 'text-primary'}`}
                >
                  {nextLessonCountdown.text}
                </div>
                {profile?.next_lesson && !isNaN(new Date(profile.next_lesson).getTime()) && (
                  <div className="text-medium-emphasis small mt-1">
                    {new Date(profile.next_lesson).toLocaleString('es-ES', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                )}
                {profile?.teacher && (
                  <div className="text-medium-emphasis small mt-1">Con {profile.teacher}</div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        {/* QUICK STATS ROW - 3 compact pills */}
        <CRow className="mb-4 g-3">
          <CCol xs={12} md={4} className="mb-0">
            <StatPill
              icon={cilFire}
              value={practice.streak?.current_streak || 0}
              label="Racha actual"
              subLabel={`Mejor: ${practice.streak?.longest_streak || 0}`}
              color="danger"
              onClick={() => (window.location.href = '/practice-tools')}
            />
          </CCol>
          <CCol xs={12} md={4} className="mb-0">
            <StatPill
              icon={cilStar}
              value={`Nivel ${currentLevel}`}
              label="XP total"
              subLabel={`${currentXP.toLocaleString()} XP`}
              color="warning"
              progress={xpProgress}
              progressColor="warning"
              onClick={() => (window.location.href = '/courses')}
            />
          </CCol>
          <CCol xs={12} md={4} className="mb-0">
            <StatPill
              icon={cilClock}
              value={`${practice.gamification?.total_practice_minutes || 0} min`}
              label="Práctica total"
              subLabel={`${practice.sessions?.length || 0} sesiones`}
              color="info"
              onClick={() => (window.location.href = '/tasks')}
            />
          </CCol>
        </CRow>

        {/* MAIN CONTENT ROW: Tareas Urgentes + Ruta de Aprendizaje */}
        <CRow className="mb-4">
          <CCol lg={7} className="mb-3">
            <CCard className="h-100 urgent-tasks-card">
              <CCardHeader className="d-flex justify-content-between align-items-center py-2">
                <span className="fw-semibold d-flex align-items-center gap-2">
                  <CIcon icon={cilMusicNote} className="text-primary" />
                  Tareas urgentes
                </span>
                {pendingTasks.length > 3 && (
                  <CButton
                    color="secondary"
                    variant="outline"
                    size="sm"
                    onClick={() => (window.location.href = '/tasks')}
                  >
                    Ver todas ({pendingTasks.length})
                  </CButton>
                )}
              </CCardHeader>
              <CCardBody className="p-0">
                {urgentTasks.length > 0 ? (
                  <div className="p-2">
                    {urgentTasks.map((task) => (
                      <TaskUrgencyRow
                        key={task.id}
                        task={task}
                        onClick={(t) =>
                          (window.location.href = `/courses/${t.course_id}?task=${t.id}`)
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-medium-emphasis py-5">
                    <CIcon icon={cilMusicNote} size="lg" className="mb-2" />
                    <p className="mb-2">¡No tienes tareas pendientes!</p>
                    <CButton color="primary" size="sm" onClick={() => practice.startPractice({})}>
                      <CIcon icon={cilMediaPlay} className="me-1" /> Práctica libre
                    </CButton>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={5} className="mb-3">
            <LearningPathCard
              courses={enrolledCourses}
              myProgressRows={practice.gamification ? [] : []}
              onViewCourses={() => (window.location.href = '/courses')}
            />
          </CCol>
        </CRow>

        {/* BOTTOM ROW: Weekly Sparkline + Próximo Logro */}
        <CRow className="mb-4">
          <CCol lg={7} className="mb-3">
            <WeeklySparkline
              weeklySummary={practice.weeklySummary}
              onStartPractice={() => practice.startPractice({})}
            />
          </CCol>
          <CCol lg={5} className="mb-3">
            <NextBadgeCard nextBadges={practice.nextBadges} />
          </CCol>
        </CRow>
      </>
    )
  }

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
