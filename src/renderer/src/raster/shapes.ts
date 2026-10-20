import type { Point } from '../model/bitmap'

/**
 * Algorithmes de tracé entiers : chaque point produit correspond exactement à
 * un pixel de la grille, sans anticrénelage.
 */
export type Plot = (x: number, y: number) => void

/** Ligne de Bresenham (8-connexe), extrémités incluses, dans tous les octants. */
export function plotLine(x0: number, y0: number, x1: number, y1: number, plot: Plot): void {
  x0 = Math.round(x0)
  y0 = Math.round(y0)
  x1 = Math.round(x1)
  y1 = Math.round(y1)
  const dx = Math.abs(x1 - x0)
  const dy = -Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx + dy
  for (;;) {
    plot(x0, y0)
    if (x0 === x1 && y0 === y1) break
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x0 += sx
    }
    if (e2 <= dx) {
      err += dx
      y0 += sy
    }
  }
}

export function linePoints(x0: number, y0: number, x1: number, y1: number): Point[] {
  const pts: Point[] = []
  plotLine(x0, y0, x1, y1, (x, y) => pts.push({ x, y }))
  return pts
}

/** Rectangle aligné sur la grille entre deux coins (inclus). */
export function plotRect(x0: number, y0: number, x1: number, y1: number, filled: boolean, plot: Plot): void {
  const left = Math.min(x0, x1)
  const right = Math.max(x0, x1)
  const top = Math.min(y0, y1)
  const bottom = Math.max(y0, y1)
  if (filled) {
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) plot(x, y)
    return
  }
  for (let x = left; x <= right; x++) {
    plot(x, top)
    if (bottom !== top) plot(x, bottom)
  }
  for (let y = top + 1; y < bottom; y++) {
    plot(left, y)
    if (right !== left) plot(right, y)
  }
}

/**
 * Ellipse inscrite dans le rectangle (x0, y0)–(x1, y1), coins inclus.
 * Algorithme incrémental entier d'après A. Zingl, « A Rasterizing Algorithm
 * for Drawing Curves » (2012), qui gère les diamètres pairs et impairs.
 */
export function plotEllipse(x0: number, y0: number, x1: number, y1: number, filled: boolean, plot: Plot): void {
  const left = Math.min(x0, x1)
  const right = Math.max(x0, x1)
  const top = Math.min(y0, y1)
  const bottom = Math.max(y0, y1)

  // Étendue horizontale par ligne : sert au remplissage et garantit des points uniques.
  const rows = bottom - top + 1
  const minX = new Int32Array(rows).fill(2147483647)
  const maxX = new Int32Array(rows).fill(-2147483648)
  const outline: number[] = []
  const put = (x: number, y: number): void => {
    if (x < left || x > right || y < top || y > bottom) return
    const r = y - top
    if (x < minX[r]) minX[r] = x
    if (x > maxX[r]) maxX[r] = x
    outline.push(x, y)
  }

  let a = right - left
  const b = bottom - top
  let b1 = b & 1
  let dx = 4 * (1 - a) * b * b
  let dy = 4 * (b1 + 1) * a * a
  let err = dx + dy + b1 * a * a
  let e2: number
  let xa = left
  let xb = right
  let ya = top + ((b + 1) >> 1)
  let yb = ya - b1
  a = 8 * a * a
  b1 = 8 * b * b

  do {
    put(xb, ya)
    put(xa, ya)
    put(xa, yb)
    put(xb, yb)
    e2 = 2 * err
    if (e2 <= dy) {
      ya++
      yb--
      dy += a
      err += dy
    }
    if (e2 >= dx || 2 * err > dy) {
      xa++
      xb--
      dx += b1
      err += dx
    }
  } while (xa <= xb)

  // Ellipses très plates : termine les pointes.
  while (ya - yb <= b) {
    put(xa - 1, ya)
    put(xb + 1, ya)
    ya++
    put(xa - 1, yb)
    put(xb + 1, yb)
    yb--
  }

  if (filled) {
    for (let r = 0; r < rows; r++) {
      if (maxX[r] < minX[r]) continue
      for (let x = minX[r]; x <= maxX[r]; x++) plot(x, top + r)
    }
    return
  }
  const seen = new Set<number>()
  const w = right - left + 1
  for (let i = 0; i < outline.length; i += 2) {
    const key = (outline[i + 1] - top) * w + (outline[i] - left)
    if (seen.has(key)) continue
    seen.add(key)
    plot(outline[i], outline[i + 1])
  }
}

function sign(v: number): number {
  return v < 0 ? -1 : 1
}

/** Contraint l'extrémité d'une ligne aux angles multiples de 45°. */
export function constrainLine(x0: number, y0: number, x1: number, y1: number): Point {
  const dx = x1 - x0
  const dy = y1 - y0
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  if (ady * 2 < adx) return { x: x1, y: y0 }
  if (adx * 2 < ady) return { x: x0, y: y1 }
  const d = Math.max(adx, ady)
  return { x: x0 + sign(dx) * d, y: y0 + sign(dy) * d }
}

/** Contraint le second coin pour obtenir un carré (ou un cercle). */
export function constrainSquare(x0: number, y0: number, x1: number, y1: number): Point {
  const dx = x1 - x0
  const dy = y1 - y0
  const d = Math.max(Math.abs(dx), Math.abs(dy))
  return { x: x0 + sign(dx) * d, y: y0 + sign(dy) * d }
}
