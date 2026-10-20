import type { Bitmap, Rect } from '../model/bitmap'
import type { RGBA } from '../model/color'

/** Empaquette une couleur dans l'ordre mémoire natif d'un `Uint32Array` sur RGBA. */
export function packColor(c: RGBA): number {
  const tmp = new Uint8ClampedArray([c.r, c.g, c.b, c.a])
  return new Uint32Array(tmp.buffer)[0]
}

function pixelsView(bmp: Bitmap): Uint32Array {
  return new Uint32Array(bmp.data.buffer, bmp.data.byteOffset, bmp.width * bmp.height)
}

const ALPHA_MASK = packColor({ r: 0, g: 0, b: 0, a: 255 })

export interface FillOptions {
  /** Vrai : seulement la zone connexe (4-voisinage). Faux : toutes les occurrences de la couleur. */
  contiguous?: boolean
}

/**
 * Pot de peinture. Remplace la couleur du pixel (x, y) par `color`.
 *
 * Implémentation itérative par segments horizontaux (« scanline ») avec une pile
 * explicite : aucune récursion, la mémoire utilisée reste bornée par la taille de l'image.
 * Tous les pixels totalement transparents sont considérés comme de la même couleur,
 * quelle que soit leur composante RGB.
 *
 * Retourne le rectangle modifié, ou `null` si rien n'a changé.
 */
export function floodFill(bmp: Bitmap, x: number, y: number, color: RGBA, opts: FillOptions = {}): Rect | null {
  const { width: w, height: h } = bmp
  if (x < 0 || y < 0 || x >= w || y >= h) return null
  const px = pixelsView(bmp)
  const target = px[y * w + x]
  const targetTransparent = (target & ALPHA_MASK) === 0
  const replacement = packColor(color)
  const matches = targetTransparent ? (v: number) => (v & ALPHA_MASK) === 0 : (v: number) => v === target
  // Remplir avec une couleur équivalente ne change rien (et bouclerait indéfiniment).
  if (matches(replacement)) return null

  let minX = x
  let maxX = x
  let minY = y
  let maxY = y

  if (opts.contiguous === false) {
    let changed = false
    for (let i = 0; i < px.length; i++) {
      if (matches(px[i])) {
        px[i] = replacement
        const cx = i % w
        const cy = (i - cx) / w
        if (!changed) {
          minX = maxX = cx
          minY = maxY = cy
          changed = true
        } else {
          if (cx < minX) minX = cx
          if (cx > maxX) maxX = cx
          if (cy < minY) minY = cy
          if (cy > maxY) maxY = cy
        }
      }
    }
    return changed ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null
  }

  // Pile de graines (x, y) dans un tableau d'entiers qui grandit au besoin.
  let stack = new Int32Array(256)
  let sp = 0
  const push = (sx: number, sy: number): void => {
    if (sp + 2 > stack.length) {
      const bigger = new Int32Array(stack.length * 2)
      bigger.set(stack)
      stack = bigger
    }
    stack[sp++] = sx
    stack[sp++] = sy
  }
  push(x, y)

  while (sp > 0) {
    const sy = stack[--sp]
    const sx = stack[--sp]
    const row = sy * w
    if (!matches(px[row + sx])) continue
    let lx = sx
    while (lx > 0 && matches(px[row + lx - 1])) lx--
    let rx = sx
    while (rx < w - 1 && matches(px[row + rx + 1])) rx++
    for (let i = lx; i <= rx; i++) px[row + i] = replacement
    if (lx < minX) minX = lx
    if (rx > maxX) maxX = rx
    if (sy < minY) minY = sy
    if (sy > maxY) maxY = sy

    for (const ny of [sy - 1, sy + 1]) {
      if (ny < 0 || ny >= h) continue
      const nrow = ny * w
      let inSpan = false
      for (let i = lx; i <= rx; i++) {
        if (matches(px[nrow + i])) {
          if (!inSpan) {
            push(i, ny)
            inSpan = true
          }
        } else {
          inSpan = false
        }
      }
    }
  }
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}
