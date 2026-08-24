import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CSpinner,
} from '@coreui/react'
import { useAuth } from '../../context/AuthContext'
import supabase from '../../lib/supabase'
import useSupabaseForms from '../../hooks/useSupabaseForms'
import {
  QUESTION_TYPE_LABELS,
  SCALE_MAX,
  SCALE_MIN,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
  deleteCourseFile,
  uploadAnswerFile,
  validateAnswers,
} from '../../utils/forms'

const ScaleInput = ({ questionId, value, onChange }) => (
  <div className="d-flex gap-3 flex-wrap">
    {Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => i + SCALE_MIN).map((n) => (
      <CFormCheck
        key={n}
        type="radio"
        name={`scale-${questionId}`}
        id={`scale-${questionId}-${n}`}
        label={String(n)}
        checked={value === n}
        onChange={() => onChange(n)}
      />
    ))}
    <small className="text-medium-emphasis align-self-center">
      {SCALE_MIN} = mínimo · {SCALE_MAX} = máximo
    </small>
  </div>
)

const FileQuestion = ({ answer, onUploaded, onRemoved }) => {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadError(`El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`)
      event.target.value = ''
      return
    }
    setUploadError('')
    setUploading(true)
    const uploaded = await uploadAnswerFile(answer.studentId, answer.questionId, file)
    setUploading(false)
    if (!uploaded) {
      setUploadError('No se pudo subir el archivo. Intenta de nuevo.')
      return
    }
    const previousPath = answer.file_path
    onUploaded(uploaded.path, uploaded.fileName)
    if (previousPath && previousPath !== uploaded.path) {
      await deleteCourseFile(previousPath)
    }
  }

  return (
    <div>
      <CFormInput type="file" onChange={handleFileChange} disabled={uploading} />
      {uploading && (
        <div className="mt-2 d-flex align-items-center gap-2">
          <CSpinner size="sm" /> <small>Subiendo archivo...</small>
        </div>
      )}
      {answer.file_name && !uploading && (
        <div className="mt-2 d-flex align-items-center gap-2">
          <CBadge color="success">{answer.file_name}</CBadge>
          <CButton size="sm" color="danger" variant="outline" onClick={onRemoved}>
            Quitar
          </CButton>
        </div>
      )}
      {uploadError && <div className="text-danger small mt-1">{uploadError}</div>}
    </div>
  )
}

const QuestionBlock = ({ question, index, answer, error, onChangeAnswer }) => (
  <div className="mb-4">
    <CFormLabel className="fw-semibold">
      {index + 1}. {question.question_text}
      {question.required && <span className="text-danger"> *</span>}
      <span className="text-medium-emphasis fw-normal ms-2 small">
        ({QUESTION_TYPE_LABELS[question.type]})
      </span>
    </CFormLabel>

    {(question.type === 'short_text' || question.type === 'long_text') && (
      <>
        {question.type === 'short_text' ? (
          <CFormInput
            value={answer.value_text || ''}
            onChange={(e) => onChangeAnswer({ ...answer, value_text: e.target.value })}
          />
        ) : (
          <CFormTextarea
            rows={4}
            value={answer.value_text || ''}
            onChange={(e) => onChangeAnswer({ ...answer, value_text: e.target.value })}
          />
        )}
      </>
    )}

    {(question.type === 'single_choice' || question.type === 'multiple_choice') && (
      <div>
        {(question.options || []).map((option, optionIndex) => (
          <CFormCheck
            key={optionIndex}
            type={question.type === 'single_choice' ? 'radio' : 'checkbox'}
            name={`choice-${question.id}`}
            id={`${question.id}-${optionIndex}`}
            label={option}
            checked={(answer.value_options || []).includes(option)}
            onChange={(event) => {
              const current = answer.value_options || []
              if (question.type === 'single_choice') {
                onChangeAnswer({ ...answer, value_options: [option] })
              } else if (event.target.checked) {
                onChangeAnswer({ ...answer, value_options: [...current, option] })
              } else {
                onChangeAnswer({
                  ...answer,
                  value_options: current.filter((selected) => selected !== option),
                })
              }
            }}
          />
        ))}
      </div>
    )}

    {question.type === 'scale' && (
      <ScaleInput
        questionId={question.id}
        value={answer.value_number ?? null}
        onChange={(number) => onChangeAnswer({ ...answer, value_number: number })}
      />
    )}

    {question.type === 'file_upload' && (
      <FileQuestion
        answer={answer}
        onUploaded={(filePath, fileName) =>
          onChangeAnswer({ ...answer, file_path: filePath, file_name: fileName })
        }
        onRemoved={() => {
          const previousPath = answer.file_path
          onChangeAnswer({ ...answer, file_path: null, file_name: null })
          if (previousPath) void deleteCourseFile(previousPath)
        }}
      />
    )}

    {error && <div className="text-danger small mt-1">{error}</div>}
  </div>
)

