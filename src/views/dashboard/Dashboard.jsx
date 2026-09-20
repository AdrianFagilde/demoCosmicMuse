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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts'

import { useAuth } from '../../context/AuthContext'
import useSupabaseStudents from '../../hooks/useSupabaseStudents'
import useSupabaseTasks from '../../hooks/useSupabaseTasks'
import useSupabasePractice from '../../hooks/useSupabasePractice'
import supabase from '../../lib/supabase'
import KpiCard from '../../components/KpiCard'

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

  // Check if date is valid
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

// Build version to force cache busting
const BUILD_VERSION = '2026.09.19.4'

const Dashboard = () => {
  const { user, profile } = useAuth()
  const isStudent = profile?.role === 'student'
  const { students, getSummary } = useSupabaseStudents()
  const { tasks } = useSupabaseTasks()
  const practice = useSupabasePractice(user?.id)
  const [summary, setSummary] = useState({
    activeStudents: 0,
    lessonsThisWeek: 0,
    teachers: 0,
    availableInstruments: [],
  })
  const [paymentsByMonth, setPaymentsByMonth] = useState([])

  // Force build hash update - build version reference
  const buildVersion = BUILD_VERSION

  // Force build hash update - used in rendered output to force hash change
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

  const weeklyChartData = useMemo(() => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    return (practice.weeklySummary || []).map((d, i) => ({
      day: days[new Date(d.day).getDay()],
      minutes: d.minutes || 0,
      sessions: d.sessions || 0,
    }))
  }, [practice.weeklySummary])

  if (isStudent) {
    return (
      <>
        <CRow className="mb-4">
          <CCol xs={12} md={6} lg={3} className="mb-3">
            <CCard className="h-100 streak-card">
              <CCardBody className="d-flex flex-column align-items-center text-center py-4">
                <CIcon icon={cilFire} size="xl" className="text-danger mb-2" />
                <div className="fs-1 fw-bold text-danger">
                  {practice.streak?.current_streak || 0}
                </div>
                <div className="text-medium-emphasis small">Días seguidos</div>
                <div className="mt-1 small">
                  <CBadge color="info">Mejor: {practice.streak?.longest_streak || 0}</CBadge>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={12} md={6} lg={3} className="mb-3">
            <CCard className="h-100 xp-card">
              <CCardBody className="d-flex flex-column align-items-center text-center py-4">
                <CIcon icon={cilStar} size="xl" className="text-warning mb-2" />
                <div className="fs-1 fw-bold text-warning">Nivel {currentLevel}</div>
                <div className="text-medium-emphasis small">{currentXP} XP</div>
                <CProgress className="w-100 mt-2" value={xpProgress} height={6} color="warning" />
                <div className="text-medium-emphasis small mt-1">
                  {xpNextLevel - currentXP} XP para siguiente nivel
                </div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={12} md={6} lg={3} className="mb-3">
            <CCard className="h-100 practice-card">
              <CCardBody className="d-flex flex-column align-items-center text-center py-4">
                <CIcon icon={cilClock} size="xl" className="text-info mb-2" />
                <div className="fs-1 fw-bold text-info">
                  {practice.gamification?.total_practice_minutes || 0} min
                </div>
                <div className="text-medium-emphasis small">Práctica total</div>
                <div className="mt-1 small">
                  <CBadge color="secondary">{practice.sessions?.length || 0} sesiones</CBadge>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol xs={12} md={6} lg={3} className="mb-3">
            <CCard className="h-100 tasks-card">
              <CCardBody className="d-flex flex-column align-items-center text-center py-4">
                <CIcon icon={cilMusicNote} size="xl" className="text-success mb-2" />
                <div className="fs-1 fw-bold text-success">{completedTasks.length}</div>
                <div className="text-medium-emphasis small">Tareas completadas</div>
                <div className="mt-1 small">
                  <CBadge color="warning text-dark">{pendingTasks.length} pendientes</CBadge>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        <CRow className="mb-4">
          <CCol lg={8} className="mb-3">
            <CCard className="welcome-banner h-100">
              <CCardBody className="d-flex flex-column justify-content-center">
                <h5 className="welcome-title">
                  Bienvenido, {profile?.full_name?.split(' ')[0] || 'estudiante'} 👋
                </h5>
                <p className="welcome-text mb-3">Tu panel de práctica y progreso personal.</p>

                <div className="d-flex flex-wrap gap-2">
                  <CButton color="primary" size="lg" onClick={() => practice.startPractice({})}>
                    <CIcon icon={cilMediaPlay} className="me-2" /> Iniciar práctica
                  </CButton>
                  <CButton
                    color="secondary"
                    variant="outline"
                    size="lg"
                    onClick={() => (window.location.href = '/tasks')}
                  >
                    <CIcon icon={cilMusicNote} className="me-2" /> Ver tareas
                  </CButton>
                  <CButton
                    color="secondary"
                    variant="outline"
                    size="lg"
                    onClick={() => (window.location.href = '/courses')}
                  >
                    <CIcon icon={cilBook} className="me-2" /> Mis cursos
                  </CButton>
                </div>
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={4} className="mb-3">
            <CCard className="h-100 next-lesson-card">
              <CCardHeader>Próxima clase</CCardHeader>
              <CCardBody className="d-flex flex-column align-items-center text-center py-3">
                <div
                  className={`fs-2 fw-bold ${nextLessonCountdown.isOverdue ? 'text-danger' : 'text-primary'}`}
                >
                  {nextLessonCountdown.text}
                </div>
                {profile?.next_lesson && !isNaN(new Date(profile.next_lesson).getTime()) && (
                  <div className="text-medium-emphasis small mt-1">
                    {new Date(profile.next_lesson).toLocaleString('es-ES', {
                      weekday: 'long',
                      dateStyle: 'short',
                      timeStyle: 'short',
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

        {/* Build version marker - forces new build hash on deploy */}
        <div data-build-version={buildHash} style={{ display: 'none' }} />

        <CRow className="mb-4">
          <CCol lg={8} className="mb-3">
            <CCard className="chart-card h-100">
              <CCardHeader>Práctica semanal (minutos)</CCardHeader>
              <CCardBody>
                {weeklyChartData.length > 0 && weeklyChartData.some((d) => d.minutes > 0) ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={weeklyChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis type="number" />
                      <YAxis dataKey="day" type="category" width={50} />
                      <Tooltip formatter={(v) => `${v} min`} />
                      <Bar
                        dataKey="minutes"
                        fill={BRAND.cyan}
                        radius={[0, 4, 4, 0]}
                        layout="vertical"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-medium-emphasis py-5">
                    <CIcon icon={cilClock} size="lg" className="mb-2" />
                    <p>Sin datos de práctica esta semana</p>
                    <CButton
                      color="primary"
                      size="sm"
                      onClick={() => practice.startPractice({})}
                      className="mt-2"
                    >
                      <CIcon icon={cilMediaPlay} className="me-1" /> Iniciar primera sesión
                    </CButton>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={4} className="mb-3">
            <CCard className="chart-card h-100">
              <CCardHeader>Próximos logros</CCardHeader>
              <CCardBody>
                {(practice.nextBadges || []).length > 0 ? (
                  <div className="d-flex flex-column gap-3">
                    {(practice.nextBadges || []).slice(0, 3).map((badge) => {
                      const def = BADGE_DEFINITIONS[badge.badge_key]
                      const progress = Math.min(
                        100,
                        Math.round((badge.progress / badge.target) * 100),
                      )
                      return (
                        <div key={badge.badge_key} className="d-flex align-items-center gap-3">
                          <div
                            className={`badge-icon bg-${def.color} bg-opacity-10 rounded-circle d-flex align-items-center justify-content-center`}
                            style={{ width: 48, height: 48 }}
                          >
                            <CIcon icon={def.icon} className={`text-${def.color}`} size="lg" />
                          </div>
                          <div className="flex-grow-1">
                            <div className="fw-semibold small">{def.name}</div>
                            <div className="text-medium-emphasis small">{def.description}</div>
                            <CProgress
                              className="mt-1"
                              value={progress}
                              height={4}
                              color={def.color}
                            />
                            <div className="text-medium-emphasis small mt-1">
                              {badge.progress}/{badge.target}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center text-medium-emphasis py-4">
                    <CIcon icon={cilStar} size="lg" className="mb-2" />
                    <p>¡Has desbloqueado todos los logros disponibles!</p>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        <CRow className="mb-4">
          <CCol lg={8} className="mb-3">
            <CCard className="chart-card h-100">
              <CCardHeader>Tareas pendientes</CCardHeader>
              <CCardBody>
                {pendingTasks.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead>
                        <tr>
                          <th>Tarea</th>
                          <th>Curso</th>
                          <th>Entrega</th>
                          <th>Progreso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingTasks.slice(0, 5).map((task) => (
                          <tr key={task.id}>
                            <td className="fw-semibold">{task.title}</td>
                            <td>{task.course_title || 'General'}</td>
                            <td>
                              <CBadge
                                color={
                                  new Date(task.due_date) < new Date()
                                    ? 'danger'
                                    : 'warning text-dark'
                                }
                              >
                                {task.due_date}
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center text-medium-emphasis py-4">
                    <CIcon icon={cilMusicNote} size="lg" className="mb-2" />
                    <p>¡No tienes tareas pendientes!</p>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
          <CCol lg={4} className="mb-3">
            <CCard className="h-100 recent-practice-card">
              <CCardHeader>Sesiones recientes</CCardHeader>
              <CCardBody className="p-0">
                {(practice.sessions || []).length > 0 ? (
                  <div className="list-group list-group-flush">
                    {(practice.sessions || []).slice(0, 5).map((session) => (
                      <div
                        key={session.id}
                        className="list-group-item px-3 py-2 d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <div className="fw-semibold small">
                            {session.notes || 'Práctica libre'}
                          </div>
                          <div className="text-medium-emphasis small">
                            {session.task_id
                              ? 'Tarea asignada'
                              : session.course_task_id
                                ? 'Tarea de curso'
                                : 'Práctica libre'}
                            • {formatTimeAgo(session.started_at)}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="fw-semibold">{session.duration_minutes || 0} min</div>
                          {session.metronome_used && (
                            <CBadge color="info" className="mt-1" style={{ fontSize: '0.65rem' }}>
                              Metrónomo: {session.metronome_bpm} BPM
                            </CBadge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-medium-emphasis py-4">
                    <CIcon icon={cilClock} size="lg" className="mb-2" />
                    <p>Sin sesiones registradas</p>
                    <CButton
                      color="primary"
                      size="sm"
                      onClick={() => practice.startPractice({})}
                      className="mt-2"
                    >
                      <CIcon icon={cilMediaPlay} className="me-1" /> Empezar ahora
                    </CButton>
                  </div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>

        <CRow className="mb-4">
          <CCol>
            <CCard className="chart-card">
              <CCardHeader className="d-flex justify-content-between align-items-center">
                <span>Logros desbloqueados</span>
                <CBadge color="primary">{practice.badges?.length || 0}</CBadge>
              </CCardHeader>
              <CCardBody>
                {(practice.badges || []).length > 0 ? (
                  <div className="d-flex flex-wrap gap-2">
                    {(practice.badges || []).map((badge) => {
                      const def = BADGE_DEFINITIONS[badge.badge_key]
                      return (
                        <div key={badge.id} className="badge-tooltip" style={{ cursor: 'default' }}>
                          <CBadge
                            color={def?.color || 'secondary'}
                            className="fs-6 px-3 py-2 d-flex align-items-center gap-1"
                            style={{ cursor: 'help' }}
                            title={`${def?.description} • ${new Date(badge.earned_at).toLocaleDateString('es-ES')}`}
                          >
                            <CIcon icon={def?.icon || cilStar} size="sm" />
                            {def?.name || badge.badge_key}
                          </CBadge>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center text-medium-emphasis py-4">
                    <CIcon icon={cilStar} size="lg" className="mb-2" />
                    <p>Completa tareas y practica para desbloquear logros</p>
                  </div>
                )}
              </CCardBody>
            </CCard>
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
