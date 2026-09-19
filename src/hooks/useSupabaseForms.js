import { useCallback, useState } from 'react'
import supabase from '../lib/supabase'
import { CHOICE_TYPES, isPersistedQuestion } from '../utils/forms'
import { notifyInApp } from '../utils/notifications'

const logError = (scope, error) => {
  console.error(`[Forms] ${scope} error:`, error.message, error)
}

const useSupabaseForms = () => {
  const [loading, setLoading] = useState(false)

  /* ================= PROFESOR ================= */

  const createForm = useCallback(async (course, formData, actorId, taskId = null) => {
    setLoading(true)
    const position = (course.course_forms || []).reduce(
      (max, f) => Math.max(max, (f.position ?? 0) + 1),
      0,
    )
    const { data, error: insertError } = await supabase
      .from('course_forms')
      .insert({
        course_id: course.id,
        task_id: taskId || null,
        title: formData.title,
        description: formData.description || '',
        due_date: formData.dueDate || null,
        position,
        created_by: actorId || null,
      })
      .select()
      .single()
    setLoading(false)
    if (insertError) {
      logError('Create form', insertError)
      return null
    }
    const recipients = (course.enrolled_profiles || []).map((p) => ({ id: p.id }))
    if (recipients.length > 0) {
      void notifyInApp({
        senderId: actorId || null,
        recipients,
        title: 'Nuevo cuestionario disponible',
        message: `${course.title}: ${formData.title}`,
      })
    }
    return data
  }, [])

  const updateForm = useCallback(async (formId, updates) => {
    const { error: updateError } = await supabase
      .from('course_forms')
      .update(updates)
      .eq('id', formId)
    if (updateError) {
      logError('Update form', updateError)
      return false
    }
    return true
  }, [])

  const deleteForm = useCallback(async (formId) => {
    const { error: deleteError } = await supabase.from('course_forms').delete().eq('id', formId)
    if (deleteError) {
      logError('Delete form', deleteError)
      return false
    }
    return true
  }, [])

  const reorderForms = useCallback(async (orderedIds) => {
    const updates = orderedIds.map((formId, index) =>
      supabase.from('course_forms').update({ position: index }).eq('id', formId),
    )
    const results = await Promise.all(updates)
    const failed = results.find((r) => r.error)
    if (failed?.error) {
      logError('Reorder forms', failed.error)
      return false
    }
    return true
  }, [])

  /**
   * Guarda el conjunto completo de preguntas de un formulario en una sola
   * transacción (RPC). Devuelve el array de preguntas con ids resueltos,
   * o null si algo falló (en cuyo caso no se persistió nada a medias).
   */
  const saveFormQuestions = useCallback(async (formId, questions) => {
    const p_questions = questions.map((question, index) => ({
      id: isPersistedQuestion(question) ? question.id : null,
      question_text: question.question_text,
      type: question.type,
      options: CHOICE_TYPES.includes(question.type)
        ? (question.options || []).filter((option) => String(option).trim())
        : [],
      required: Boolean(question.required),
      position: index,
    }))

    const { data, error } = await supabase.rpc('save_form_questions', {
      p_form_id: formId,
      p_questions,
    })
    if (error) {
      logError('Save questions', error)
      return null
    }
    return data || []
  }, [])

  /** Respuestas de todos los estudiantes para un formulario (vista profesor). */
  const fetchFormResponses = useCallback(async (formId) => {
    const { data, error: fetchError } = await supabase
      .from('form_submissions')
      .select(
        `*,
        profiles(id, full_name),
        form_answers(*)`,
      )
      .eq('form_id', formId)
    if (fetchError) {
      logError('Fetch responses', fetchError)
      return []
    }
    return data || []
  }, [])

  /* ================= ESTUDIANTE ================= */

  const fetchFormForStudent = useCallback(async (formId) => {
    const { data: form, error: formError } = await supabase
      .from('course_forms')
      .select('*')
      .eq('id', formId)
      .single()
    if (formError) {
      logError('Fetch form', formError)
      return null
    }
    const { data: questions, error: questionsError } = await supabase
      .from('form_questions')
      .select('*')
      .eq('form_id', formId)
      .order('position', { ascending: true })
    if (questionsError) {
      logError('Fetch questions', questionsError)
      return { ...form, form_questions: [] }
    }
    return { ...form, form_questions: questions || [] }
  }, [])

  const fetchMySubmissions = useCallback(async (studentId, formIds) => {
    if (!formIds.length) return {}
    const { data, error: fetchError } = await supabase
      .from('form_submissions')
      .select('form_id, updated_at')
      .eq('student_id', studentId)
      .in('form_id', formIds)
    if (fetchError) {
      logError('Fetch my submissions', fetchError)
      return {}
    }
    return (data || []).reduce((acc, row) => {
      acc[row.form_id] = row
      return acc
    }, {})
  }, [])

  const fetchMySubmissionDetail = useCallback(async (formId, studentId) => {
    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formId)
      .eq('student_id', studentId)
      .maybeSingle()
    if (submissionError) {
      logError('Fetch my submission', submissionError)
      return { submission: null, answersByQuestionId: {} }
    }
    if (!submission) return { submission: null, answersByQuestionId: {} }
    const { data: answers, error: answersError } = await supabase
      .from('form_answers')
      .select('*')
      .eq('submission_id', submission.id)
    if (answersError) {
      logError('Fetch my answers', answersError)
      return { submission, answersByQuestionId: {} }
    }
    const answersByQuestionId = (answers || []).reduce((acc, row) => {
      acc[row.question_id] = row
      return acc
    }, {})
    return { submission, answersByQuestionId }
  }, [])

  /**
   * Crea o actualiza el envio del estudiante y todas sus respuestas en una
   * sola transacción (RPC). `answers` es un mapa { [questionId]: respuesta }
   * ya validado y con los archivos previamente subidos a Storage.
   */
  const submitForm = useCallback(async (form, questions, answers, studentId) => {
    setLoading(true)
    const p_answers = questions.map((question) => {
      const answer = answers[question.id] || {}
      return {
        question_id: question.id,
        value_text: ['short_text', 'long_text'].includes(question.type)
          ? (answer.value_text ?? null)
          : null,
        value_options: CHOICE_TYPES.includes(question.type) ? (answer.value_options ?? null) : null,
        value_number: question.type === 'scale' ? (answer.value_number ?? null) : null,
        file_path: question.type === 'file_upload' ? (answer.file_path ?? null) : null,
        file_name: question.type === 'file_upload' ? (answer.file_name ?? null) : null,
      }
    })

    const { error } = await supabase.rpc('submit_form', {
      p_form_id: form.id,
      p_student_id: studentId,
      p_answers,
    })
    setLoading(false)
    if (error) {
      logError('Submit form', error)
      return false
    }

    if (form.created_by && form.created_by !== studentId) {
      void notifyInApp({
        senderId: studentId,
        recipients: [{ id: form.created_by }],
        title: 'Nueva respuesta de cuestionario',
        message: `${form.title}: respuesta actualizada`,
      })
    }
    return true
  }, [])

  return {
    loading,
    createForm,
    updateForm,
    deleteForm,
    reorderForms,
    saveFormQuestions,
    fetchFormResponses,
    fetchFormForStudent,
    fetchMySubmissions,
    fetchMySubmissionDetail,
    submitForm,
  }
}

export default useSupabaseForms