const CourseFormFill = () => {
  const { courseId, formId } = useParams()
  const { user } = useAuth()
  const { fetchFormForStudent, fetchMySubmissionDetail, submitForm } = useSupabaseForms()

  const [form, setForm] = useState(null)
  const [courseTitle, setCourseTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [answers, setAnswers] = useState({})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    ;(async () => {
      const loaded = await fetchFormForStudent(formId)
      if (!loaded) {
        setLoadError('No se pudo cargar el cuestionario o no tienes acceso.')
        setLoading(false)
        return
      }
      setForm(loaded)
      const { answersByQuestionId, submission } = await fetchMySubmissionDetail(formId, user.id)
      const initial = {}
      for (const question of loaded.form_questions || []) {
        const existing = answersByQuestionId[question.id]
        initial[question.id] = {
          studentId: user.id,
          questionId: question.id,
          value_text: existing?.value_text ?? '',
          value_options: existing?.value_options ?? [],
          value_number: existing?.value_number ?? null,
          file_path: existing?.file_path ?? null,
          file_name: existing?.file_name ?? null,
        }
      }
      setAnswers(initial)
      if (submission) setSavedAt(submission.updated_at)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, formId, user?.id])

  useEffect(() => {
    if (!courseId) return
    ;(async () => {
      const { data } = await supabase.from('courses').select('title').eq('id', courseId).single()
      setCourseTitle(data?.title || '')
    })()
  }, [courseId])

  const sortedQuestions = useMemo(
    () => [...(form?.form_questions || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [form],
  )

  const changeAnswer = (questionId, next) =>
    setAnswers((current) => ({ ...current, [questionId]: next }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaveError('')
    const validationErrors = validateAnswers(sortedQuestions, answers)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) return

    setSaving(true)
    const ok = await submitForm(form, sortedQuestions, answers, user.id)
    setSaving(false)
    if (!ok) {
      setSaveError('No se pudo guardar el cuestionario. Revisa tu conexión e intenta de nuevo.')
      return
    }
    setSavedAt(new Date().toISOString())
  }

  if (loading) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  if (loadError || !form) {
    return (
      <>
        <CButton
          as={Link}
          to={`/courses/${courseId}`}
          color="secondary"
          variant="outline"
          className="mb-3"
        >
          Volver al curso
        </CButton>
        <CCard className="border-danger">
          <CCardBody className="text-danger">{loadError}</CCardBody>
        </CCard>
      </>
    )
  }

  return (
    <>
      <CButton
        as={Link}
        to={`/courses/${courseId}`}
        color="secondary"
        variant="outline"
        className="mb-3"
      >
        ← Volver al curso
      </CButton>

      <CCard className="mb-4">
        <CCardHeader className="d-flex justify-content-between align-items-center">
          <span className="fw-bold">{form.title}</span>
          {savedAt ? (
            <CBadge color="success">Enviado</CBadge>
          ) : (
            <CBadge color="warning text-dark">Pendiente</CBadge>
          )}
        </CCardHeader>
        <CCardBody>
          {courseTitle && (
            <small className="text-medium-emphasis d-block">Curso: {courseTitle}</small>
          )}
          {form.description && <p className="mb-1">{form.description}</p>}
          {form.due_date && (
            <small className="text-medium-emphasis">Fecha límite: {form.due_date}</small>
          )}
          {savedAt && (
            <CAlert color="info" className="py-2 mt-2 mb-0 small">
              Ya enviaste este cuestionario ({new Date(savedAt).toLocaleString()}). Puedes modificar
              tus respuestas y volver a enviarlo.
            </CAlert>
          )}
        </CCardBody>
      </CCard>

      <CCard>
        <CCardBody>
          <CForm onSubmit={handleSubmit}>
            {sortedQuestions.map((question, index) => (
              <QuestionBlock
                key={question.id}
                question={question}
                index={index}
                answer={answers[question.id] || {}}
                error={errors[question.id]}
                onChangeAnswer={(next) => changeAnswer(question.id, next)}
              />
            ))}
            {saveError && (
              <CAlert color="danger" className="py-2">
                {saveError}
              </CAlert>
            )}
            <CButton type="submit" color="primary" disabled={saving}>
              {saving ? (
                <CSpinner size="sm" />
              ) : savedAt ? (
                'Actualizar respuestas'
              ) : (
                'Enviar respuestas'
              )}
            </CButton>
          </CForm>
        </CCardBody>
      </CCard>
    </>
  )
}

export default CourseFormFill
