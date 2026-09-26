import { useCallback, useEffect, useRef } from 'react'
import supabase from '../lib/supabase'
import useSupabaseQuery from './useSupabaseQuery'

const EMPTY_STREAK = { current_streak: 0, longest_streak: 0, last_practice_date: null }
const EMPTY_PRACTICE = { sessions: [], streak: EMPTY_STREAK, weeklySummary: [] }

const useSupabasePractice = (studentId) => {
  const fetchAll = useCallback(async () => {
    if (!studentId) return EMPTY_PRACTICE

    const [
      { data: sessionsData, error: sessionsError },
      { data: streakData, error: streakError },
      { data: weeklyData, error: weeklyError },
    ] = await Promise.all([
      supabase
        .from('practice_sessions')
        .select('*')
        .eq('student_id', studentId)
        .order('started_at', { ascending: false })
        .limit(50),
      supabase.from('practice_streaks').select('*').eq('student_id', studentId).single(),
      supabase.rpc('get_weekly_practice_summary', { p_student_id: studentId }),
    ])

    if (sessionsError) console.error('[Practice] Sessions error:', sessionsError.message)
    if (streakError && streakError.code !== 'PGRST116')
      console.error('[Practice] Streak error:', streakError.message)
    if (weeklyError) console.error('[Practice] Weekly error:', weeklyError.message)

    return {
      sessions: sessionsData || [],
      streak: streakData || EMPTY_STREAK,
      weeklySummary: weeklyData || [],
    }
  }, [studentId])

  const { data, setData, loading, error, refetch } = useSupabaseQuery(
    fetchAll,
    true,
    EMPTY_PRACTICE,
  )

  // Sesion abierta en curso, para poder cerrarla al desmontar sin depender
  // de que la vista la haya guardado.
  const openSessionId = useRef(null)

  const endPractice = useCallback(
    async (sessionId) => {
      const { data: updated, error } = await supabase
        .from('practice_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single()

      if (error) {
        console.error('[Practice] End error:', error.message)
        return null
      }

      if (openSessionId.current === sessionId) openSessionId.current = null

      setData((prev) => ({
        ...prev,
        sessions: (prev?.sessions || []).map((s) => (s.id === sessionId ? updated : s)),
      }))
      await refetch()
      return updated
    },
    [setData, refetch],
  )

  // Cierra la sesion abierta mas reciente de este alumno.
  const stopPractice = useCallback(async () => {
    if (!studentId) return null
    const { data: open, error: openError } = await supabase
      .from('practice_sessions')
      .select('id')
      .eq('student_id', studentId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (openError) {
      console.error('[Practice] No se pudo leer la sesion abierta:', openError.message)
      return null
    }
    if (!open) return null
    return endPractice(open.id)
  }, [studentId, endPractice])

  const startPractice = useCallback(
    async (options = {}) => {
      if (!studentId) return null

      // Sin esto, cada pulsacion de "Practicar" dejaba una sesion abierta
      // para siempre: duration_minutes se quedaba a null, no sumaba al
      // objetivo diario y la racha nunca avanzaba.
      await stopPractice()

      const { data: session, error } = await supabase
        .from('practice_sessions')
        .insert({
          student_id: studentId,
          task_id: options.taskId || null,
          course_task_id: options.courseTaskId || null,
          notes: options.notes || '',
          metronome_used: options.metronomeUsed || false,
          metronome_bpm: options.metronomeBpm || null,
        })
        .select()
        .single()

      if (error) {
        console.error('[Practice] Start error:', error.message)
        return null
      }

      openSessionId.current = session.id
      setData((prev) => ({ ...prev, sessions: [session, ...(prev?.sessions || [])] }))
      return session
    },
    [studentId, setData, stopPractice],
  )

  // Al desmontar se cierra lo que quedara abierto. Sin esto, recargar o
  // navegar lejos dejaba sesiones huerfanas sin ended_at.
  useEffect(() => {
    return () => {
      const sessionId = openSessionId.current
      if (!sessionId) return
      openSessionId.current = null
      supabase
        .from('practice_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .then(({ error: closeError }) => {
          if (closeError) {
            console.error('[Practice] No se pudo cerrar la sesion:', closeError.message)
          }
        })
    }
  }, [])

  const updatePracticeNotes = useCallback(
    async (sessionId, notes) => {
      const { error } = await supabase
        .from('practice_sessions')
        .update({ notes })
        .eq('id', sessionId)

      if (!error) {
        setData((prev) => ({
          ...prev,
          sessions: (prev?.sessions || []).map((s) => (s.id === sessionId ? { ...s, notes } : s)),
        }))
      }
      return !error
    },
    [setData],
  )

  const deletePractice = useCallback(
    async (sessionId) => {
      const { error } = await supabase.from('practice_sessions').delete().eq('id', sessionId)

      if (!error) {
        setData((prev) => ({
          ...prev,
          sessions: (prev?.sessions || []).filter((s) => s.id !== sessionId),
        }))
      }
      return !error
    },
    [setData],
  )

  return {
    sessions: data?.sessions || [],
    streak: data?.streak || EMPTY_STREAK,
    weeklySummary: data?.weeklySummary || [],
    loading,
    error,
    startPractice,
    endPractice,
    stopPractice,
    updatePracticeNotes,
    deletePractice,
    refetch,
  }
}

export default useSupabasePractice
