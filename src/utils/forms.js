import supabase from '../lib/supabase'

export const FORM_QUESTION_TYPES = [
  { value: 'short_text', label: 'Texto corto' },
  { value: 'long_text', label: 'Párrafo largo' },
  { value: 'single_choice', label: 'Opción única' },
  { value: 'multiple_choice', label: 'Selección múltiple' },
  { value: 'scale', label: 'Escala 1-5' },
  { value: 'file_upload', label: 'Subida de archivo' },
]

export const QUESTION_TYPE_LABELS = Object.fromEntries(
  FORM_QUESTION_TYPES.map((t) => [t.value, t.label]),
)

export const CHOICE_TYPES = ['single_choice', 'multiple_choice']

export const SCALE_MIN = 1
export const SCALE_MAX = 5

export const MAX_FILE_SIZE_MB = 10
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

const COURSE_FILES_BUCKET = 'course-files'

export const newQuestion = (position = 0) => ({
  id: `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  question_text: '',
  type: 'short_text',
  options: [],
  required: false,
  position,
})

export const isPersistedQuestion = (question) => !String(question.id).startsWith('temp-')

export const isAnswerFilled = (question, answer) => {
  if (!answer) return false
  switch (question.type) {
    case 'short_text':
    case 'long_text':
      return String(answer.value_text ?? '').trim().length > 0
    case 'single_choice':
      return Boolean(answer.value_options && answer.value_options.length === 1)
    case 'multiple_choice':
      return Boolean(answer.value_options && answer.value_options.length > 0)
    case 'scale':
      return answer.value_number !== null && answer.value_number !== undefined
    case 'file_upload':
      return Boolean(answer.file_path)
    default:
      return false
  }
}

/**
 * Valida las respuestas contra las preguntas del formulario.
 * Devuelve un objeto { [questionId]: mensajeDeError } solo con los errores.
 */
export const validateAnswers = (questions, answersByQuestionId) => {
  const errors = {}
  for (const question of questions) {
    const answer = answersByQuestionId[question.id]
    if (question.required && !isAnswerFilled(question, answer)) {
      errors[question.id] = 'Esta pregunta es obligatoria.'
      continue
    }
    if (question.type === 'file_upload' && answer?.file && answer.file.size > MAX_FILE_SIZE_BYTES) {
      errors[question.id] = `El archivo supera el límite de ${MAX_FILE_SIZE_MB} MB.`
    }
  }
  return errors
}

/**
 * Devuelve una URL firmada de corta duración para descargar archivos
 * del bucket privado course-files.
 */
export const getCourseFileUrl = async (filePath) => {
  if (!filePath) return null
  const { data, error } = await supabase.storage
    .from(COURSE_FILES_BUCKET)
    .createSignedUrl(filePath, 300)
  if (error) {
    console.error('[Forms] Signed URL error:', error.message, error)
    return null
  }
  return data?.signedUrl ?? null
}

export const uploadAnswerFile = async (studentId, questionId, file) => {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const path = `answers/${studentId}/${questionId}/${unique}.${ext}`
  const { error } = await supabase.storage.from(COURSE_FILES_BUCKET).upload(path, file)
  if (error) {
    console.error('[Forms] Upload answer file error:', error.message, error)
    return null
  }
  return { path, fileName: file.name }
}

export const uploadMaterialFile = async (courseId, file) => {
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const path = `materials/${courseId}/${unique}.${ext}`
  const { error } = await supabase.storage.from(COURSE_FILES_BUCKET).upload(path, file)
  if (error) {
    console.error('[Forms] Upload material file error:', error.message, error)
    return null
  }
  return { path, fileName: file.name }
}

export const deleteCourseFile = async (filePath) => {
  if (!filePath) return true
  const { error } = await supabase.storage.from(COURSE_FILES_BUCKET).remove([filePath])
  if (error) {
    console.error('[Forms] Delete file error:', error.message, error)
    return false
  }
  return true
}
