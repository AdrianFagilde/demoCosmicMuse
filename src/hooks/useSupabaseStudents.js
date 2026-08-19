import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'

const useSupabaseStudents = () => {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    console.log('[Students] Fetching students...')
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student')
      .order('full_name')
    if (error) {
      console.error('[Students] Error:', error.message, error)
    }
    console.log('[Students] Profiles returned:', data?.length ?? 0, data)
    if (!error && data) {
      setStudents(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  const getStudent = useCallback(
    (id) => students.find((s) => String(s.id) === String(id)),
    [students],
  )

  const updateStudentMetrics = useCallback(
    async (id, progress, attendance) => {
      const { error } = await supabase
        .from('profiles')
        .update({ progress: Number(progress), attendance: Number(attendance), updated_at: new Date().toISOString() })
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
    },
    [],
  )

  const getSummary = useCallback(async () => {
    const { count: activeStudents } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student')
      .eq('status', 'Activo')

    const { data: instruments } = await supabase.from('instruments').select('name')

    const { count: lessonsThisWeek } = await supabase
      .from('lessons')
      .select('*', { count: 'exact', head: true })

    return {
      activeStudents: activeStudents || 0,
      lessonsThisWeek: lessonsThisWeek || 0,
      teachers: 5,
      availableInstruments: instruments?.map((i) => i.name) || [],
    }
  }, [])

  return { students, loading, getStudent, updateStudentMetrics, getSummary, refetch: fetchStudents }
}

export default useSupabaseStudents
