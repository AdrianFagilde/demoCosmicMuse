import React, { useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilPlus } from '@coreui/icons'
import FormBuilder from './FormBuilder'
import useSupabaseForms from '../hooks/useSupabaseForms'
import { CHOICE_TYPES, newQuestion } from '../utils/forms'

const FormEditorModal = ({ course, form, actorId, onClose, onSaved }) => {
  const isNew = !form
  const originalQuestions = useMemo(() => form?.form_questions || [], [form])
  const { createForm, updateForm, saveFormQuestions } = useSupabaseForms()

  const [meta, setMeta] = useState({
    title: form?.title || '',
    description: form?.description || '',
    dueDate: form?.due_date || '',
  })
  const [questions, setQuestions] = useState(
    originalQuestions.map((q) => ({
      ...q,
      options: Array.isArray(q.options) ? q.options : [],
    })),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const validate = () => {
    if (!meta.title.trim()) return 'El cuestionario necesita un título.'
    if (questions.length === 0) return 'Agrega al menos una pregunta.'
    for (let index = 0; index < questions.length; index++) {
      const question = questions[index]
      if (!question.question_text.trim()) {
        return `La pregunta ${index + 1} no puede quedar vacía.`
      }
      if (CHOICE_TYPES.includes(question.type)) {
        const filled = (question.options || []).filter((option) => option.trim())
        if (filled.length < 1) {
          return `La pregunta ${index + 1} necesita al menos una opción.`
        }
      }
    }
    return ''
  }

  const handleSave = async () => {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')

    const formData = {
      title: meta.title.trim(),
      description: meta.description.trim(),
      dueDate: meta.dueDate || null,
    }

    let targetForm = form
    if (isNew) {
      targetForm = await createForm(course, formData, actorId)
      if (!targetForm) {
        setSaving(false)
        setError('No se pudo crear el cuestionario.')
        return
      }
    } else {
      const ok = await updateForm(form.id, {
        title: formData.title,
        description: formData.description,
        due_date: formData.dueDate,
      })
      if (!ok) {
        setSaving(false)
        setError('No se pudo guardar el cuestionario.')
        return
      }
    }

    const questionsOk = await saveFormQuestions(targetForm.id, originalQuestions, questions)
    setSaving(false)
    if (!questionsOk) {
      setError('Hubo un problema guardando algunas preguntas. Revisa y vuelve a intentar.')
      return
    }
    onClose()
    await onSaved()
  }

  const handleAddQuestion = () => setQuestions([...questions, newQuestion(questions.length)])

  return (
    <CModal visible onClose={onClose} backdrop="static" size="lg" scrollable>
      <CForm
        onSubmit={(event) => {
          event.preventDefault()
          handleSave()
        }}
      >
        <CModalHeader closeButton>
          <CModalTitle>{isNew ? 'Nuevo cuestionario' : 'Editar cuestionario'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="mb-3">
            <CFormLabel>Título *</CFormLabel>
            <CFormInput
              value={meta.title}
              onChange={(e) => setMeta({ ...meta, title: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <CFormLabel>Descripción / instrucciones</CFormLabel>
            <CFormTextarea
              rows={2}
              value={meta.description}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <CFormLabel>Fecha límite (opcional)</CFormLabel>
            <CFormInput
              type="date"
              value={meta.dueDate}
              onChange={(e) => setMeta({ ...meta, dueDate: e.target.value })}
            />
          </div>
          <hr />
          <div className="d-flex justify-content-between align-items-center mb-2">
            <CFormLabel className="fw-semibold mb-0">Preguntas (arrastra para ordenar)</CFormLabel>
            <CButton size="sm" color="primary" variant="outline" onClick={handleAddQuestion}>
              <CIcon icon={cilPlus} className="me-1" /> Pregunta
            </CButton>
          </div>
          <FormBuilder questions={questions} onChange={setQuestions} />
          {error && (
            <CAlert color="danger" className="mt-3 py-2">
              {error}
            </CAlert>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="outline" onClick={onClose}>
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={saving}>
            {saving ? <CSpinner size="sm" /> : 'Guardar cuestionario'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

export default FormEditorModal
