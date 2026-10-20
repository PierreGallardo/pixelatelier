import { toArrayBufferView } from '../io/binary'
import { MAX_DIMENSION } from '../model/document'

/**
 * Décode une image (PNG, GIF, JPEG, WebP, BMP) en pixels RGBA grâce au
 * décodeur du navigateur. Pour un GIF animé, seule la première image est lue.
 */
export async function decodeImageBytes(bytes: Uint8Array): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(new Blob([toArrayBufferView(bytes)]), {
      premultiplyAlpha: 'none',
      colorSpaceConversion: 'none'
    })
  } catch {
    throw new Error("Impossible de lire cette image (format non reconnu ou fichier endommagé).")
  }
  try {
    const { width, height } = bitmap
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      throw new Error(`Image trop grande (${width}×${height}) : ${MAX_DIMENSION}×${MAX_DIMENSION} pixels au maximum.`)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Canevas 2D indisponible.')
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(bitmap, 0, 0)
    const img = ctx.getImageData(0, 0, width, height)
    return { width, height, data: new Uint8ClampedArray(img.data) }
  } finally {
    bitmap.close()
  }
}
