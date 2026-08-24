import { useCallback, useState } from 'react'
import supabase from '../lib/supabase'
import { CHOICE_TYPES } from '../utils/forms'
import { notifyInApp } from '../utils/notifications'

const logError = (scope, error) => {
  console.error(`[Forms] ${scope} error:`, error.message, error)
}

const useSupabaseForms = () => {
  const [loading, setLoading] = useState(false)

  /* ================= PROFESOR ================= */

  const createForm = useCallback(async (course, formData, actorId) => {
    setLoading(true)
    const position = (course.course_forms || []).reduce(
      (max, f) => Math.max(max, (f.position ?? 0) + 1),
      0,
    )
    const { data, error: insertError } = await supabase
      .from('course_forms')
      .insert({
        course_id: course.id,
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
   * Guarda el conjunto completo de preguntas de un formulario.
   * Elimina las borradas, actualiza las existentes y crea las nuevas,
   * respetando el orden del arreglo recibido.
   */
  const saveFormQuestions = useCallback(async (formId, originalQuestions, nextQuestions) => {
    let ok = true
    const nextIds = new Set(nextQuestions.map((q) => q.id))

    for (const removed of originalQuestions.filter((q) => !nextIds.has(q.id))) {
      const { error } = await supabase.from('form_questions').delete().eq('id', removed.id)
      if (error) {
        logError('Delete question', error)
        ok = false
      }
    }

    for (let index = 0; index < nextQuestions.length; index++) {
      const question = nextQuestions[index]
      const payload = {
        form_id: formId,
        question_text: question.question_text.trim(),
        type: question.type,
        options: CHOICE_TYPES.includes(question.type)
          ? (question.options || []).filter((option) => String(option).trim())
          : [],
        required: Boolean(question.required),
        position: index,
      }
      const isNew = String(question.id).startsWith('temp-')
      const request = isNew
        ? supabase.from('form_questions').insert(payload)
        : supabase.from('form_questions').update(payload).eq('id', question.id)
      const { error } = await request
      if (error) {
        logError(isNew ? 'Insert question' : 'Update question', error)
        ok = false
      }
    }
    return ok
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
   * Crea o actualiza el envio del estudiante (la ultima version gana).
   * `answers` es un mapa { [questionId]: respuesta } ya validado y con los
   * archivos previamente subidos a Storage (file_path/file_name incluidos).
   */
  const submitForm = useCallback(async (form, questions, answers, studentId) => {
    setLoading(true)
    const { data: submission, error: submissionError } = await supabase
      .from('form_submissions')
      .upsert(
        {
          form_id: form.id,
          student_id: studentId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'form_id,student_id' },
      )
      .select()
      .single()
    if (submissionError) {
      logError('Submit form', submissionError)
      setLoading(false)
      return false
    }

    let ok = true
    for (const question of questions) {
      const answer = answers[question.id] || {}
      const row = {
        submission_id: submission.id,
        question_id: question.id,
        value_text: ['short_text', 'long_text'].includes(question.type)
          ? (answer.value_text ?? null)
          : null,
        value_options: CHOICE_TYPES.includes(question.type) ? (answer.value_options ?? null) : null,
        value_number: question.type === 'scale' ? (answer.value_number ?? null) : null,
        file_path: question.type === 'file_upload' ? (answer.file_path ?? null) : null,
        file_name: question.type === 'file_upload' ? (answer.file_name ?? null) : null,
      }
      const { error } = await supabase
        .from('form_answers')
        .upsert(row, { onConflict: 'submission_id,question_id' })
      if (error) {
        logError('Save answer', error)
        ok = false
      }
    }
    setLoading(false)

    if (ok && form.created_by && form.created_by !== studentId) {
      void notifyInApp({
        senderId: studentId,
        recipients: [{ id: form.created_by }],
        title: 'Nueva respuesta de cuestionario',
        message: `${form.title}: respuesta actualizada`,
      })
    }
    return ok
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
