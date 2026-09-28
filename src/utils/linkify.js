// Trocea texto plano en segmentos de texto y de enlace para poder pintar las
// URLs como enlaces sin pasar por dangerouslySetInnerHTML.
//
// Invariante de seguridad: un href solo se emite si el fragmento casa con un
// esquema http(s) explicito o con un patron de dominio, y el href resultante se
// comprueba una ultima vez contra /^https?:\/\//. Esquemas como javascript:,
// data: o vbscript: no pueden llegar a ser enlace porque no casan con ninguna
// de las dos formas, y un dominio suelto siempre se normaliza a https://.

const LABEL = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?'

// El TLD exige dos o mas letras, asi que 1.5 o v1.2 no se parecen a un dominio.
const URL_PATTERN = new RegExp(
  `(?:https?:\\/\\/)?(?:${LABEL}\\.)+[a-z]{2,}(?:[/?#][^\\s<>"'\\u00a0]*)?`,
  'gi',
)

// Extensiones de archivo: sin esto "adjunto el exercise.pdf" se convertiria en
// un enlace a https://exercise.pdf.
const FILE_EXTENSIONS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'rtf',
  'odt',
  'ods',
  'zip',
  'rar',
  '7z',
  'gz',
  'csv',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'bmp',
  'tiff',
  'mp3',
  'wav',
  'flac',
  'aiff',
  'm4a',
  'aac',
  'mp4',
  'mov',
  'avi',
  'mkv',
  'webm',
  'psd',
  'ai',
  'eps',
  'sketch',
  'fig',
  'indd',
  'epub',
  'pages',
  'key',
  'numbers',
])

const TAIL_PUNCTUATION = '.,;:!?\'"…'
const CLOSING_BRACKETS = { ')': '(', ']': '[', '}': '{' }

// "mira https://youtu.be/abc." no debe enlazar el punto final, y un parentesis
// solo se recorta si venia desbalanceado en el propio enlace.
const stripTail = (value) => {
  let end = value.length
  while (end > 0) {
    const char = value[end - 1]
    if (TAIL_PUNCTUATION.includes(char)) {
      end -= 1
      continue
    }
    if (CLOSING_BRACKETS[char]) {
      const open = CLOSING_BRACKETS[char]
      const slice = value.slice(0, end)
      const opened = (slice.match(new RegExp(`\\${open}`, 'g')) || []).length
      const closed = (slice.match(new RegExp(`\\${char}`, 'g')) || []).length
      if (closed > opened) {
        end -= 1
        continue
      }
    }
    break
  }
  return value.slice(0, end)
}

const isFilename = (value) => {
  const host = value.split(/[/?#]/)[0]
  return FILE_EXTENSIONS.has(host.split('.').pop().toLowerCase())
}

const toHref = (value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`)

export const linkify = (text) => {
  if (typeof text !== 'string' || !text) return []

  const segments = []
  let cursor = 0

  const pushText = (value) => {
    if (!value) return
    const last = segments[segments.length - 1]
    if (last && last.type === 'text') {
      last.value += value
    } else {
      segments.push({ type: 'text', value })
    }
  }

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0]
    const start = match.index
    const before = start > 0 ? text[start - 1] : ''

    // La cola de otro esquema (ftp://x.com) o de un correo (alumno@escuela.com)
    // no es un enlace nuestro.
    if (before === ':' || before === '/' || before === '@') continue

    const value = stripTail(raw)
    if (!value || isFilename(value)) continue

    const href = toHref(value)
    if (!/^https?:\/\//i.test(href)) continue

    pushText(text.slice(cursor, start))
    segments.push({ type: 'link', value, href })
    cursor = start + value.length
  }

  pushText(text.slice(cursor))

  return segments
}

export default linkify
