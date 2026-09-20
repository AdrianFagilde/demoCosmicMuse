import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'

const useSupabasePractice = (studentId) => {
  const [sessions, setSessions] = useState([])
  const [streak, setStreak] = useState({
    current_streak: 0,
    longest_streak: 0,
    last_practice_date: null,
  })
  const [weeklySummary, setWeeklySummary] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!studentId) return

    try {
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

      setSessions(sessionsData || [])
      setStreak(streakData || { current_streak: 0, longest_streak: 0, last_practice_date: null })
      setWeeklySummary(weeklyData || [])
      setError(null)
    } catch (err) {
      console.error('[Practice] Fetch error:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [studentId])

  useEffect(() => {
    if (studentId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAll()
    }
  }, [studentId, fetchAll])

  const startPractice = useCallback(
    async (options = {}) => {
      if (!studentId) return null

      const { data, error } = await supabase
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

      setSessions((prev) => [data, ...prev])
      return data
    },
    [studentId],
  )

  const endPractice = useCallback(
    async (sessionId) => {
      const { data, error } = await supabase
        .from('practice_sessions')
        .update({ ended_at: new Date().toISOString() })
        .eq('id', sessionId)
        .select()
        .single()

      if (error) {
        console.error('[Practice] End error:', error.message)
        return null
      }

      setSessions((prev) => prev.map((s) => (s.id === sessionId ? data : s)))
      await fetchAll()
      return data
    },
    [fetchAll],
  )

  const updatePracticeNotes = useCallback(async (sessionId, notes) => {
    const { error } = await supabase.from('practice_sessions').update({ notes }).eq('id', sessionId)

    if (!error) {
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? { ...s, notes } : s)))
    }
    return !error
  }, [])

  const deletePractice = useCallback(async (sessionId) => {
    const { error } = await supabase.from('practice_sessions').delete().eq('id', sessionId)

    if (!error) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    }
    return !error
  }, [])

  return {
    sessions,
    streak,
    weeklySummary,
    loading,
    error,
    startPractice,
    endPractice,
    updatePracticeNotes,
    deletePractice,
    refetch: fetchAll,
  }
}

export default useSupabasePractice
