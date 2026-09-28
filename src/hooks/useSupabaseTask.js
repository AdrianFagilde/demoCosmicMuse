import { useCallback, useMemo } from 'react'
import supabase from '../lib/supabase'
import useSupabaseQuery from './useSupabaseQuery'
import { useAuth } from '../context/AuthContext'
import { computeStats } from '../utils/courses'

// Una sola tarea con su checklist en detalle, en vez de la lista completa que
// carga useSupabaseTasks. Los items entran anidados en el SELECT para que
// PostgREST los resuelva en el mismo viaje: pedirlos por separado duplicaba
// la latencia de la vista que abre el alumno al pulsar la notificacion.
const TASK_DETAIL_SELECT = `
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
  profiles!tasks_student_id_fkey(id, full_name, email),
  assigned_by_profile:profiles!tasks_assigned_by_fkey(id, full_name),
  course:courses!tasks_course_id_fkey(id, title),
  task_checklist_items(id, label, position, created_at)
`

// De quien es el progreso que se muestra, que no siempre es el visor:
//
// - Tarea individual: el progreso pertenece al alumno asignado, asi que el
//   admin ve el de ese alumno y el alumno ve el suyo.
// - Tarea de curso: el mismo checklist lo completa cada inscrito por su
//   cuenta, asi que el progreso es del alumno que la abre. El admin no es
//   ninguno de ellos, asi que se le muestra la checklist sin progreso en vez
//   de un 0% que pareceria real.
const resolveProgressStudentId = (task, viewerId, isStudent) => {
  if (!task) return null
  if (task.course_id) return isStudent ? viewerId : null
  return task.student_id
}

const sortItems = (items) =>
  [...(items || [])].sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0) || String(a.id).localeCompare(String(b.id)),
  )

