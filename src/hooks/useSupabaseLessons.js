import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'
import { notifyInApp } from '../utils/notifications'

const useSupabaseLessons = (studentId) => {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchLessons = useCallback(async () => {
    let query = supabase
      .from('lessons')
      .select('*, profiles!lessons_student_id_fkey(full_name)')
      .order('lesson_date', { ascending: true })

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data, error: fetchError } = await query
    if (fetchError) {
      setError(fetchError)
      console.error('[Lessons] Error:', fetchError.message, fetchError)
    } else {
      setError(null)
      setLessons(data || [])
    }
    setLoading(false)
  }, [studentId])

  useEffect(() => {
    ;(async () => {
      await fetchLessons()
    })()
  }, [fetchLessons])

  const addLesson = useCallback(
    async (lessonData) => {
      const { error } = await supabase.from('lessons').insert({
        student_id: lessonData.studentId,
        instrument: lessonData.instrument,
        lesson_date: lessonData.lessonDate,
        lesson_time: lessonData.lessonTime,
        duration: lessonData.duration,
        teacher: lessonData.teacher,
      })
      if (!error) {
        await notifyInApp({
          senderId: lessonData.createdBy || null,
          recipients: [{ id: lessonData.studentId }],
          title: 'Nueva clase programada',
          message: `Clase de ${lessonData.instrument} el ${lessonData.lessonDate} a las ${lessonData.lessonTime?.slice(0, 5)}`,
        })
        await fetchLessons()
      }
      return !error
    },
    [fetchLessons],
  )

  const updateLesson = useCallback(
    async (lessonId, updates) => {
      const { error } = await supabase.from('lessons').update(updates).eq('id', lessonId)
      if (!error) {
        await fetchLessons()
      }
      return !error
    },
    [fetchLessons],
  )

  const deleteLesson = useCallback(async (lessonId) => {
    const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
    if (!error) {
      setLessons((prev) => prev.filter((l) => l.id !== lessonId))
    }
    return !error
  }, [])

  return { lessons, loading, error, addLesson, updateLesson, deleteLesson, refetch: fetchLessons }
}

export default useSupabaseLessons
