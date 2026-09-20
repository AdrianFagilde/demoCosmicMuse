import React, { useMemo } from 'react'
import CIcon from '@coreui/icons-react'
import { cilClock, cilFire } from '@coreui/icons'
import { getInstrumentColor } from '../../utils/colors'

const DAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']
const DAYS_FULL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const WeeklyDots = ({ weeklySummary, instrumentColor, onStartPractice }) => {
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
        dayFull: DAYS_FULL[d.getDay()],
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
  const activeDays = chartData.filter((d) => d.minutes > 0).length
  const totalMinutes = chartData.reduce((s, d) => s + d.minutes, 0)

  if (!hasData) {
    return (
      <div className="dash-card dash-card-compact mb-4 text-center py-4">
        <CIcon icon={cilClock} size="xl" className="text-medium-emphasis mb-2" />
        <div className="fw-semibold mb-1">Sin práctica esta semana</div>
        <div className="text-medium-emphasis small mb-3">Comienza tu racha hoy</div>
        <button className="btn btn-primary btn-sm" onClick={onStartPractice} type="button">
          <CIcon icon={cilFire} className="me-1" size="sm" /> Primera sesión
        </button>
      </div>
    )
  }

  return (
    <div className="dash-card dash-card-compact mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilClock} className="text-info" size="lg" />
          Semana
        </span>
        <div className="d-flex align-items-center gap-3 text-medium-emphasis small">
          <span>{totalMinutes} min total</span>
          <span>{activeDays}/7 días</span>
        </div>
      </div>

      <div className="weekly-dots" role="img" aria-label="Práctica semanal">
        {chartData.map((d, i) => (
          <div key={d.date} className="weekly-dot" style={{ '--dot-color': instrumentColor }}>
            <div
              className={`weekly-dot-bar ${d.isToday ? 'today' : ''} ${d.minutes > 0 ? 'active' : ''}`}
              style={{
                height: `${Math.max(8, (d.minutes / maxMinutes) * 55)}px`,
                background: d.isToday
                  ? 'var(--cui-primary)'
                  : d.minutes > 0
                    ? instrumentColor
                    : 'var(--cui-border-color)',
              }}
              title={`${d.dayFull} ${d.date}: ${d.minutes} min (${d.sessions} sesiones)`}
            />
            <span className="weekly-dot-label">{d.day}</span>
            {d.minutes > 0 && d.isToday && (
              <span
                className="badge bg-primary"
                style={{ fontSize: '0.55rem', padding: '1px 4px' }}
              >
                Hoy
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
        <button className="btn btn-outline-primary btn-sm" onClick={onStartPractice} type="button">
          <CIcon icon={cilFire} className="me-1" size="sm" /> Practicar
        </button>
        <div className="text-medium-emphasis small">Meta: 30 min/día</div>
      </div>
    </div>
  )
}

export default WeeklyDots