const useSupabaseTask = (taskId) => {
  const { user, profile } = useAuth()
  const viewerId = user?.id || null
  const isStudent = profile?.role === 'student'

  const fetchTask = useCallback(async () => {
    if (!taskId) return null

    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_DETAIL_SELECT)
      .eq('id', taskId)
      .maybeSingle()
    if (error) {
      console.error('[TaskDetail] Error:', error.message, error)
      throw error
    }
    if (!data) return null

    const items = sortItems(data.task_checklist_items)
    const progressStudentId = resolveProgressStudentId(data, viewerId, isStudent)

    let doneItemIds = []
    if (items.length > 0 && progressStudentId) {
      const { data: progress, error: progressError } = await supabase
        .from('checklist_progress')
        .select('item_id')
        .eq('student_id', progressStudentId)
        .in(
          'item_id',
          items.map((i) => i.id),
        )
      if (progressError) {
        console.error('[TaskDetail] Progress error:', progressError.message, progressError)
      } else {
        doneItemIds = (progress || []).map((row) => row.item_id)
      }
    }

    return {
      ...data,
      task_checklist_items: items,
      progress_student_id: progressStudentId,
      done_item_ids: doneItemIds,
    }
  }, [taskId, viewerId, isStudent])

  const {
    data: task,
    setData: setTask,
    loading,
    error,
    refetch,
  } = useSupabaseQuery(fetchTask, Boolean(taskId), null)

  const items = useMemo(() => sortItems(task?.task_checklist_items), [task?.task_checklist_items])
  const progressStudentId = task?.progress_student_id || null
  const doneSet = useMemo(() => new Set(task?.done_item_ids || []), [task?.done_item_ids])

  // Reutiliza el calculo ya consolidado en utils/courses en vez de un quinto
  // porcentaje propio: el detalle, la ficha del curso y el feed tienen que dar
  // el mismo numero para la misma checklist.
  const stats = useMemo(
    () =>
      computeStats(
        [{ task_checklist_items: items }],
        [...doneSet].map((id) => ({ item_id: id })),
      ),
    [items, doneSet],
  )

  const setDone = useCallback(
    (nextSet) => {
      setTask((prev) => (prev ? { ...prev, done_item_ids: [...nextSet] } : prev))
    },
    [setTask],
  )

  const toggleItem = useCallback(
    async (itemId, completed) => {
      if (!progressStudentId) return false

      // Optimista con vuelta atras. La fila va detras del trigger de badges,
      // asi que el INSERT no es inmediato. Si falla se restaura el estado
      // previo en vez de dejar la casilla marcada sin estar en la base, que es
      // justo lo que hacia CourseDetailStudent y por eso el fallo pasaba
      // inadvertido.
      const snapshot = doneSet
      const next = new Set(snapshot)
      if (completed) next.add(itemId)
      else next.delete(itemId)
      setDone(next)

      const { error: toggleError } = completed
        ? await supabase
            .from('checklist_progress')
            .upsert({ item_id: itemId, student_id: progressStudentId })
        : await supabase
            .from('checklist_progress')
            .delete()
            .eq('item_id', itemId)
            .eq('student_id', progressStudentId)

      if (toggleError) {
        console.error('[TaskDetail] Toggle error:', toggleError.message, toggleError)
        setDone(snapshot)
        return false
      }
      return true
    },
    [doneSet, progressStudentId, setDone],
  )

  // El alumno solo marca checklist. El RLS es la puerta real: la politica
  // "Student manage own progress" (024) exige que la tarea tenga course_id y
  // que el alumno este inscrito, asi que una tarea individual no admite
  // progreso de checklist aunque la casilla se muestre. Se oculta en vez de
  // dejarla fallar en silencio.
  const canEditProgress = Boolean(isStudent && task?.course_id)

  const updateTask = useCallback(
    async (updates) => {
      if (!task) return false
      const cleaned = {}
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) cleaned[key] = value
      })
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ ...cleaned, updated_at: new Date().toISOString() })
        .eq('id', task.id)
      if (updateError) {
        console.error('[TaskDetail] Update error:', updateError.message, updateError)
        return false
      }
      setTask((prev) => (prev ? { ...prev, ...cleaned } : prev))
      return true
    },
    [task, setTask],
  )

  const addChecklistItem = useCallback(
    async (label, position) => {
      if (!task) return null
      const { data, error: insertError } = await supabase
        .from('task_checklist_items')
        .insert({ task_id: task.id, label, position })
        .select('id, label, position, created_at')
        .single()
      if (insertError) {
        console.error('[TaskDetail] Add item error:', insertError.message, insertError)
        return null
      }
      setTask((prev) =>
        prev ? { ...prev, task_checklist_items: sortItems([...items, data]) } : prev,
      )
      return data
    },
    [task, items, setTask],
  )

  const deleteChecklistItem = useCallback(
    async (itemId) => {
      const { error: deleteError } = await supabase
        .from('task_checklist_items')
        .delete()
        .eq('id', itemId)
      if (deleteError) {
        console.error('[TaskDetail] Delete item error:', deleteError.message, deleteError)
        return false
      }
      setTask((prev) =>
        prev
          ? {
              ...prev,
              task_checklist_items: (prev.task_checklist_items || []).filter(
                (i) => i.id !== itemId,
              ),
            }
          : prev,
      )
      return true
    },
    [setTask],
  )

  const reorderChecklistItems = useCallback(
    async (orderedIds) => {
      const results = await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from('task_checklist_items').update({ position: index }).eq('id', id),
        ),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) {
        console.error('[TaskDetail] Reorder error:', failed.error.message, failed.error)
        return false
      }
      setTask((prev) => {
        if (!prev) return prev
        const byId = new Map((prev.task_checklist_items || []).map((i) => [i.id, i]))
        return {
          ...prev,
          task_checklist_items: orderedIds.map((id, index) => ({
            ...byId.get(id),
            position: index,
          })),
        }
      })
      return true
    },
    [setTask],
  )

  return {
    task,
    items,
    doneSet,
    completedItems: stats.doneItems,
    totalItems: stats.totalItems,
    percent: stats.percent,
    canEditProgress,
    progressStudentId,
    loading,
    error,
    refetch,
    toggleItem,
    updateTask,
    addChecklistItem,
    deleteChecklistItem,
    reorderChecklistItems,
  }
}

export default useSupabaseTask
