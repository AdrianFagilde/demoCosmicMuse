import { useCallback } from 'react'
import supabase from '../lib/supabase'
import { notifyInApp } from '../utils/notifications'
import useSupabaseQuery from './useSupabaseQuery'

const useSupabaseTasks = () => {
  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(
        '*, profiles!tasks_student_id_fkey(full_name), assigned_by_profile:profiles!tasks_assigned_by_fkey(full_name)',
      )
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[Tasks] Error:', error.message, error)
      throw error
    }
    return data || []
  }, [])

  const { data: tasks, setData: setTasks, loading, error, refetch } = useSupabaseQuery(fetchTasks)

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
        await refetch()
      }
      return !error
    },
    [refetch],
  )

  const cleanUpdates = (updates) => {
    const cleaned = {}
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) cleaned[key] = value
    })
    return cleaned
  }

  const updateTask = useCallback(
    async (taskId, updates) => {
      const cleaned = cleanUpdates(updates)
      const { error } = await supabase
        .from('tasks')
        .update({ ...cleaned, updated_at: new Date().toISOString() })
        .eq('id', taskId)
      if (!error) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...cleaned } : t)))
      }
      return !error
    },
    [setTasks],
  )

  const deleteTask = useCallback(
    async (taskId) => {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (!error) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId))
      }
      return !error
    },
    [setTasks],
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
      if (Number.isNaN(num)) return false
      const clamped = Math.min(100, Math.max(0, Math.round(num)))
      return updateTask(taskId, {
        progress: clamped,
        status: clamped === 100 ? 'Completado' : undefined,
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
    refetch,
  }
}

export default useSupabaseTasks
