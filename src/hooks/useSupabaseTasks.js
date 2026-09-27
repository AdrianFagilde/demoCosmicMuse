import { useCallback } from 'react'
import supabase from '../lib/supabase'
import { notifyInApp } from '../utils/notifications'
import useSupabaseQuery from './useSupabaseQuery'

// course:courses!tasks_course_id_fkey solo viene relleno en tareas de curso.
// task_checklist_items alimenta el progreso real del alumno en el feed
// unificado: una tarea de curso no tiene status/progress propios.
const TASK_SELECT = `
  id,
  title,
  description,
  course_id,
  student_id,
  assigned_by,
  due_date,
  position,
  status,
  progress,
  created_at,
  updated_at,
  profiles!tasks_student_id_fkey(id, full_name),
  assigned_by_profile:profiles!tasks_assigned_by_fkey(id, full_name),
  course:courses!tasks_course_id_fkey(id, title),
  task_checklist_items(id)
`

const useSupabaseTasks = () => {
  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_SELECT)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[Tasks] Error:', error.message, error)
      throw error
    }

    const rows = data || []
    const itemIds = rows.flatMap((t) => (t.task_checklist_items || []).map((i) => i.id))
    if (itemIds.length === 0) return rows

    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id
    if (!userId) return rows

    const { data: progress, error: progressError } = await supabase
      .from('checklist_progress')
      .select('item_id')
      .eq('student_id', userId)
      .in('item_id', itemIds)
    if (progressError) {
      console.error('[Tasks] Checklist progress error:', progressError.message, progressError)
      return rows
    }

    const done = new Set((progress || []).map((p) => p.item_id))
    return rows.map((t) => {
      const items = t.task_checklist_items || []
      if (!t.course_id || items.length === 0) return t
      const completed = items.filter((i) => done.has(i.id)).length
      return {
        ...t,
        checklist_total: items.length,
        checklist_completed: completed,
        checklist_percent: Math.round((completed / items.length) * 100),
      }
    })
  }, [])

  const { data: tasks, setData: setTasks, loading, error, refetch } = useSupabaseQuery(fetchTasks)

  const addTasks = useCallback(
    async (taskData) => {
      const studentIds = (taskData.studentIds || []).filter(Boolean)
      if (!studentIds.length) return false

      const { error } = await supabase.from('tasks').insert(
        studentIds.map((studentId) => ({
          title: taskData.title,
          description: taskData.description || '',
          student_id: studentId,
          assigned_by: taskData.assignedBy,
          due_date: taskData.dueDate,
          status: taskData.status || 'Pendiente',
          progress: taskData.progress || 0,
        })),
      )
      if (error) {
        console.error('[Tasks] Error:', error.message, error)
        return false
      }

      await notifyInApp({
        senderId: taskData.assignedBy || null,
        recipients: studentIds.map((id) => ({ id })),
        title: 'Nueva tarea asignada',
        message: `Se te asignó la tarea: ${taskData.title}`,
      })
      await refetch()
      return true
    },
    [refetch],
  )

  const addTask = useCallback(
    async (taskData) => addTasks({ ...taskData, studentIds: [taskData.studentId] }),
    [addTasks],
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
    addTasks,
    updateTask,
    deleteTask,
    changeTaskStatus,
    changeTaskProgress,
    refetch,
  }
}

export default useSupabaseTasks
