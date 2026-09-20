import React, { useEffect, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CBadge,
  CProgress,
  CFormSelect,
} from '@coreui/react'
import { cilFire, cilUser, cilStar, cilBadge, cilStarHalf } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useAuth } from '../../context/AuthContext'
import supabase from '../../lib/supabase'

const Leaderboard = () => {
  const { user } = useAuth()
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('all')
  const [metric, setMetric] = useState('xp')

  const fetchLeaderboard = useCallback(async () => {
    if (!user?.id) return

    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('student_gamification')
        .select(
          `
          *,
          profiles!inner (
            id,
            full_name,
            instrument,
            level
          )
        `,
        )
        .eq('profiles.role', 'student')
        .order(metric === 'xp' ? 'xp' : metric === 'level' ? 'level' : 'total_practice_minutes', {
          ascending: false,
        })
        .limit(50)

      if (period !== 'all') {
        const daysAgo = period === 'week' ? 7 : period === 'month' ? 30 : 90
        const since = new Date()
        since.setDate(since.getDate() - daysAgo)
        query = query.gte('updated_at', since.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      // Get badges count for each student
      const studentIds = (data || []).map((d) => d.student_id)
      let badgesMap = {}
      if (studentIds.length > 0) {
        const { data: badges } = await supabase
          .from('student_badges')
          .select('student_id, badge_key')
          .in('student_id', studentIds)

        if (badges) {
          badgesMap = badges.reduce((acc, b) => {
            if (!acc[b.student_id]) acc[b.student_id] = []
            acc[b.student_id].push(b.badge_key)
            return acc
          }, {})
        }
      }

      // Add current user rank if not in top 50
      let currentUserRank = null
      const currentUserEntry = data?.find((d) => d.student_id === user.id)
      if (!currentUserEntry && data?.length === 50) {
        // Fetch user's actual rank
        const { count } = await supabase
          .from('student_gamification')
          .select('*', { count: 'exact', head: true })
          .gt(
            metric === 'xp' ? 'xp' : metric === 'level' ? 'level' : 'total_practice_minutes',
            currentUserEntry?.[metric] || 0,
          )
        currentUserRank = (count || 0) + 1
      }

      setLeaderboard(
        (data || []).map((entry, index) => ({
          ...entry,
          rank: index + 1,
          badges: badgesMap[entry.student_id] || [],
          isCurrentUser: entry.student_id === user.id,
        })),
      )

      if (currentUserRank) {
        setLeaderboard((prev) => [
          ...prev,
          {
            student_id: user.id,
            profiles: { full_name: 'Tú', instrument: '', level: '' },
            xp: 0,
            level: 1,
            total_practice_minutes: 0,
            rank: currentUserRank,
            badges: [],
            isCurrentUser: true,
          },
        ])
      }
    } catch (err) {
      console.error('[Leaderboard] Error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [user, period, metric])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLeaderboard()
  }, [fetchLeaderboard])

  const getBadgeName = (key) => {
    const badges = {
      first_task: 'Primera Tarea',
      tasks_10: '10 Tareas',
      tasks_50: '50 Tareas',
      tasks_100: '100 Tareas',
      first_course: 'Primer Curso',
      courses_5: '5 Cursos',
      week_streak: 'Racha 7 Días',
      month_streak: 'Racha 30 Días',
      century_streak: 'Racha 100 Días',
    }
    return badges[key] || key
  }

  const getBadgeIcon = (key) => {
    if (key.includes('streak')) return cilFire
    if (key.includes('course')) return cilAward
    if (key.includes('task')) return cilStar
    return cilTrophy
  }

  const getRankColor = (rank) => {
    if (rank === 1) return 'warning'
    if (rank === 2) return 'secondary'
    if (rank === 3) return 'danger'
    return 'primary'
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

  const badgeDefinitions = [
    {
      key: 'first_task',
      name: 'Primera Tarea',
      desc: 'Completa tu primera tarea',
      icon: cilStar,
      color: 'warning',
    },
    {
      key: 'tasks_10',
      name: '10 Tareas',
      desc: 'Completa 10 tareas',
      icon: cilStar,
      color: 'info',
    },
    {
      key: 'tasks_50',
      name: '50 Tareas',
      desc: 'Completa 50 tareas',
      icon: cilStar,
      color: 'primary',
    },
    {
      key: 'tasks_100',
      name: '100 Tareas',
      desc: 'Completa 100 tareas',
      icon: cilStar,
      color: 'success',
    },
    {
      key: 'first_course',
      name: 'Primer Curso',
      desc: 'Completa tu primer curso',
      icon: cilBadge,
      color: 'warning',
    },
    {
      key: 'courses_5',
      name: '5 Cursos',
      desc: 'Completa 5 cursos',
      icon: cilBadge,
      color: 'primary',
    },
    {
      key: 'week_streak',
      name: 'Racha 7 Días',
      desc: 'Practica 7 días seguidos',
      icon: cilFire,
      color: 'danger',
    },
    {
      key: 'month_streak',
      name: 'Racha 30 Días',
      desc: 'Practica 30 días seguidos',
      icon: cilFire,
      color: 'magenta',
    },
    {
      key: 'century_streak',
      name: 'Racha 100 Días',
      desc: 'Practica 100 días seguidos',
      icon: cilFire,
      color: 'purple',
    },
  ]

  return (
    <>
      <CRow className="mb-4">
        <CCol>
          <CCard>
            <CCardHeader className="d-flex justify-content-between align-items-center">
              <span className="fw-semibold d-flex align-items-center gap-2">
                <CIcon icon={cilStar} className="text-warning" />
                Ranking de estudiantes
              </span>
              <div className="d-flex gap-2">
                <CFormSelect
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  className="w-auto"
                >
                  <option value="all">Todo el tiempo</option>
                  <option value="week">Esta semana</option>
                  <option value="month">Este mes</option>
                  <option value="quarter">Este trimestre</option>
                </CFormSelect>
                <CFormSelect
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  className="w-auto"
                >
                  <option value="xp">Por XP</option>
                  <option value="level">Por nivel</option>
                  <option value="total_practice_minutes">Minutos de práctica</option>
                  <option value="tasks_completed">Tareas completadas</option>
                </CFormSelect>
              </div>
            </CCardHeader>
            <CCardBody className="p-0">
              <CTable hover className="mb-0">
                <CTableHead>
                  <CTableRow>
                    <CTableHeaderCell style={{ width: '60px' }}>#</CTableHeaderCell>
                    <CTableHeaderCell>Estudiante</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '100px' }}>Nivel</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '100px' }}>XP</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '120px' }}>Práctica</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '100px' }}>Tareas</CTableHeaderCell>
                    <CTableHeaderCell style={{ width: '150px' }}>Logros</CTableHeaderCell>
                  </CTableRow>
                </CTableHead>
                <CTableBody>
                  {leaderboard.length > 0 ? (
                    leaderboard.map((entry) => (
                      <CTableRow
                        key={entry.student_id}
                        className={entry.isCurrentUser ? 'table-primary fw-bold' : ''}
                      >
                        <CTableDataCell>
                          <CBadge color={getRankColor(entry.rank)} className="fs-6">
                            {entry.rank}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div className="d-flex align-items-center gap-2">
                            <CIcon icon={cilUser} className="text-medium-emphasis" />
                            <div>
                              <div className="fw-semibold">
                                {entry.profiles?.full_name || 'Desconocido'}
                              </div>
                              <small className="text-medium-emphasis">
                                {entry.profiles?.instrument} • {entry.profiles?.level}
                              </small>
                            </div>
                          </div>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CBadge color="primary">Nivel {entry.level}</CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <span className="fw-semibold">{entry.xp?.toLocaleString() || 0} XP</span>
                        </CTableDataCell>
                        <CTableDataCell>
                          <span className="fw-semibold">
                            {entry.total_practice_minutes || 0} min
                          </span>
                        </CTableDataCell>
                        <CTableDataCell>
                          <span className="fw-semibold">{entry.tasks_completed || 0}</span>
                        </CTableDataCell>
                        <CTableDataCell>
                          <div className="d-flex flex-wrap gap-1">
                            {(entry.badges || []).slice(0, 4).map((badgeKey) => (
                              <CBadge
                                key={badgeKey}
                                color="info"
                                variant="outline"
                                className="fs-7"
                                title={getBadgeName(badgeKey)}
                              >
                                <CIcon icon={getBadgeIcon(badgeKey)} size="xs" className="me-1" />
                                {getBadgeName(badgeKey).substring(0, 12)}
                              </CBadge>
                            ))}
                            {(entry.badges || []).length > 4 && (
                              <CBadge color="secondary" variant="outline" className="fs-7">
                                +{(entry.badges || []).length - 4}
                              </CBadge>
                            )}
                          </div>
                        </CTableDataCell>
                      </CTableRow>
                    ))
                  ) : (
                    <CTableRow>
                      <CTableDataCell colSpan={7} className="text-center text-medium-emphasis py-5">
                        No hay datos para mostrar
                      </CTableDataCell>
                    </CTableRow>
                  )}
                </CTableBody>
              </CTable>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Tu posición */}
      <CRow className="mb-4">
        <CCol lg={4} className="mb-3">
          <CCard className="h-100 text-center">
            <CCardHeader>Tu posición</CCardHeader>
            <CCardBody>
              <div className="fs-1 fw-bold text-primary">
                {leaderboard.find((e) => e.isCurrentUser)?.rank || '—'}
              </div>
              <div className="text-medium-emphasis">de {leaderboard.length} estudiantes</div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol lg={4} className="mb-3">
          <CCard className="h-100 text-center">
            <CCardHeader>Tu nivel</CCardHeader>
            <CCardBody>
              <div className="fs-1 fw-bold text-primary">
                Nivel {leaderboard.find((e) => e.isCurrentUser)?.level || 1}
              </div>
              <div className="text-medium-emphasis">
                {leaderboard.find((e) => e.isCurrentUser)?.xp || 0} XP
              </div>
            </CCardBody>
          </CCard>
        </CCol>
        <CCol lg={4} className="mb-3">
          <CCard className="h-100 text-center">
            <CCardHeader>Logros desbloqueados</CCardHeader>
            <CCardBody>
              <div className="fs-1 fw-bold text-warning">
                {leaderboard.find((e) => e.isCurrentUser)?.badges?.length || 0}
              </div>
              <div className="text-medium-emphasis">
                de{' '}
                {
                  Object.keys({
                    first_task: 1,
                    tasks_10: 1,
                    tasks_50: 1,
                    tasks_100: 1,
                    first_course: 1,
                    courses_5: 1,
                    week_streak: 1,
                    month_streak: 1,
                    century_streak: 1,
                  }).length
                }{' '}
                posibles
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>

      {/* Detalle de logros */}
      <CRow className="mb-4">
        <CCol>
          <CCard>
            <CCardHeader>Catálogo de logros</CCardHeader>
            <CCardBody>
              <div className="row g-3">
                {badgeDefinitions.map((badge) => {
                  const earned = leaderboard
                    .find((e) => e.isCurrentUser)
                    ?.badges?.includes(badge.key)
                  return (
                    <CCol key={badge.key} xs={6} md={4} lg={3}>
                      <div
                        className={`badge-catalog ${earned ? '' : 'opacity-50'}`}
                        style={{ cursor: 'default' }}
                      >
                        <div
                          className="text-center p-3 rounded"
                          style={{
                            backgroundColor: earned
                              ? 'var(--cui-body-bg)'
                              : 'var(--cui-secondary-bg)',
                          }}
                        >
                          <CIcon
                            icon={badge.icon}
                            size="xl"
                            className={`text-${badge.color} mb-2`}
                          />
                          <div className="fw-semibold small">{badge.name}</div>
                          <div className="text-medium-emphasis small">{badge.desc}</div>
                          <div className="mt-2">
                            {earned ? (
                              <CBadge color="success">Desbloqueado</CBadge>
                            ) : (
                              <CBadge color="secondary">Bloqueado</CBadge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CCol>
                  )
                })}
              </div>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </>
  )
}

export default Leaderboard
