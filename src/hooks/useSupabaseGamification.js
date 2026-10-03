import { useCallback } from 'react'
import supabase from '../lib/supabase'
import useSupabaseQuery from './useSupabaseQuery'

const EMPTY_GAMIFICATION = {
  xp: 0,
  level: 1,
  totalPracticeMinutes: 0,
  tasksCompleted: 0,
  coursesCompleted: 0,
  dailyGoalMinutes: 30,
  badges: [],
  nextBadges: [],
}

/**
 * Datos de gamificacion de un alumno: XP/nivel/minutos (student_gamification),
 * insignias ganadas (student_badges) y las proximas por desbloquear
 * (get_next_badges). El alumno solo puede leer lo suyo por RLS; el admin, todo.
 *
 * La fila de student_gamification puede no existir todavia (alumno sin
 * actividad), por eso se usa maybeSingle y se rellena con los valores por
 * defecto.
 */
const useSupabaseGamification = (studentId) => {
  const fetchAll = useCallback(async () => {
    if (!studentId) return EMPTY_GAMIFICATION

    const [
      { data: gamif, error: gamifError },
      { data: badges, error: badgesError },
      { data: nextBadges, error: nextError },
    ] = await Promise.all([
      supabase.from('student_gamification').select('*').eq('student_id', studentId).maybeSingle(),
      supabase
        .from('student_badges')
        .select('badge_key, earned_at')
        .eq('student_id', studentId)
        .order('earned_at', { ascending: false }),
      supabase.rpc('get_next_badges', { p_student_id: studentId }),
    ])

    if (gamifError) console.error('[Gamification] Error:', gamifError.message)
    if (badgesError) console.error('[Gamification] Badges error:', badgesError.message)
    if (nextError) console.error('[Gamification] Next badges error:', nextError.message)

    return {
      xp: gamif?.xp ?? 0,
      level: gamif?.level ?? 1,
      totalPracticeMinutes: gamif?.total_practice_minutes ?? 0,
      tasksCompleted: gamif?.tasks_completed ?? 0,
      coursesCompleted: gamif?.courses_completed ?? 0,
      dailyGoalMinutes: gamif?.daily_goal_minutes ?? 30,
      badges: badges || [],
      nextBadges: nextBadges || [],
    }
  }, [studentId])

  const { data, setData, loading, error, refetch } = useSupabaseQuery(
    fetchAll,
    true,
    EMPTY_GAMIFICATION,
  )

  return { ...data, loading, error, setData, refetch }
}

export default useSupabaseGamification
