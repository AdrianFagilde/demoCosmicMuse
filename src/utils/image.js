const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', () => reject(new Error('No se pudo cargar la imagen')))
    image.crossOrigin = 'anonymous'
    image.src = url
  })

const getRadianAngle = (degrees) => (degrees * Math.PI) / 180

const rotateSize = (width, height, rotation) => {
  const rotRad = getRadianAngle(rotation)
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  }
}

export const MAX_AVATAR_SIZE = 512

export const getCroppedImg = async (imageSrc, pixelCrop, rotation = 0) => {
  if (!imageSrc || !pixelCrop) throw new Error('Faltan datos para recortar la imagen')

  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible en este navegador')

  const rotRad = getRadianAngle(rotation)
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation)

  canvas.width = bBoxWidth
  canvas.height = bBoxHeight
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2)
  ctx.rotate(rotRad)
  ctx.drawImage(image, -image.width / 2, -image.height / 2)

  const scale = Math.min(1, MAX_AVATAR_SIZE / Math.max(pixelCrop.width, pixelCrop.height))
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(pixelCrop.width * scale))
  out.height = Math.max(1, Math.round(pixelCrop.height * scale))
  const outCtx = out.getContext('2d')
  outCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    out.width,
    out.height,
  )

  return new Promise((resolve, reject) => {
    out.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('No se pudo generar la imagen recortada'))
          return
        }
        blob.name = 'avatar.jpeg'
        resolve(blob)
      },
      'image/jpeg',
      0.92,
    )
  })
}
