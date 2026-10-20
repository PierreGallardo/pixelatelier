import type { RGBA } from './color'

/**
 * Tampon de pixels RGBA 8 bits non prémultipliés, ligne par ligne.
 * L'octet du pixel (x, y) commence à `(y * width + x) * 4`.
 */
export interface Bitmap {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export function createBitmap(width: number, height: number, fill?: RGBA): Bitmap {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError(`Dimensions invalides : ${width}×${height}`)
  }
  const data = new Uint8ClampedArray(width * height * 4)
  const bmp: Bitmap = { width, height, data }
  if (fill && fill.a > 0) fillBitmap(bmp, fill)
  return bmp
}

export function cloneBitmap(src: Bitmap): Bitmap {
  return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) }
}

export function fillBitmap(bmp: Bitmap, c: RGBA): void {
  const d = bmp.data
  for (let i = 0; i < d.length; i += 4) {
    d[i] = c.r
    d[i + 1] = c.g
    d[i + 2] = c.b
    d[i + 3] = c.a
  }
}

export function inBounds(bmp: Bitmap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < bmp.width && y < bmp.height
}

export function getPixel(bmp: Bitmap, x: number, y: number): RGBA {
  const i = (y * bmp.width + x) * 4
  const d = bmp.data
  return { r: d[i], g: d[i + 1], b: d[i + 2], a: d[i + 3] }
}

/** Écrit un pixel (remplacement, sans mélange). Ignore silencieusement les points hors limites. */
export function setPixel(bmp: Bitmap, x: number, y: number, c: RGBA): boolean {
  if (x < 0 || y < 0 || x >= bmp.width || y >= bmp.height) return false
  const i = (y * bmp.width + x) * 4
  const d = bmp.data
  d[i] = c.r
  d[i + 1] = c.g
  d[i + 2] = c.b
  d[i + 3] = c.a
  return true
}

export function isEmpty(bmp: Bitmap): boolean {
  const d = bmp.data
  for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false
  return true
}

/* ----------------------------- Rectangles ----------------------------- */

export function rectFromPoints(x0: number, y0: number, x1: number, y1: number): Rect {
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  return { x, y, w: Math.abs(x1 - x0) + 1, h: Math.abs(y1 - y0) + 1 }
}

export function unionRect(a: Rect | null, b: Rect | null): Rect | null {
  if (!a) return b ? { ...b } : null
  if (!b) return { ...a }
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const r = Math.max(a.x + a.w, b.x + b.w)
  const btm = Math.max(a.y + a.h, b.y + b.h)
  return { x, y, w: r - x, h: btm - y }
}

/** Intersection d'un rectangle avec les limites d'une image ; `null` si vide. */
export function clipRect(r: Rect, width: number, height: number): Rect | null {
  const x0 = Math.max(0, r.x)
  const y0 = Math.max(0, r.y)
  const x1 = Math.min(width, r.x + r.w)
  const y1 = Math.min(height, r.y + r.h)
  if (x1 <= x0 || y1 <= y0) return null
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/** Copie une zone rectangulaire (déjà clippée) dans un nouveau tableau compact. */
export function readRect(bmp: Bitmap, r: Rect): Uint8ClampedArray {
  const out = new Uint8ClampedArray(r.w * r.h * 4)
  const rowBytes = r.w * 4
  for (let row = 0; row < r.h; row++) {
    const src = ((r.y + row) * bmp.width + r.x) * 4
    out.set(bmp.data.subarray(src, src + rowBytes), row * rowBytes)
  }
  return out
}

/** Écrit un tableau compact (issu de `readRect`) dans une zone rectangulaire. */
export function writeRect(bmp: Bitmap, r: Rect, pixels: Uint8ClampedArray): void {
  const rowBytes = r.w * 4
  for (let row = 0; row < r.h; row++) {
    const dst = ((r.y + row) * bmp.width + r.x) * 4
    bmp.data.set(pixels.subarray(row * rowBytes, row * rowBytes + rowBytes), dst)
  }
}

/**
 * Plus petit rectangle contenant les pixels qui diffèrent entre `a` et `b`
 * (même taille), limité à `within` si fourni. `null` si aucune différence.
 */
export function diffBounds(a: Uint8ClampedArray, b: Uint8ClampedArray, width: number, height: number, within?: Rect | null): Rect | null {
  const area = within ? clipRect(within, width, height) : { x: 0, y: 0, w: width, h: height }
  if (!area) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  for (let y = area.y; y < area.y + area.h; y++) {
    let i = (y * width + area.x) * 4
    for (let x = area.x; x < area.x + area.w; x++, i += 4) {
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

/* ------------------------- Transformations ------------------------- */

export function flipHorizontal(src: Bitmap): Bitmap {
  const out = createBitmap(src.width, src.height)
  const s32 = new Uint32Array(src.data.buffer, src.data.byteOffset, src.width * src.height)
  const o32 = new Uint32Array(out.data.buffer)
  for (let y = 0; y < src.height; y++) {
    const row = y * src.width
    for (let x = 0; x < src.width; x++) o32[row + x] = s32[row + src.width - 1 - x]
  }
  return out
}

export function flipVertical(src: Bitmap): Bitmap {
  const out = createBitmap(src.width, src.height)
  const rowBytes = src.width * 4
  for (let y = 0; y < src.height; y++) {
    const from = (src.height - 1 - y) * rowBytes
    out.data.set(src.data.subarray(from, from + rowBytes), y * rowBytes)
  }
  return out
}

/** Rotation de 90° ; `clockwise` = sens horaire. La largeur et la hauteur sont échangées. */
export function rotate90(src: Bitmap, clockwise: boolean): Bitmap {
  const w = src.width
  const h = src.height
  const out = createBitmap(h, w)
  const s32 = new Uint32Array(src.data.buffer, src.data.byteOffset, w * h)
  const o32 = new Uint32Array(out.data.buffer)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Sens horaire : (x, y) -> (h - 1 - y, x) ; antihoraire : (x, y) -> (y, w - 1 - x)
      const nx = clockwise ? h - 1 - y : y
      const ny = clockwise ? x : w - 1 - x
      o32[ny * h + nx] = s32[y * w + x]
    }
  }
  return out
}

/** Copie `src` dans une nouvelle image de taille `width`×`height`, décalée de (offsetX, offsetY). */
export function resizeCanvas(src: Bitmap, width: number, height: number, offsetX: number, offsetY: number): Bitmap {
  const out = createBitmap(width, height)
  const area = clipRect({ x: offsetX, y: offsetY, w: src.width, h: src.height }, width, height)
  if (!area) return out
  for (let y = area.y; y < area.y + area.h; y++) {
    const sy = y - offsetY
    const sx = area.x - offsetX
    const from = (sy * src.width + sx) * 4
    out.data.set(src.data.subarray(from, from + area.w * 4), (y * width + area.x) * 4)
  }
  return out
}

/** Redimensionnement au plus proche voisin (aucun lissage). */
export function scaleNearest(src: Bitmap, width: number, height: number): Bitmap {
  const out = createBitmap(width, height)
  const s32 = new Uint32Array(src.data.buffer, src.data.byteOffset, src.width * src.height)
  const o32 = new Uint32Array(out.data.buffer)
  for (let y = 0; y < height; y++) {
    const sy = Math.min(src.height - 1, Math.floor((y * src.height) / height))
    for (let x = 0; x < width; x++) {
      const sx = Math.min(src.width - 1, Math.floor((x * src.width) / width))
      o32[y * width + x] = s32[sy * src.width + sx]
    }
  }
  return out
}
