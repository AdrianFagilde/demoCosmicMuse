import React, { useMemo } from 'react'
import { CCard, CCardBody, CCardHeader } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilClock } from '@coreui/icons'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const WeeklySparkline = ({ weeklySummary, onStartPractice }) => {
  const chartData = useMemo(() => {
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(startDate.getDate() - 6)

    const data = []
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      const dayData = weeklySummary?.find((w) => w.day === dateStr)
      data.push({
        day: DAYS[d.getDay()],
        minutes: dayData?.minutes || 0,
        sessions: dayData?.sessions || 0,
        date: dateStr,
        isToday: d.toDateString() === today.toDateString(),
      })
    }
    return data
  }, [weeklySummary])

  const maxMinutes = useMemo(() => Math.max(...chartData.map((d) => d.minutes), 1), [chartData])
  const hasData = chartData.some((d) => d.minutes > 0)

  if (!hasData) {
    return (
      <CCard className="h-100 weekly-sparkline-card">
        <CCardHeader className="d-flex justify-content-between align-items-center py-2">
          <span className="fw-semibold d-flex align-items-center gap-2">
            <CIcon icon={cilClock} className="text-info" />
            Práctica semanal
          </span>
        </CCardHeader>
        <CCardBody className="text-center py-4">
          <CIcon icon={cilClock} size="lg" className="text-medium-emphasis mb-2" />
          <p className="mb-2">Sin práctica esta semana</p>
          <button className="btn btn-primary btn-sm" onClick={onStartPractice} type="button">
            <CIcon icon={cilClock} className="me-1" /> Iniciar sesión
          </button>
        </CCardBody>
      </CCard>
    )
  }

  return (
    <CCard className="h-100 weekly-sparkline-card">
      <CCardHeader className="d-flex justify-content-between align-items-center py-2">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilClock} className="text-info" />
          Práctica semanal (min)
        </span>
      </CCardHeader>
      <CCardBody className="py-3">
        <div
          className="d-flex align-items-end justify-content-around h-100"
          style={{ minHeight: '120px' }}
        >
          {chartData.map((d, i) => (
            <div
              key={d.date}
              className="sparkline-bar-container"
              style={{ flex: 1, maxWidth: '40px' }}
            >
              <div
                className="sparkline-bar"
                style={{
                  height: `${Math.max(4, (d.minutes / maxMinutes) * 100)}%`,
                  backgroundColor: d.isToday
                    ? 'var(--cui-primary)'
                    : d.minutes > 0
                      ? 'var(--cui-info)'
                      : 'var(--cui-border-color)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 0.3s ease, background-color 0.2s',
                  cursor: 'default',
                }}
                title={`${d.day} ${d.date}: ${d.minutes} min (${d.sessions} sesiones)`}
              />
              <span className="sparkline-label small text-medium-emphasis mt-1 d-block text-center">
                {d.day}
              </span>
              {d.minutes > 0 && (
                <span
                  className="sparkline-value small fw-semibold d-block text-center"
                  style={{ fontSize: '0.7rem' }}
                >
                  {d.minutes}′
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="sparkline-legend d-flex justify-content-center gap-3 mt-3 flex-wrap">
          <span className="small text-medium-emphasis">
            Total: {chartData.reduce((s, d) => s + d.minutes, 0)} min
          </span>
          <span className="small text-medium-emphasis">
            {chartData.filter((d) => d.minutes > 0).length}/7 días activos
          </span>
        </div>
      </CCardBody>
    </CCard>
  )
}

export default WeeklySparkline
