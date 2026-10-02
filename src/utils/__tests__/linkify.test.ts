import { describe, it, expect } from 'vitest'
import { linkify } from '../linkify'

describe('linkify', () => {
  it('returns empty for non strings or empty input', () => {
    expect(linkify('')).toEqual([])
    expect(linkify(null)).toEqual([])
    expect(linkify(42)).toEqual([])
  })

  it('returns a single text segment when there is no link', () => {
    expect(linkify('hola mundo')).toEqual([{ type: 'text', value: 'hola mundo' }])
  })

  it('detects an explicit https url', () => {
    const segments = linkify('mira https://example.com ahora')
    expect(segments).toEqual([
      { type: 'text', value: 'mira ' },
      { type: 'link', value: 'https://example.com', href: 'https://example.com' },
      { type: 'text', value: ' ahora' },
    ])
  })

  it('normalizes a bare domain to https', () => {
    const [link] = linkify('example.com')
    expect(link).toEqual({ type: 'link', value: 'example.com', href: 'https://example.com' })
  })

  it('strips trailing punctuation', () => {
    const segments = linkify('visita https://example.com.')
    expect(segments[1]).toEqual({
      type: 'link',
      value: 'https://example.com',
      href: 'https://example.com',
    })
  })

  it('keeps a balanced parenthetical in the url', () => {
    const segments = linkify('https://es.wikipedia.org/wiki/Python_(lenguaje)')
    expect(segments[0]?.value).toBe('https://es.wikipedia.org/wiki/Python_(lenguaje)')
  })

  it('drops an unbalanced closing parenthesis', () => {
    const segments = linkify('(ver https://example.com)')
    expect(segments[1]?.value).toBe('https://example.com')
  })

  it('does not linkify file names', () => {
    expect(linkify('adjunto exercise.pdf')).toEqual([
      { type: 'text', value: 'adjunto exercise.pdf' },
    ])
  })

  it('does not linkify emails or other schemes', () => {
    expect(linkify('alumno@escuela.com')).toEqual([{ type: 'text', value: 'alumno@escuela.com' }])
    expect(linkify('ftp://example.com')).toEqual([{ type: 'text', value: 'ftp://example.com' }])
  })

  it('never emits a non http(s) href', () => {
    for (const segment of linkify('javascript:alert(1)')) {
      if (segment.type === 'link') expect(segment.href).toMatch(/^https?:\/\//)
    }
  })
})
