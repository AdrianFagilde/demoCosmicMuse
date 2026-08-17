import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'

const useSupabaseTasks = (userId) => {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, profiles!tasks_student_id_fkey(full_name), assigned_by_profile:profiles!tasks_assigned_by_fkey(full_name)')
      .order('created_at', { ascending: false })
    if (!error && data) {
      setTasks(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const addTask = useCallback(
    async (taskData) => {
      const { error } = await supabase.from('tasks').insert({
        title: taskData.title,
        description: taskData.description || '',
        student_id: taskData.studentId,
        assigned_by: taskData.assignedBy,
        due_date: taskData.dueDate,
        status: taskData.status || 'Pendiente',
        progress: taskData.progress || 0,
      })
      if (!error) {
        await fetchTasks()
      }
      return !error
    },
    [fetchTasks],
  )

  const updateTask = useCallback(
    async (taskId, updates) => {
      const { error } = await supabase
        .from('tasks')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', taskId)
      if (!error) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
        )
      }
      return !error
    },
    [],
  )

  const deleteTask = useCallback(
    async (taskId) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (!error) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
      }
      return !error
    },
    [],
  )

  const changeTaskStatus = useCallback(
    async (taskId, status) => {
      return updateTask(taskId, {
        status,
        progress: status === 'Completado' ? 100 : undefined,
      })
    },
    [updateTask],
  )

  const changeTaskProgress = useCallback(
    async (taskId, value) => {
      const num = Number(value)
      return updateTask(taskId, {
        progress: num,
        status: num === 100 ? 'Completado' : undefined,
      })
    },
    [updateTask],
  )

  return { tasks, loading, addTask, updateTask, deleteTask, changeTaskStatus, changeTaskProgress, refetch: fetchTasks }
}

export default useSupabaseTasks
