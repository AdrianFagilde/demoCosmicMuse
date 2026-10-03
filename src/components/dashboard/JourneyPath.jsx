import React, { useMemo } from 'react'
import CIcon from '@coreui/icons-react'
import { cilMusicNote, cilBook, cilStar, cilBan, cilCheck } from '@coreui/icons'
import { getInstrumentColor } from '../../utils/colors'

const NODE_ICONS = {
  piano: cilMusicNote,
  teclado: cilMusicNote,
  guitarra: cilMusicNote,
  violín: cilMusicNote,
  violin: cilMusicNote,
  canto: cilMusicNote,
  voz: cilMusicNote,
  batería: cilMusicNote,
  bateria: cilMusicNote,
  bajo: cilMusicNote,
  flauta: cilMusicNote,
  saxofon: cilMusicNote,
  saxofón: cilMusicNote,
  trompeta: cilMusicNote,
  ukelele: cilMusicNote,
  percusion: cilMusicNote,
  percusión: cilMusicNote,
  default: cilMusicNote,
}

const NODE_STATE_LABEL = {
  completed: 'Completado',
  current: 'En curso',
  locked: 'Bloqueado',
}

const JourneyPath = ({ courses, myProgressRows, onViewCourse, onViewAll }) => {
  const pathNodes = useMemo(() => {
    if (!courses?.length)
      return [
        {
          type: 'empty',
          label: 'Sin cursos',
          sub: 'Tu profesor te inscribirá',
        },
      ]

    const enrolled = courses.filter((c) => c.course_enrollments?.some((e) => e.student_id))

    if (!enrolled.length)
      return [
        {
          type: 'empty',
          label: 'Sin cursos',
          sub: 'Tu profesor te inscribirá',
        },
      ]

    return enrolled.map((course, index) => {
      const tasks = course.course_tasks || []
      const allItems = tasks.flatMap((t) => t.task_checklist_items || [])
      const doneItems = allItems.filter((item) =>
        myProgressRows?.some((p) => p.item_id === item.id),
      ).length
      const totalItems = allItems.length
      const percent = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0

      const isCompleted = percent >= 100
      const isCurrent =
        !isCompleted &&
        index ===
          enrolled.findIndex((c) => {
            const cTasks = c.course_tasks || []
            const cItems = cTasks.flatMap((t) => t.task_checklist_items || [])
            const cDone = cItems.filter((item) =>
              myProgressRows?.some((p) => p.item_id === item.id),
            ).length
            return cItems.length > 0 && cDone < cItems.length
          })

      return {
        type: isCompleted ? 'completed' : isCurrent ? 'current' : 'locked',
        id: course.id,
        label: course.title,
        sub: course.instrument || 'General',
        percent,
        doneItems,
        totalItems,
        instrument: course.instrument,
        color: getInstrumentColor(course.instrument),
        icon:
          NODE_ICONS[
            course.instrument
              ?.toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
          ] || cilMusicNote,
        onClick: () => onViewCourse?.(course.id),
      }
    })
  }, [courses, myProgressRows, onViewCourse])

  if (pathNodes.length === 0) return null

  return (
    <div className="app-card app-card-compact h-100 d-flex flex-column justify-content-center">
      <div className="d-flex justify-content-between align-items-center mb-3 px-2">
        <span className="fw-semibold d-flex align-items-center gap-2">
          <CIcon icon={cilBook} className="text-primary" size="lg" aria-hidden="true" />
          Mi camino musical
        </span>
        <button className="btn btn-sm btn-outline-primary" onClick={onViewAll} type="button">
          <CIcon icon={cilStar} className="me-1" size="sm" aria-hidden="true" /> Ver todo
        </button>
      </div>

      <div className="journey-path" role="list" aria-label="Ruta de aprendizaje">
        {pathNodes.map((node, index) => (
          <div
            key={node.id || index}
            className={`journey-node ${node.type} ${node.onClick ? 'journey-node--clickable' : ''}`}
            style={{ '--node-color': node.color }}
            role="listitem"
            onClick={node.onClick}
          >
            <div className="journey-node-icon">
              {node.type === 'completed' ? (
                <CIcon icon={cilCheck} size="xl" color="white" aria-hidden="true" />
              ) : node.type === 'current' ? (
                <CIcon icon={node.icon} size="xl" color="white" aria-hidden="true" />
              ) : (
                <CIcon icon={cilBan} size="xl" color="var(--cui-text-muted)" aria-hidden="true" />
              )}
            </div>
            <div className="journey-node-label">
              {node.label}
              {/* El icono y el color de fondo eran el unico aviso de si el
                  curso estaba completado, en curso o bloqueado. Con el icono
                  oculto hace falta el estado en texto para no perderlo. */}
              {NODE_STATE_LABEL[node.type] && (
                <span className="visually-hidden">. {NODE_STATE_LABEL[node.type]}</span>
              )}
            </div>
            {node.sub && <div className="journey-node-sub">{node.sub}</div>}
            {node.type !== 'locked' && node.totalItems > 0 && (
              <div className="journey-node-sub">
                {node.doneItems}/{node.totalItems} • {node.percent}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default JourneyPath
