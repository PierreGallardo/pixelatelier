import { clipRect, type Bitmap, type Point, type Rect } from '../model/bitmap'
import type { RGBA } from '../model/color'
import { brushRect } from './brush'

/**
 * Symétrie de dessin.
 *
 * Les axes sont des positions dans le document, en pixels, multiples de 0,5 :
 * `axisX = 16` passe entre les colonnes 15 et 16 ; `axisX = 16.5` passe au milieu
 * de la colonne 16. Le symétrique de la colonne `x` est `2 × axisX − 1 − x`.
 */
export interface Symmetry {
  /** Miroir gauche/droite (axe vertical). */
  mirrorX: boolean
  /** Miroir haut/bas (axe horizontal). */
  mirrorY: boolean
  axisX: number
  axisY: number
}

export const NO_SYMMETRY: Symmetry = { mirrorX: false, mirrorY: false, axisX: 0, axisY: 0 }

export function isSymmetryActive(sym: Symmetry | null | undefined): sym is Symmetry {
  return !!sym && (sym.mirrorX || sym.mirrorY)
}

/** Ramène un axe sur un multiple de 0,5 compris dans [0, taille]. */
export function snapAxis(value: number, size: number): number {
  if (!Number.isFinite(value)) return size / 2
  return Math.min(size, Math.max(0, Math.round(value * 2) / 2))
}

const mirrorCoord = (v: number, axis: number): number => 2 * axis - 1 - v

/** Le point et ses symétriques (sans doublon ; jusqu'à 4 points). */
export function mirrorPoints(x: number, y: number, sym: Symmetry): Point[] {
  const out: Point[] = [{ x, y }]
  if (sym.mirrorX) out.push({ x: mirrorCoord(x, sym.axisX), y })
  if (sym.mirrorY) for (const p of [...out]) out.push({ x: p.x, y: mirrorCoord(p.y, sym.axisY) })
  return out.filter((p, i) => out.findIndex((q) => q.x === p.x && q.y === p.y) === i)
}

/** Le rectangle et ses symétriques (jusqu'à 4). */
export function mirrorRects(r: Rect, sym: Symmetry): Rect[] {
  const out: Rect[] = [{ ...r }]
  if (sym.mirrorX) out.push({ x: mirrorCoord(r.x + r.w - 1, sym.axisX), y: r.y, w: r.w, h: r.h })
  if (sym.mirrorY) for (const q of [...out]) out.push({ x: q.x, y: mirrorCoord(q.y + q.h - 1, sym.axisY), w: q.w, h: q.h })
  return out
}

/** Rectangle englobant d'une zone et de tous ses symétriques. */
export function mirroredBounds(r: Rect, sym: Symmetry | null): Rect {
  if (!isSymmetryActive(sym)) return r
  const all = mirrorRects(r, sym)
  const x0 = Math.min(...all.map((q) => q.x))
  const y0 = Math.min(...all.map((q) => q.y))
  const x1 = Math.max(...all.map((q) => q.x + q.w))
  const y1 = Math.max(...all.map((q) => q.y + q.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function fillRect(bmp: Bitmap, r: Rect, c: RGBA): void {
  const area = clipRect(r, bmp.width, bmp.height)
  if (!area) return
  const d = bmp.data
  for (let y = area.y; y < area.y + area.h; y++) {
    for (let i = (y * bmp.width + area.x) * 4, end = i + area.w * 4; i < end; i += 4) {
      d[i] = c.r
      d[i + 1] = c.g
      d[i + 2] = c.b
      d[i + 3] = c.a
    }
  }
}

/**
 * Applique une brosse carrée et ses symétriques. L'empreinte entière est
 * reflétée (et non seulement son centre) : le résultat est exactement symétrique,
 * même pour une brosse de taille paire.
 */
export function stampBrushSymmetric(bmp: Bitmap, x: number, y: number, size: number, color: RGBA, sym: Symmetry | null): void {
  const r = brushRect(x, y, size)
  for (const q of isSymmetryActive(sym) ? mirrorRects(r, sym) : [r]) fillRect(bmp, q, color)
}
