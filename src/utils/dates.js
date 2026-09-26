/**
 * Utilidades de fecha y urgencia compartidas por el dashboard.
 *
 * PostgREST devuelve las columnas DATE como 'YYYY-MM-DD'. `new Date('2026-09-25')`
 * las interpreta como medianoche UTC, mientras que `new Date().setHours(0,0,0,0)`
 * es medianoche local. En cualquier huso con desfase la diferencia supera medio día
 * y el redondeo del `Math.ceil` clasifica mal: una tarea que vence hoy aparece como
 * '1d' y una vencida ayer como 'Hoy'. Aqui se comparan en local.
 */

/** Medianoche local de hoy. */
export const startOfLocalDay = (date = new Date()) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Convierte un valor de Postgres a Date.
 * - 'YYYY-MM-DD' (columna DATE) -> medianoche LOCAL.
 * - ISO con hora (TIMESTAMPTZ)    -> se respeta el instante.
 */
export const parseDbDate = (value) => {
  if (!value) return null
  if (value instanceof Date) return value

  const raw = String(value)
  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return new Date(Number(y), Number(m) - 1, Number(d))
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Componente de fecha en local, para agrupar sin pasar por UTC. */
export const localDateKey = (value) => {
  const date = parseDbDate(value)
  if (!date) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Una fecha DATE está vencida si su día local es anterior al de hoy.
 * Comparar `new Date(due_date) < new Date()` marcaba como vencida cualquier
 * tarea del día en curso, porque la columna se lee como medianoche UTC.
 */
export const isOverdue = (dueDate) => {
  const due = parseDbDate(dueDate)
  if (!due) return false
  return startOfLocalDay(due) < startOfLocalDay()
}

const URGENCY = {
  none: { color: 'secondary', hex: '#64748b', label: 'Sin fecha' },
  overdue: { color: 'danger', hex: '#ef4444', label: 'Vencida' },
  today: { color: 'warning', hex: '#f59e0b', label: 'Hoy' },
  week: { color: 'info', hex: '#06b6d4' },
  future: { color: 'success', hex: '#22c55e' },
}

/**
 * Clasifica una fecha de entrega respecto a hoy, en dias naturales locales.
 * Devuelve el nombre de color de CoreUI, su equivalente hex (para CSS
 * custom properties) y la etiqueta que se muestra.
 */
export const getUrgency = (dueDate) => {
  const due = parseDbDate(dueDate)
  if (!due) return { ...URGENCY.none, variant: 'none', diffDays: undefined }

  const diffDays = Math.round((startOfLocalDay(due) - startOfLocalDay()) / 86400000)

  if (diffDays < 0) {
    return { ...URGENCY.overdue, hex: URGENCY.overdue.hex, variant: 'urgent-overdue', diffDays }
  }
  if (diffDays === 0) {
    return { ...URGENCY.today, variant: 'urgent-today', diffDays }
  }

  const level = diffDays <= 3 ? URGENCY.week : URGENCY.future
  return {
    ...level,
    label: `${diffDays}d`,
    variant: diffDays <= 3 ? 'urgent-week' : 'urgent-future',
    diffDays,
  }
}
