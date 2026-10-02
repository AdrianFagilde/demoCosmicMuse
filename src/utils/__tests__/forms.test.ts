import { describe, it, expect, vi, beforeEach } from 'vitest'

const storageFrom = {
  createSignedUrl: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}

vi.mock('../../lib/supabase', () => ({
  default: { storage: { from: vi.fn(() => storageFrom) } },
}))

import {
  FORM_QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  CHOICE_TYPES,
  MAX_FILE_SIZE_BYTES,
  FILE_ACCEPT,
  validateCourseFile,
  newQuestion,
  isPersistedQuestion,
  isAnswerFilled,
  validateAnswers,
  getCourseFileUrl,
  uploadAnswerFile,
  uploadMaterialFile,
  deleteCourseFile,
} from '../forms'

const makeFile = (name: string, size = 10) => {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('form constants', () => {
  it('exposes question types and their labels', () => {
    expect(FORM_QUESTION_TYPES.length).toBe(6)
    expect(QUESTION_TYPE_LABELS.short_text).toBe('Texto corto')
    expect(CHOICE_TYPES).toEqual(['single_choice', 'multiple_choice'])
  })

  it('builds an accept string of extensions', () => {
    expect(FILE_ACCEPT).toContain('.pdf')
    expect(FILE_ACCEPT).toContain('.mp3')
    expect(FILE_ACCEPT.startsWith('.')).toBe(true)
  })
})

describe('validateCourseFile', () => {
  it('rejects non files and empty files', () => {
    expect(validateCourseFile('nope')).toMatch(/vacío o no es válido/)
    expect(validateCourseFile(makeFile('a.pdf', 0))).toMatch(/vacío o no es válido/)
  })

  it('rejects files over the size limit', () => {
    expect(validateCourseFile(makeFile('a.pdf', MAX_FILE_SIZE_BYTES + 1))).toMatch(/supera/)
  })

  it('rejects disallowed extensions', () => {
    expect(validateCourseFile(makeFile('script.exe'))).toMatch(/no esta permitido/)
  })

  it('accepts an allowed file', () => {
    expect(validateCourseFile(makeFile('partitura.pdf'))).toBeNull()
  })
})

describe('newQuestion / isPersistedQuestion', () => {
  it('creates a temporary question at the given position', () => {
    const q = newQuestion(3)
    expect(q.id.startsWith('temp-')).toBe(true)
    expect(q.position).toBe(3)
    expect(q.type).toBe('short_text')
    expect(isPersistedQuestion(q)).toBe(false)
  })

  it('treats a database id as persisted', () => {
    expect(isPersistedQuestion({ id: '123' })).toBe(true)
  })
})

describe('isAnswerFilled', () => {
  it('is false without an answer', () => {
    expect(isAnswerFilled({ type: 'short_text' }, null)).toBe(false)
  })

  it('checks text answers', () => {
    expect(isAnswerFilled({ type: 'short_text' }, { value_text: '  ' })).toBe(false)
    expect(isAnswerFilled({ type: 'short_text' }, { value_text: 'hola' })).toBe(true)
  })

  it('checks single and multiple choice', () => {
    expect(isAnswerFilled({ type: 'single_choice' }, { value_options: [] })).toBe(false)
    expect(isAnswerFilled({ type: 'single_choice' }, { value_options: ['a'] })).toBe(true)
    expect(isAnswerFilled({ type: 'multiple_choice' }, { value_options: ['a', 'b'] })).toBe(true)
  })

  it('checks scale answers', () => {
    expect(isAnswerFilled({ type: 'scale' }, { value_number: 0 })).toBe(true)
    expect(isAnswerFilled({ type: 'scale' }, { value_number: null })).toBe(false)
  })

  it('checks file answers', () => {
    expect(isAnswerFilled({ type: 'file_upload' }, { file_path: 'p' })).toBe(true)
    expect(isAnswerFilled({ type: 'file_upload' }, {})).toBe(false)
  })

  it('is false for unknown types', () => {
    expect(isAnswerFilled({ type: 'weird' }, { value_text: 'x' })).toBe(false)
  })
})

describe('validateAnswers', () => {
  it('flags missing required answers', () => {
    const errors = validateAnswers(
      [{ id: 'q1', type: 'short_text', required: true }],
      {},
    ) as Record<string, string>
    expect(errors.q1).toMatch(/obligatoria/)
  })

  it('flags oversized file answers', () => {
    const errors = validateAnswers([{ id: 'q1', type: 'file_upload', required: false }], {
      q1: { file: makeFile('a.pdf', MAX_FILE_SIZE_BYTES + 1) },
    }) as Record<string, string>
    expect(errors.q1).toMatch(/límite/)
  })

  it('returns no errors for valid answers', () => {
    const errors = validateAnswers([{ id: 'q1', type: 'short_text', required: true }], {
      q1: { value_text: 'ok' },
    })
    expect(errors).toEqual({})
  })
})

describe('storage helpers', () => {
  it('returns null for an empty path', async () => {
    expect(await getCourseFileUrl('')).toBeNull()
  })

  it('returns the signed url on success', async () => {
    storageFrom.createSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://signed' },
      error: null,
    })
    expect(await getCourseFileUrl('a/b.pdf')).toBe('https://signed')
  })

  it('returns null when signing fails', async () => {
    storageFrom.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await getCourseFileUrl('a/b.pdf')).toBeNull()
  })

  it('rejects an invalid answer file before uploading', async () => {
    expect(await uploadAnswerFile('s1', 'q1', makeFile('x.exe'))).toBeNull()
    expect(storageFrom.upload).not.toHaveBeenCalled()
  })

  it('uploads a valid answer file and returns its path', async () => {
    storageFrom.upload.mockResolvedValue({ error: null })
    const result = await uploadAnswerFile('s1', 'q1', makeFile('foto.png'))
    expect(result?.fileName).toBe('foto.png')
    expect(result?.path).toMatch(/^answers\/s1\/q1\/.+\.png$/)
  })

  it('returns null when the answer upload fails', async () => {
    storageFrom.upload.mockResolvedValue({ error: { message: 'nope' } })
    expect(await uploadAnswerFile('s1', 'q1', makeFile('foto.png'))).toBeNull()
  })

  it('uploads a material file', async () => {
    storageFrom.upload.mockResolvedValue({ error: null })
    const result = await uploadMaterialFile('c1', makeFile('guia.pdf'))
    expect(result?.path).toMatch(/^materials\/c1\/.+\.pdf$/)
  })

  it('deletes a file and reports success or failure', async () => {
    expect(await deleteCourseFile('')).toBe(true)
    storageFrom.remove.mockResolvedValue({ error: null })
    expect(await deleteCourseFile('a/b')).toBe(true)
    storageFrom.remove.mockResolvedValue({ error: { message: 'x' } })
    expect(await deleteCourseFile('a/b')).toBe(false)
  })
})
