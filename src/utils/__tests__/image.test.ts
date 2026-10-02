import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCroppedImg, MAX_AVATAR_SIZE } from '../image'

class FakeImage {
  width = 100
  height = 80
  crossOrigin = ''
  private loadHandler: (() => void) | null = null

  addEventListener(type: string, handler: () => void) {
    if (type === 'load') this.loadHandler = handler
  }

  set src(_value: string) {
    queueMicrotask(() => this.loadHandler?.())
  }
}

const makeCanvas = () => {
  const ctx = { translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn() }
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toBlob: (cb: (blob: Blob | null) => void) => cb(new Blob(['x'], { type: 'image/jpeg' })),
  }
}

let realCreateElement: typeof document.createElement

beforeEach(() => {
  vi.stubGlobal('Image', FakeImage)
  realCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
    tag === 'canvas' ? makeCanvas() : realCreateElement(tag)) as typeof document.createElement)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('getCroppedImg', () => {
  it('exposes the max avatar size', () => {
    expect(MAX_AVATAR_SIZE).toBe(512)
  })

  it('rejects when the source or crop is missing', async () => {
    await expect(getCroppedImg('', { x: 0, y: 0 } as never)).rejects.toThrow(/Faltan datos/)
    await expect(getCroppedImg('data:image/png;base64,x', null as never)).rejects.toThrow(
      /Faltan datos/,
    )
  })

  it('rejects when the canvas context is unavailable', async () => {
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) =>
      tag === 'canvas'
        ? { width: 0, height: 0, getContext: () => null }
        : realCreateElement(tag)) as typeof document.createElement)
    await expect(
      getCroppedImg('data:image/png;base64,x', { x: 0, y: 0, width: 10, height: 10 } as never),
    ).rejects.toThrow(/Canvas no disponible/)
  })

  it('produces a jpeg blob and caps it to the max size', async () => {
    const blob = await getCroppedImg('data:image/png;base64,x', {
      x: 0,
      y: 0,
      width: 1024,
      height: 1024,
    } as never)
    expect(blob).toBeInstanceOf(Blob)
    expect((blob as Blob & { name?: string }).name).toBe('avatar.jpeg')
    expect(blob.type).toBe('image/jpeg')
  })
})
