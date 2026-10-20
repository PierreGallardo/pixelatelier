import type { Bitmap } from '../model/bitmap'

export interface WandOptions {
  /** Vrai : zone connectée (4-voisinage). Faux : toutes les occurrences dans l'image. */
  contiguous: boolean
  /** Écart maximal toléré par composante (0 = couleur exacte, 255 = tout). */
  tolerance: number
}

/**
 * Écart entre deux couleurs RGBA. Si l'une des deux est totalement transparente,
 * seule la différence d'alpha compte (la teinte d'un pixel transparent n'a pas de sens).
 */
export function colorDistance(d: Uint8ClampedArray, i: number, r: number, g: number, b: number, a: number): number {
  const pa = d[i + 3]
  if (pa === 0 || a === 0) return Math.abs(pa - a)
  return Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b), Math.abs(pa - a))
}

/**
 * Baguette magique : masque (1 octet par pixel) des pixels de même couleur que
 * le pixel (x, y), à la tolérance près. Remplissage itératif par segments, sans
 * récursion. Retourne `null` si le point est hors de l'image.
 */
export function magicWandMask(bmp: Bitmap, x: number, y: number, opts: WandOptions): Uint8Array | null {
  const { width: w, height: h, data } = bmp
  if (x < 0 || y < 0 || x >= w || y >= h) return null
  const ti = (y * w + x) * 4
  const tr = data[ti]
  const tg = data[ti + 1]
  const tb = data[ti + 2]
  const ta = data[ti + 3]
  const tol = Math.min(255, Math.max(0, Math.round(opts.tolerance)))
  const mask = new Uint8Array(w * h)
  const matches = (p: number): boolean => colorDistance(data, p * 4, tr, tg, tb, ta) <= tol

  if (!opts.contiguous) {
    for (let p = 0; p < w * h; p++) if (matches(p)) mask[p] = 1
    return mask
  }

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
  const free = (p: number): boolean => mask[p] === 0 && matches(p)
  while (sp > 0) {
    const sy = stack[--sp]
    const sx = stack[--sp]
    const row = sy * w
    if (!free(row + sx)) continue
    let lx = sx
    while (lx > 0 && free(row + lx - 1)) lx--
    let rx = sx
    while (rx < w - 1 && free(row + rx + 1)) rx++
    mask.fill(1, row + lx, row + rx + 1)
    for (const ny of [sy - 1, sy + 1]) {
      if (ny < 0 || ny >= h) continue
      const nrow = ny * w
      let inSpan = false
      for (let i = lx; i <= rx; i++) {
        if (free(nrow + i)) {
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
  return mask
}
