import React, { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import useSupabaseForms from '../hooks/useSupabaseForms'
import { QUESTION_TYPE_LABELS, SCALE_MAX, SCALE_MIN, getCourseFileUrl } from '../utils/forms'

const formatAnswer = (question, answer) => {
  if (!answer) return <span className="text-medium-emphasis">Sin respuesta</span>
  switch (question.type) {
    case 'short_text':
    case 'long_text':
      return answer.value_text || <span className="text-medium-emphasis">Vacío</span>
    case 'single_choice':
    case 'multiple_choice':
      return (
        (answer.value_options || []).join(', ') || (
          <span className="text-medium-emphasis">Vacío</span>
        )
      )
    case 'scale':
      return `${answer.value_number} / ${SCALE_MAX}`
    case 'file_upload':
      return null
    default:
      return <span className="text-medium-emphasis">-</span>
  }
}

const FileAnswer = ({ answer }) => {
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    const signedUrl = await getCourseFileUrl(answer.file_path)
    setLoading(false)
    if (signedUrl) {
      setUrl(signedUrl)
      window.open(signedUrl, '_blank', 'noopener')
    }
  }

  return (
    <div>
      <div>{answer.file_name || 'Archivo'}</div>
      <CButton
        size="sm"
        color="primary"
        variant="outline"
        onClick={handleDownload}
        disabled={loading}
      >
        {loading ? <CSpinner size="sm" /> : 'Descargar'}
      </CButton>
      {url && <span className="ms-2 small text-medium-emphasis">Enlace temporal generado.</span>}
    </div>
  )
}

const SubmissionDetail = ({ questions, submission }) => {
  const answersByQuestionId = (submission.form_answers || []).reduce((acc, row) => {
    acc[row.question_id] = row
    return acc
  }, {})

  return (
    <div className="mt-2 mb-3 ps-3 border-start">
      {questions.map((question, index) => {
        const answer = answersByQuestionId[question.id]
        return (
          <div key={question.id} className="mb-3">
            <div className="fw-semibold">
              {index + 1}. {question.question_text}
            </div>
            <small className="text-medium-emphasis d-block">
              {QUESTION_TYPE_LABELS[question.type]}
              {question.required ? ' · obligatoria' : ''}
            </small>
            <div className="mt-1">
              {question.type === 'file_upload' ? (
                answer ? (
                  <FileAnswer answer={answer} />
                ) : (
                  <span className="text-medium-emphasis">Sin respuesta</span>
                )
              ) : (
                formatAnswer(question, answer)
              )}
            </div>
          </div>
        )
      })}
      <small className="text-medium-emphasis">
        Última actualización: {new Date(submission.updated_at).toLocaleString()}
      </small>
    </div>
  )
}

const FormResponsesModal = ({ course, form, onClose }) => {
  const { fetchFormResponses } = useSupabaseForms()
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedStudent, setExpandedStudent] = useState(null)

  useEffect(() => {
    ;(async () => {
      setResponses(await fetchFormResponses(form.id))
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.id])

  const questions = useMemo(
    () => [...(form.form_questions || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [form],
  )

  const submissionByStudent = useMemo(
    () =>
      responses.reduce((acc, submission) => {
        acc[submission.student_id] = submission
        return acc
      }, {}),
    [responses],
  )

  return (
    <CModal visible onClose={onClose} backdrop="static" size="lg" scrollable>
      <CModalHeader closeButton>
        <CModalTitle>Respuestas: {form.title}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        {loading ? (
          <div className="text-center py-4">
            <CSpinner color="primary" />
          </div>
        ) : questions.length === 0 ? (
          <CAlert color="info" className="py-2">
            Este cuestionario no tiene preguntas.
          </CAlert>
        ) : (
          <>
            <p className="text-medium-emphasis small mb-2">
              {responses.length} de {course.enrolled_profiles.length} estudiantes han respondido.
            </p>
            {course.enrolled_profiles.length === 0 && responses.length === 0 && (
              <CAlert color="info" className="py-2">
                Inscribe estudiantes al curso para ver sus respuestas aquí.
              </CAlert>
            )}
            {course.enrolled_profiles.map((studentProfile) => {
              const submission = submissionByStudent[studentProfile.id]
              const isExpanded = expandedStudent === studentProfile.id
              return (
                <div key={studentProfile.id} className="border rounded p-2 mb-2">
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="fw-semibold">{studentProfile.full_name}</span>
                    <div className="d-flex align-items-center gap-2">
                      <CBadge color={submission ? 'success' : 'warning text-dark'}>
                        {submission ? 'Enviado' : 'Pendiente'}
                      </CBadge>
                      {submission && (
                        <CButton
                          size="sm"
                          color="primary"
                          variant="outline"
                          onClick={() => setExpandedStudent(isExpanded ? null : studentProfile.id)}
                        >
                          {isExpanded ? 'Ocultar' : 'Ver respuestas'}
                        </CButton>
                      )}
                    </div>
                  </div>
                  {isExpanded && submission && (
                    <SubmissionDetail questions={questions} submission={submission} />
                  )}
                </div>
              )
            })}
          </>
        )}
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>
          Cerrar
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

export default FormResponsesModal
