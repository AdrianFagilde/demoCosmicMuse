import React, { useEffect, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSelect,
  CProgress,
  CRow,
  CSpinner,
} from '@coreui/react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import { cilCalendar, cilChartPie, cilFire, cilClock, cilArrowTop } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useAuth } from '../../context/AuthContext'
import useSupabasePractice from '../../hooks/useSupabasePractice'
import useSupabaseTasks from '../../hooks/useSupabaseTasks'
import useSupabaseCourses from '../../hooks/useSupabaseCourses'

const Analytics = () => {
  const { user, profile } = useAuth()
  const practice = useSupabasePractice(user?.id)
  const { tasks } = useSupabaseTasks()
  const { courses } = useSupabaseCourses()

  const [period, setPeriod] = useState('month')
  const [loading, setLoading] = useState(false)

  const studentTasks = tasks.filter((t) => t.student_id === user?.id)
  const completedTasks = studentTasks.filter((t) => t.status === 'Completado')
  const enrolledCourses = courses.filter((c) =>
    c.course_enrollments?.some((e) => e.student_id === user?.id),
  )

  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}min`
  }

  const getWeeklyHeatmapData = () => {
    const data = []
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 364) // 52 weeks

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const daySessions =
        practice.sessions?.filter((s) => s.started_at?.split('T')[0] === dateStr && s.ended_at) ||
        []
      const minutes = daySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
      data.push({ date: dateStr, minutes, count: daySessions.length })
    }
    return data
  }

  const getMonthlyProgress = () => {
    const months = []
    const today = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const monthKey = d.toISOString().slice(0, 7)
      const monthSessions =
        practice.sessions?.filter((s) => s.started_at?.startsWith(monthKey) && s.ended_at) || []
      const minutes = monthSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
      const count = monthSessions.length
      const tasksDone = completedTasks.filter((t) => t.updated_at?.startsWith(monthKey)).length
      months.push({
        label: d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        minutes,
        count,
        tasksDone,
      })
    }
    return months
  }

  const getInstrumentProgress = () => {
    // This would need course/task data with instrument info
    return []
  }

  const heatmapData = getWeeklyHeatmapData()
  const monthlyData = getMonthlyProgress()

  const maxMinutes = Math.max(...heatmapData.map((d) => d.minutes), 1)

  const getColor = (minutes) => {
    if (minutes === 0) return '#e9ecef'
    if (minutes < 15) return '#ffedd5'
    if (minutes < 30) return '#ffd8a8'
    if (minutes < 60) return '#ffc170'
    return '#ff9f3a'
  }

  return (
    <>
      <CRow className="mb-4">
        <CCol>
          <CCard>
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold d-flex align-items-center gap-2">
                <CIcon icon={cilChartPie} className="text-primary" />
                Analítica de práctica
              </span>
              <CFormSelect
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-auto"
              >
                <option value="week">Esta semana</option>
                <option value="month">Este mes</option>
                <option value="quarter">Este trimestre</option>
                <option value="year">Este año</option>
              </CFormSelect>
            </CCardHeader>
            <CCardBody>
              <p className="text-medium-emphasis small">
                Visualiza tu progreso, identifica patrones y mejora tu rutina de práctica.
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* KPI Cards */}
      <CRow className="mb-4">
        <CCol xs={12} md={6} lg={3} className="mb-3">
          <CCard className="h-100">
            <CCardBody className="text-center py-4">
              <CIcon icon={cilClock} size="xl" className="text-primary mb-2" />
              <div className="fs-2 fw-bold text-primary">
                {formatTime(practice.gamification?.total_practice_minutes || 0)}
              </div>
              <div className="text-medium-emphasis small">Tiempo total de práctica</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} lg={3} className="mb-3">
          <CCard className="h-100">
            <CCardBody className="text-center py-4">
              <CIcon icon={cilFire} size="xl" className="text-danger mb-2" />
              <div className="fs-2 fw-bold text-danger">{practice.streak?.current_streak || 0}</div>
              <div className="text-medium-emphasis small">Días de racha actual</div>
              <div className="mt-1 small">
                <CBadge color="info">Mejor: {practice.streak?.longest_streak || 0}</CBadge>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} lg={3} className="mb-3">
          <CCard className="h-100">
            <CCardBody className="text-center py-4">
              <CIcon icon={cilTrendingUp} size="xl" className="text-success mb-2" />
              <div className="fs-2 fw-bold text-success">{completedTasks.length}</div>
              <div className="text-medium-emphasis small">Tareas completadas</div>
              <div className="mt-1 small">
                <CBadge color="info">{studentTasks.length} totales</CBadge>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol xs={12} md={6} lg={3} className="mb-3">
          <CCard className="h-100">
            <CCardBody className="text-center py-4">
              <CIcon icon={cilChartPie} size="xl" className="text-info mb-2" />
              <div className="fs-2 fw-bold text-info">{enrolledCourses.length}</div>
              <div className="text-medium-emphasis small">Cursos inscritos</div>
              <div className="mt-1 small">
                <CBadge color="success">
                  {practice.gamification?.courses_completed || 0} completados
                </CBadge>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Weekly Heatmap */}
      <CRow className="mb-4">
        <CCol>
          <CCard className="h-100">
            <CCardHeader>
              <span className="fw-semibold d-flex align-items-center gap-2">
                <CIcon icon={cilCalendar} className="text-info" />
                Actividad semanal (últimos 52 semanas)
              </span>
            </CCardHeader>
            <CCardBody>
              <div className="d-flex flex-wrap gap-1" style={{ maxWidth: '100%' }}>
                {heatmapData.map((day, index) => (
                  <div
                    key={day.date}
                    className="heatmap-cell"
                    style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: getColor(day.minutes),
                      borderRadius: '2px',
                      margin: '1px',
                      cursor: 'default',
                    }}
                    title={`${day.date}: ${formatTime(day.minutes)} (${day.count} sesiones)`}
                  />
                ))}
              </div>
              <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap gap-2">
                <div className="d-flex flex-wrap gap-2">
                  <div className="d-flex align-items-center gap-1">
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '2px',
                      }}
                    />
                    <span className="small">Sin práctica</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#ffedd5',
                        borderRadius: '2px',
                      }}
                    />
                    <span className="small">{'< 15 min'}</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#ffd8a8',
                        borderRadius: '2px',
                      }}
                    />
                    <span className="small">15-30 min</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#ffc170',
                        borderRadius: '2px',
                      }}
                    />
                    <span className="small">30-60 min</span>
                  </div>
                  <div className="d-flex align-items-center gap-1">
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: '#ff9f3a',
                        borderRadius: '2px',
                      }}
                    />
                    <span className="small">{'> 60 min'}</span>
                  </div>
                </div>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Monthly Progress Chart */}
      <CRow className="mb-4">
        <CCol lg={8} className="mb-3">
          <CCard className="h-100">
            <CCardHeader>Minutos de práctica por mes</CCardHeader>
            <CCardBody>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={monthlyData}>
                    <defs>
                      <linearGradient id="colorPractice" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ff9f3a" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#ff9f3a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatTime(v)} />
                    <Area
                      type="monotone"
                      dataKey="minutes"
                      stroke="#ff9f3a"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorPractice)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-medium-emphasis py-5">Sin datos de práctica</div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
        <CCol lg={4} className="mb-3">
          <CCard className="h-100">
            <CCardHeader>Sesiones por mes</CCardHeader>
            <CCardBody>
              {monthlyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis type="number" />
                    <YAxis dataKey="label" type="category" width={60} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => `${v} sesiones`} />
                    <Bar dataKey="count" fill="#712771" radius={[0, 4, 4, 0]} layout="vertical" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-medium-emphasis py-5">Sin datos</div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Tasks Progress */}
      <CRow className="mb-4">
        <CCol lg={8} className="mb-3">
          <CCard className="h-100">
            <CCardHeader>Progreso de tareas por estado</CCardHeader>
            <CCardBody>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Completadas', value: completedTasks.length, color: '#28a745' },
                      {
                        name: 'En progreso',
                        value: studentTasks.filter((t) => t.status === 'En progreso').length,
                        color: '#17a2b8',
                      },
                      {
                        name: 'Pendientes',
                        value: studentTasks.filter((t) => t.status === 'Pendiente').length,
                        color: '#ffc107',
                      },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, value, percent }) =>
                      `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    <Cell fill="#28a745" />
                    <Cell fill="#17a2b8" />
                    <Cell fill="#ffc107" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol lg={4} className="mb-3">
          <CCard className="h-100">
            <CCardHeader>Nivel y XP</CCardHeader>
            <CCardBody className="text-center py-4">
              <div className="fs-1 fw-bold text-primary mb-2">
                Nivel {practice.gamification?.level || 1}
              </div>
              <div className="text-medium-emphasis mb-3">{practice.gamification?.xp || 0} XP</div>
              <CProgress
                value={
                  practice.gamification?.xp && practice.gamification?.level
                    ? ((practice.gamification.xp - (practice.gamification.level - 1) ** 2 * 100) /
                        (practice.gamification.level ** 2 * 100 -
                          (practice.gamification.level - 1) ** 2 * 100)) *
                      100
                    : 0
                }
                height={12}
                color="primary"
                className="mb-2"
              />
              <div className="text-medium-emphasis small">XP para siguiente nivel</div>
              <hr />
              <div className="d-flex justify-content-center gap-3 flex-wrap">
                <CBadge color="primary" className="fs-6 px-3 py-2">
                  <CIcon icon={cilTrendingUp} className="me-1" />
                  {practice.gamification?.tasks_completed || 0} tareas
                </CBadge>
                <CBadge color="success" className="fs-6 px-3 py-2">
                  <CIcon icon={cilChartPie} className="me-1" />
                  {practice.gamification?.courses_completed || 0} cursos
                </CBadge>
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Badges Progress */}
      <CRow className="mb-4">
        <CCol>
          <CCard>
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold d-flex align-items-center gap-2">
                <CIcon icon={cilFire} className="text-warning" />
                Próximos logros
              </span>
              <CBadge color="primary">{practice.nextBadges?.length || 0}</CBadge>
            </CCardHeader>
            <CCardBody>
              {(practice.nextBadges || []).length > 0 ? (
                <div className="row g-3">
                  {practice.nextBadges.map((badge) => (
                    <CCol key={badge.badge_key} xs={6} md={4} lg={3}>
                      <div className="card h-100 border-0 bg-light">
                        <div className="card-body text-center p-3">
                          <div className="mb-2">
                            <span className="badge bg-warning text-dark fs-6 px-3 py-2">
                              {badge.progress}/{badge.target}
                            </span>
                          </div>
                          <h6 className="card-title mb-1">{badge.badge_name}</h6>
                          <p className="card-text text-medium-emphasis small">
                            {badge.badge_description}
                          </p>
                          <CProgress
                            value={Math.min(100, Math.round((badge.progress / badge.target) * 100))}
                            height={6}
                            color="warning"
                            className="mt-2"
                          />
                        </div>
                      </div>
                    </CCol>
                  ))}
                </div>
              ) : (
                <div className="text-center text-medium-emphasis py-4">
                  <CIcon icon={cilFire} size="xl" className="mb-2" />
                  <p>¡Has desbloqueado todos los logros disponibles!</p>
                </div>
              )}
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default Analytics
