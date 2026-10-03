import {
  cilCheckCircle,
  cilList,
  cilStar,
  cilDiamond,
  cilEducation,
  cilSchool,
  cilFire,
} from '@coreui/icons'

/**
 * Formulas de nivel compartidas con la base de datos.
 *
 * El trigger update_student_gamification (013/016) calcula:
 *   level = floor(sqrt(xp / 100)) + 1
 * Estas funciones replican exactamente esa formula para pintar la barra de
 * progreso al siguiente nivel sin otra consulta.
 */
export const XP_PER_LEVEL_BASE = 100

export const levelFromXp = (xp = 0) =>
  Math.floor(Math.sqrt(Math.max(0, xp) / XP_PER_LEVEL_BASE)) + 1

export const xpForLevel = (level = 1) => Math.pow(Math.max(0, level - 1), 2) * XP_PER_LEVEL_BASE

export const getLevelProgress = (xp = 0) => {
  const level = levelFromXp(xp)
  const current = xpForLevel(level)
  const next = xpForLevel(level + 1)
  const span = next - current || 1
  const intoLevel = Math.max(0, xp - current)

  return {
    level,
    current,
    next,
    intoLevel,
    remaining: Math.max(0, next - xp),
    percent: Math.min(100, Math.round((intoLevel / span) * 100)),
  }
}

// Catalogo de badges. `get_next_badges` (RPC) ya devuelve nombre y descripcion
// de los proximos, pero las insignias YA ganadas solo guardan badge_key en
// student_badges, asi que necesitan este mapa para pintarse.
export const BADGE_CATALOG = {
  first_task: {
    name: 'Primera tarea',
    description: 'Completa tu primera tarea',
    icon: cilCheckCircle,
    color: '#22c55e',
  },
  tasks_10: {
    name: '10 tareas',
    description: 'Completa 10 tareas',
    icon: cilList,
    color: '#16c1d6',
  },
  tasks_50: {
    name: '50 tareas',
    description: 'Completa 50 tareas',
    icon: cilStar,
    color: '#712771',
  },
  tasks_100: {
    name: '100 tareas',
    description: 'Completa 100 tareas',
    icon: cilDiamond,
    color: '#b42d75',
  },
  first_course: {
    name: 'Primer curso',
    description: 'Completa tu primer curso',
    icon: cilEducation,
    color: '#22c55e',
  },
  courses_5: {
    name: '5 cursos',
    description: 'Completa 5 cursos',
    icon: cilSchool,
    color: '#712771',
  },
  week_streak: {
    name: 'Racha de 7 días',
    description: 'Practica 7 días seguidos',
    icon: cilFire,
    color: '#f59e0b',
  },
  month_streak: {
    name: 'Racha de 30 días',
    description: 'Practica 30 días seguidos',
    icon: cilFire,
    color: '#b42d75',
  },
  century_streak: {
    name: 'Racha de 100 días',
    description: 'Practica 100 días seguidos',
    icon: cilStar,
    color: '#ef4444',
  },
}

const DEFAULT_BADGE = {
  name: 'Logro',
  description: '',
  icon: cilStar,
  color: '#64748b',
}

export const getBadge = (key) =>
  BADGE_CATALOG[key] || { ...DEFAULT_BADGE, name: key || DEFAULT_BADGE.name }
