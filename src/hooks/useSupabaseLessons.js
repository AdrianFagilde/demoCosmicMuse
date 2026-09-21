import { useCallback } from 'react'
import supabase from '../lib/supabase'
import { notifyInApp } from '../utils/notifications'
import useSupabaseQuery from './useSupabaseQuery'

const useSupabaseLessons = (studentId) => {
  const fetchLessons = useCallback(async () => {
    let query = supabase
      .from('lessons')
      .select('*, profiles!lessons_student_id_fkey(full_name)')
      .order('lesson_date', { ascending: true })

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data, error } = await query
    if (error) {
      console.error('[Lessons] Error:', error.message, error)
      throw error
    }
    return data || []
  }, [studentId])

  const {
    data: lessons,
    setData: setLessons,
    loading,
    error,
    refetch,
  } = useSupabaseQuery(fetchLessons)

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
        await refetch()
      }
      return !error
    },
    [refetch],
  )

  const updateLesson = useCallback(
    async (lessonId, updates) => {
      const { error } = await supabase.from('lessons').update(updates).eq('id', lessonId)
      if (!error) {
        await refetch()
      }
      return !error
    },
    [refetch],
  )

  const deleteLesson = useCallback(
    async (lessonId) => {
      const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
      if (!error) {
        setLessons((prev) => prev.filter((l) => l.id !== lessonId))
      }
      return !error
    },
    [setLessons],
  )

  return { lessons, loading, error, addLesson, updateLesson, deleteLesson, refetch }
}

export default useSupabaseLessons
