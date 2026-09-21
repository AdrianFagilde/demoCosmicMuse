import { useCallback } from 'react'
import supabase from '../lib/supabase'
import useSupabaseQuery from './useSupabaseQuery'

const EMPTY_STREAK = { current_streak: 0, longest_streak: 0, last_practice_date: null }

const useSupabasePractice = (studentId) => {
  const fetchAll = useCallback(async () => {
    if (!studentId) return { sessions: [], streak: EMPTY_STREAK, weeklySummary: [] }

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

  const { data, setData, loading, error, refetch } = useSupabaseQuery(fetchAll)

  const startPractice = useCallback(
    async (options = {}) => {
      if (!studentId) return null

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

      setData((prev) => ({ ...prev, sessions: [session, ...(prev?.sessions || [])] }))
      return session
    },
    [studentId, setData],
  )

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

      setData((prev) => ({
        ...prev,
        sessions: (prev?.sessions || []).map((s) => (s.id === sessionId ? updated : s)),
      }))
      await refetch()
      return updated
    },
    [setData, refetch],
  )

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
    updatePracticeNotes,
    deletePractice,
    refetch,
  }
}

export default useSupabasePractice
