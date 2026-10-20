import { clipRect, type Rect } from './bitmap'
import type { RGBA } from './color'
import type { PixelDocument } from './document'

/**
 * Composition des calques (opérateur « source-over » en couleurs non prémultipliées).
 *
 * Chaque calque visible est posé sur le résultat des calques inférieurs ; son
 * alpha est multiplié par l'opacité du calque.
 */

/** Mélange une couleur source (alpha `sa` dans [0, 255], réel) sur `out[i..i+3]`. */
function blendInto(out: Uint8ClampedArray, i: number, sr: number, sg: number, sb: number, sa: number): void {
  if (sa <= 0) return
  const da = out[i + 3]
  if (sa >= 255 || da === 0) {
    out[i] = sr
    out[i + 1] = sg
    out[i + 2] = sb
    out[i + 3] = sa
    return
  }
  const s = sa / 255
  const d = (da / 255) * (1 - s)
  const oa = s + d
  out[i] = (sr * s + out[i] * d) / oa
  out[i + 1] = (sg * s + out[i + 1] * d) / oa
  out[i + 2] = (sb * s + out[i + 2] * d) / oa
  out[i + 3] = oa * 255
}

export interface ComposeOptions {
  /** Zone à recalculer (par défaut : toute l'image). Hors de cette zone, `out` n'est pas modifié. */
  rect?: Rect | null
  /** Tampon de sortie de taille `width * height * 4` à réutiliser. */
  out?: Uint8ClampedArray<ArrayBuffer>
  /** Inclure les calques masqués (faux par défaut). */
  includeHidden?: boolean
}

/**
 * Compose tous les calques visibles de l'image `frameIndex`.
 * Retourne un tampon RGBA de la taille du document.
 */
export function composeFrame(doc: PixelDocument, frameIndex: number, opts: ComposeOptions = {}): Uint8ClampedArray<ArrayBuffer> {
  const { width, height } = doc
  const out = opts.out ?? new Uint8ClampedArray(width * height * 4)
  if (out.length !== width * height * 4) throw new RangeError('Tampon de composition de taille incorrecte')
  const area = opts.rect ? clipRect(opts.rect, width, height) : { x: 0, y: 0, w: width, h: height }
  if (!area) return out

  // Remise à zéro de la zone
  for (let y = area.y; y < area.y + area.h; y++) {
    const start = (y * width + area.x) * 4
    out.fill(0, start, start + area.w * 4)
  }

  for (const layer of doc.layers) {
    if ((!layer.visible && !opts.includeHidden) || layer.opacity <= 0) continue
    const cel = layer.cels[frameIndex]
    if (!cel) continue
    const src = cel.data
    const op = layer.opacity
    for (let y = area.y; y < area.y + area.h; y++) {
      let i = (y * width + area.x) * 4
      const end = i + area.w * 4
      for (; i < end; i += 4) {
        const a = src[i + 3]
        if (a === 0) continue
        blendInto(out, i, src[i], src[i + 1], src[i + 2], a * op)
      }
    }
  }
  return out
}

/** Couleur composée d'un seul pixel (pour la pipette). */
export function composePixel(doc: PixelDocument, frameIndex: number, x: number, y: number): RGBA {
  const tmp = new Uint8ClampedArray(4)
  if (x < 0 || y < 0 || x >= doc.width || y >= doc.height) return { r: 0, g: 0, b: 0, a: 0 }
  const i = (y * doc.width + x) * 4
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    const cel = layer.cels[frameIndex]
    if (!cel) continue
    const d = cel.data
    if (d[i + 3] === 0) continue
    blendInto(tmp, 0, d[i], d[i + 1], d[i + 2], d[i + 3] * layer.opacity)
  }
  return { r: tmp[0], g: tmp[1], b: tmp[2], a: tmp[3] }
}
