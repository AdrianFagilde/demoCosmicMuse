import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'

const useSupabaseStudents = () => {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchStudents = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name')
    if (fetchError) {
      setError(fetchError)
      console.error('[Students] Error:', fetchError.message, fetchError)
    } else {
      setError(null)
      setStudents(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      await fetchStudents()
    })()
  }, [fetchStudents])

  const getStudent = useCallback(
    (id) => students.find((s) => String(s.id) === String(id)),
    [students],
  )

  const updateStudentMetrics = useCallback(async (id, progress, attendance) => {
    const { error } = await supabase
      .from('profiles')
      .update({
        progress: Number(progress),
        attendance: Number(attendance),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (!error) {
      setStudents((prev) =>
        prev.map((s) =>
          String(s.id) === String(id)
            ? { ...s, progress: Number(progress), attendance: Number(attendance) }
            : s,
        ),
      )
    }
    return !error
  }, [])

  const getSummary = useCallback(async () => {
    const { count: activeStudents } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .eq('status', 'Activo')

    const { data: instruments } = await supabase.from('instruments').select('name')

    const toIsoDate = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }
    const today = new Date()
    const weekEnd = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000)

    const { count: lessonsThisWeek } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })
      .gte('lesson_date', toIsoDate(today))
      .lte('lesson_date', toIsoDate(weekEnd))

    const { data: lessonTeachers } = await supabase.from('lessons').select('teacher')

    return {
      activeStudents: activeStudents || 0,
      lessonsThisWeek: lessonsThisWeek || 0,
      teachers: new Set((lessonTeachers || []).map((l) => l.teacher).filter(Boolean)).size,
      availableInstruments: instruments?.map((i) => i.name) || [],
    }
  }, [])

  return {
    students,
    loading,
    error,
    getStudent,
    updateStudentMetrics,
    getSummary,
    refetch: fetchStudents,
  }
}

export default useSupabaseStudents
