import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'

const useSupabaseLessons = (studentId) => {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLessons = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('lessons')
      .select('*')
      .order('lesson_date', { ascending: true })

    if (studentId) {
      query = query.eq('student_id', studentId)
    }

    const { data, error } = await query
    if (!error && data) {
      setLessons(data)
    }
    setLoading(false)
  }, [studentId])

  useEffect(() => {
    fetchLessons()
  }, [fetchLessons])

  return { lessons, loading, refetch: fetchLessons }
}

export default useSupabaseLessons
