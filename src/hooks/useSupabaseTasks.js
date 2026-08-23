import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'
import { notifyInApp } from '../utils/notifications'

const useSupabaseTasks = (userId) => {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTasks = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('tasks')
      .select(
        '*, profiles!tasks_student_id_fkey(full_name), assigned_by_profile:profiles!tasks_assigned_by_fkey(full_name)',
      )
      .order('created_at', { ascending: false })
    if (fetchError) {
      setError(fetchError)
      console.error('[Tasks] Error:', fetchError.message, fetchError)
    } else {
      setError(null)
      setTasks(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      await fetchTasks()
    })()
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
        await notifyInApp({
          senderId: taskData.assignedBy || null,
          recipients: [{ id: taskData.studentId }],
          title: 'Nueva tarea asignada',
          message: `Se te asignó la tarea: ${taskData.title}`,
        })
        await fetchTasks()
      }
      return !error
    },
    [fetchTasks],
  )

  const updateTask = useCallback(async (taskId, updates) => {
    const { error } = await supabase
      .from('tasks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', taskId)
    if (!error) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)))
    }
    return !error
  }, [])

  const deleteTask = useCallback(async (taskId) => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId)
    if (!error) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
    }
    return !error
  }, [])

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

  return {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    deleteTask,
    changeTaskStatus,
    changeTaskProgress,
    refetch: fetchTasks,
  }
}

export default useSupabaseTasks
