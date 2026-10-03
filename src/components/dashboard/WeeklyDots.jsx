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
      <div className="app-card app-card-compact h-100 d-flex flex-column justify-content-center text-center py-4">
        <CIcon icon={cilClock} size="xl" className="text-medium-emphasis mb-2" aria-hidden="true" />
        <div className="fw-semibold mb-1">Sin práctica esta semana</div>
        <div className="text-medium-emphasis small mb-3">Comienza tu racha hoy</div>
        <button className="btn btn-primary btn-sm" onClick={onStartPractice} type="button">
          <CIcon icon={cilFire} className="me-1" size="sm" aria-hidden="true" /> Primera sesión
        </button>
      </div>
    )
  }

  return (
    <div className="app-card app-card-compact h-100 d-flex flex-column justify-content-center">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilClock} className="text-info" size="lg" aria-hidden="true" />
          Semana
        </span>
        <div className="d-flex align-items-center gap-3 text-medium-emphasis small">
          <span>{totalMinutes} min total</span>
          <span>{activeDays}/7 días</span>
        </div>
      </div>

      {/* role="img" + aria-label escondia los hijos, asi que el desglose por
          dia solo vivia en atributos title, que los lectores de pantalla no
          anuncian. El grafico visual queda como decoracion y los datos van en
          una lista oculta con la misma informacion. */}
      <div className="weekly-dots" aria-hidden="true">
        {chartData.map((d) => (
          <div key={d.date} className="weekly-dot" style={{ '--dot-color': instrumentColor }}>
            <div
              className={`weekly-dot-bar ${d.isToday ? 'today' : ''} ${d.minutes > 0 ? 'active' : ''}`}
              style={{
                height: `${Math.max(6, (d.minutes / maxMinutes) * 40)}px`,
              }}
              title={`${d.dayFull} ${d.date}: ${d.minutes} min (${d.sessions} sesiones)`}
            />
            <span className="weekly-dot-label">{d.day}</span>
            {d.minutes > 0 && d.isToday && (
              <span className="weekly-dot-badge badge bg-primary">Hoy</span>
            )}
          </div>
        ))}
      </div>

      <ul className="visually-hidden">
        <li>
          Práctica semanal: {totalMinutes} minutos en total, {activeDays} de 7 días con práctica.
        </li>
        {chartData.map((d) => (
          <li key={d.date}>
            {d.dayFull} {d.date}: {d.minutes} minutos, {d.sessions} sesiones
            {d.isToday ? ' (hoy)' : ''}.
          </li>
        ))}
      </ul>

      <div className="mt-3 pt-3 border-top text-center">
        <button className="btn btn-outline-primary btn-sm" onClick={onStartPractice} type="button">
          <CIcon icon={cilFire} className="me-1" size="sm" aria-hidden="true" /> Practicar
        </button>
      </div>
    </div>
  )
}

export default WeeklyDots
