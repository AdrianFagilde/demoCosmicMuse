import { useCallback, useEffect, useState } from 'react'
import supabase from '../lib/supabase'
import { notifyInApp } from '../utils/notifications'
import { deleteCourseFile, uploadMaterialFile } from '../utils/forms'

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0)

const useSupabaseCourses = () => {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchCourses = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('courses')
      .select('*, course_tasks(id, task_checklist_items(id)), course_enrollments(student_id)')
      .order('created_at', { ascending: false })
    if (fetchError) {
      setError(fetchError)
      console.error('[Courses] Error:', fetchError.message, fetchError)
    } else {
      setError(null)
      setCourses(data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    ;(async () => {
      await fetchCourses()
    })()
  }, [fetchCourses])

  const fetchCourseDetail = useCallback(async (courseId) => {
    const { data, error: fetchError } = await supabase
      .from('courses')
      .select(
        `*,
        course_tasks(*),
        course_materials(*),
        course_forms(*, form_questions(*)),
        course_enrollments(student_id)`,
      )
      .eq('id', courseId)
      .single()
    if (fetchError) {
      console.error('[Courses] Detail error:', fetchError.message, fetchError)
      return { detail: null, error: fetchError }
    }
    let itemsByTask = {}
    const taskIds = (data.course_tasks || []).map((t) => t.id)
    if (taskIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .from('task_checklist_items')
        .select('*')
        .in('task_id', taskIds)
      if (itemsError) {
        console.error('[Courses] Items error:', itemsError.message, itemsError)
      } else {
        itemsByTask = (items || []).reduce((acc, item) => {
          acc[item.task_id] = [...(acc[item.task_id] || []), item].sort(byPosition)
          return acc
        }, {})
      }
    }
    const studentIds = (data.course_enrollments || []).map((e) => e.student_id)
    let enrolledProfiles = []
    if (studentIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds)
      enrolledProfiles = profilesData || []
    }
    return {
      detail: {
        ...data,
        course_tasks: (data.course_tasks || []).sort(byPosition).map((t) => ({
          ...t,
          task_checklist_items: itemsByTask[t.id] || [],
        })),
        course_materials: (data.course_materials || []).sort(byPosition),
        course_forms: (data.course_forms || []).sort(byPosition),
        enrolled_profiles: enrolledProfiles.sort((a, b) =>
          String(a.full_name).localeCompare(String(b.full_name)),
        ),
      },
      error: null,
    }
  }, [])

  const createCourse = useCallback(
    async (courseData) => {
      const { data, error: insertError } = await supabase
        .from('courses')
        .insert({
          title: courseData.title,
          description: courseData.description || '',
          instrument: courseData.instrument || null,
          level: courseData.level || null,
          created_by: courseData.createdBy || null,
        })
        .select()
        .single()
      if (insertError) {
        console.error('[Courses] Create error:', insertError.message, insertError)
        return null
      }
      await fetchCourses()
      return data
    },
    [fetchCourses],
  )

  const updateCourse = useCallback(
    async (courseId, updates) => {
      const { error: updateError } = await supabase
        .from('courses')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', courseId)
      if (updateError) {
        console.error('[Courses] Update error:', updateError.message, updateError)
        return false
      }
      await fetchCourses()
      return true
    },
    [fetchCourses],
  )

  const deleteCourse = useCallback(
    async (courseId) => {
      const { error: deleteError } = await supabase.from('courses').delete().eq('id', courseId)
      if (deleteError) {
        console.error('[Courses] Delete error:', deleteError.message, deleteError)
        return false
      }
      await fetchCourses()
      return true
    },
    [fetchCourses],
  )

  const saveEnrollments = useCallback(async (course, nextStudentIds, actorId) => {
    const currentIds = (course.course_enrollments || []).map((e) => e.student_id)
    const toAdd = nextStudentIds.filter((id) => !currentIds.includes(id))
    const toRemove = currentIds.filter((id) => !nextStudentIds.includes(id))

    if (toAdd.length > 0) {
      const { error: insertError } = await supabase
        .from('course_enrollments')
        .insert(toAdd.map((studentId) => ({ course_id: course.id, student_id: studentId })))
      if (insertError) {
        console.error('[Courses] Enroll error:', insertError.message, insertError)
        return false
      }
      const namesById = new Map((course.enrolled_profiles || []).map((p) => [p.id, p.full_name]))
      void namesById
      await notifyInApp({
        senderId: actorId || null,
        recipients: toAdd.map((id) => ({ id })),
        title: 'Nuevo curso disponible',
        message: `Te inscribieron al curso: ${course.title}`,
      })
    }

    if (toRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from('course_enrollments')
        .delete()
        .eq('course_id', course.id)
        .in('student_id', toRemove)
      if (deleteError) {
        console.error('[Courses] Unenroll error:', deleteError.message, deleteError)
        return false
      }
    }
    return true
  }, [])

  const addTask = useCallback(async (course, taskData) => {
    const position = (course.course_tasks || []).reduce(
      (max, t) => Math.max(max, (t.position ?? 0) + 1),
      0,
    )
    const { data, error: insertError } = await supabase
      .from('course_tasks')
      .insert({
        course_id: course.id,
        title: taskData.title,
        description: taskData.description || '',
        due_date: taskData.dueDate || null,
        position,
        created_by: taskData.createdBy || null,
      })
      .select()
      .single()
    if (insertError) {
      console.error('[Courses] Add task error:', insertError.message, insertError)
      return null
    }
    const recipients = (course.enrolled_profiles || []).map((p) => ({ id: p.id }))
    if (recipients.length > 0) {
      await notifyInApp({
        senderId: taskData.createdBy || null,
        recipients,
        title: 'Nueva tarea en tu curso',
        message: `${course.title}: ${taskData.title}`,
      })
    }
    return data
  }, [])

  const updateTask = useCallback(async (taskId, updates) => {
    const { error: updateError } = await supabase
      .from('course_tasks')
      .update(updates)
      .eq('id', taskId)
    if (updateError) {
      console.error('[Courses] Update task error:', updateError.message, updateError)
      return false
    }
    return true
  }, [])

  const deleteTask = useCallback(async (taskId) => {
    const { error: deleteError } = await supabase.from('course_tasks').delete().eq('id', taskId)
    if (deleteError) {
      console.error('[Courses] Delete task error:', deleteError.message, deleteError)
      return false
    }
    return true
  }, [])

  const reorderTasks = useCallback(async (orderedIds) => {
    const updates = orderedIds.map((taskId, index) =>
      supabase.from('course_tasks').update({ position: index }).eq('id', taskId),
    )
    const results = await Promise.all(updates)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      console.error('[Courses] Reorder tasks error:', failed.error.message, failed.error)
      return false
    }
    return true
  }, [])

  const addChecklistItem = useCallback(async (taskId, label, position) => {
    const { data, error: insertError } = await supabase
      .from('task_checklist_items')
      .insert({ task_id: taskId, label, position })
      .select()
      .single()
    if (insertError) {
      console.error('[Courses] Add item error:', insertError.message, insertError)
      return null
    }
    return data
  }, [])

  const deleteChecklistItem = useCallback(async (itemId) => {
    const { error: deleteError } = await supabase
      .from('task_checklist_items')
      .delete()
      .eq('id', itemId)
    if (deleteError) {
      console.error('[Courses] Delete item error:', deleteError.message, deleteError)
      return false
    }
    return true
  }, [])

  const reorderChecklistItems = useCallback(async (orderedItems) => {
    const updates = orderedItems.map((item, index) =>
      supabase.from('task_checklist_items').update({ position: index }).eq('id', item.id),
    )
    const results = await Promise.all(updates)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      console.error('[Courses] Reorder items error:', failed.error.message, failed.error)
      return false
    }
    return true
  }, [])

  const fetchCourseProgress = useCallback(async (itemIds) => {
    if (!itemIds.length) return []
    const { data, error: fetchError } = await supabase
      .from('checklist_progress')
      .select('item_id, student_id')
      .in('item_id', itemIds)
    if (fetchError) {
      console.error('[Courses] Progress error:', fetchError.message, fetchError)
      return []
    }
    return data || []
  }, [])

  const toggleProgressItem = useCallback(async (itemId, studentId, completed) => {
    if (completed) {
      const { error: insertError } = await supabase
        .from('checklist_progress')
        .upsert({ item_id: itemId, student_id: studentId })
      if (insertError) {
        console.error('[Courses] Toggle on error:', insertError.message, insertError)
        return false
      }
      return true
    }
    const { error: deleteError } = await supabase
      .from('checklist_progress')
      .delete()
      .eq('item_id', itemId)
      .eq('student_id', studentId)
    if (deleteError) {
      console.error('[Courses] Toggle off error:', deleteError.message, deleteError)
      return false
    }
    return true
  }, [])

  const fetchStudentCourseProgress = useCallback(async (studentId) => {
    const { data, error: fetchError } = await supabase
      .from('checklist_progress')
      .select('item_id, student_id')
      .eq('student_id', studentId)
    if (fetchError) {
      console.error('[Courses] My progress error:', fetchError.message, fetchError)
      return []
    }
    return data || []
  }, [])

  const addMaterial = useCallback(async (course, materialData, actorId) => {
    let file = null
    if (materialData.type === 'file') {
      if (!materialData.file) {
        console.error('[Courses] Material de tipo archivo sin archivo')
        return null
      }
      file = await uploadMaterialFile(course.id, materialData.file)
      if (!file) return null
    }
    const position = (course.course_materials || []).reduce(
      (max, m) => Math.max(max, (m.position ?? 0) + 1),
      0,
    )
    const { data, error: insertError } = await supabase
      .from('course_materials')
      .insert({
        course_id: course.id,
        task_id: materialData.taskId || null,
        title: materialData.title,
        type: materialData.type,
        body: materialData.type === 'text' ? materialData.body || '' : '',
        url: materialData.type === 'link' ? materialData.url || null : null,
        file_path: file?.path ?? null,
        file_name: file?.fileName ?? null,
        position,
        created_by: actorId || null,
      })
      .select()
      .single()
    if (insertError) {
      console.error('[Courses] Add material error:', insertError.message, insertError)
      if (file) await deleteCourseFile(file.path)
      return null
    }
    return data
  }, [])

  const deleteMaterial = useCallback(async (material) => {
    const { error: deleteError } = await supabase
      .from('course_materials')
      .delete()
      .eq('id', material.id)
    if (deleteError) {
      console.error('[Courses] Delete material error:', deleteError.message, deleteError)
      return false
    }
    if (material.file_path) {
      await deleteCourseFile(material.file_path)
    }
    return true
  }, [])

  const reorderMaterials = useCallback(async (orderedIds) => {
    const updates = orderedIds.map((materialId, index) =>
      supabase.from('course_materials').update({ position: index }).eq('id', materialId),
    )
    const results = await Promise.all(updates)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      console.error('[Courses] Reorder materials error:', failed.error.message, failed.error)
      return false
    }
    return true
  }, [])

  return {
    courses,
    loading,
    error,
    refetch: fetchCourses,
    fetchCourseDetail,
    createCourse,
    updateCourse,
    deleteCourse,
    saveEnrollments,
    addTask,
    updateTask,
    deleteTask,
    reorderTasks,
    addChecklistItem,
    deleteChecklistItem,
    reorderChecklistItems,
    fetchCourseProgress,
    toggleProgressItem,
    fetchStudentCourseProgress,
    addMaterial,
    deleteMaterial,
    reorderMaterials,
  }
}

export default useSupabaseCourses
