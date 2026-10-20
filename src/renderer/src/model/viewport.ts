import type { Point } from './bitmap'

/**
 * Vue sur le document : un pixel du document (x, y) est affiché à
 * l'écran en `(panX + x * zoom, panY + y * zoom)` (unités CSS).
 */
export interface Viewport {
  zoom: number
  panX: number
  panY: number
}

/** Niveaux de zoom proposés (facteur d'agrandissement). */
export const ZOOM_LEVELS = [0.125, 0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128] as const
export const MIN_ZOOM = ZOOM_LEVELS[0]
export const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1]

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

/** Coordonnées écran → coordonnées réelles dans le document (non arrondies). */
export function screenToDocExact(vp: Viewport, sx: number, sy: number): Point {
  return { x: (sx - vp.panX) / vp.zoom, y: (sy - vp.panY) / vp.zoom }
}

/** Coordonnées écran → pixel du document qui contient ce point (arrondi vers le bas). */
export function screenToDoc(vp: Viewport, sx: number, sy: number): Point {
  const p = screenToDocExact(vp, sx, sy)
  return { x: Math.floor(p.x), y: Math.floor(p.y) }
}

/** Coin supérieur gauche du pixel (x, y) en coordonnées écran. */
export function docToScreen(vp: Viewport, x: number, y: number): Point {
  return { x: vp.panX + x * vp.zoom, y: vp.panY + y * vp.zoom }
}

/** Change le zoom en gardant fixe le point écran (sx, sy). */
export function zoomAt(vp: Viewport, newZoom: number, sx: number, sy: number): Viewport {
  const zoom = clampZoom(newZoom)
  const p = screenToDocExact(vp, sx, sy)
  return { zoom, panX: Math.round(sx - p.x * zoom), panY: Math.round(sy - p.y * zoom) }
}

/** Niveau de zoom suivant (direction > 0) ou précédent (direction < 0) dans `ZOOM_LEVELS`. */
export function stepZoom(current: number, direction: number): number {
  if (direction > 0) {
    for (const z of ZOOM_LEVELS) if (z > current + 1e-9) return z
    return MAX_ZOOM
  }
  for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) if (ZOOM_LEVELS[i] < current - 1e-9) return ZOOM_LEVELS[i]
  return MIN_ZOOM
}

/**
 * Zoom et position qui font tenir l'image entière dans la zone visible, centrée,
 * avec une marge. Pour un agrandissement, le zoom choisi est le plus grand niveau
 * de `ZOOM_LEVELS` qui convient (pixels de taille identique) ; pour une image plus
 * grande que la zone, c'est le facteur exact, arrondi au centième inférieur.
 */
export function fitViewport(docW: number, docH: number, viewW: number, viewH: number, margin = 24): Viewport {
  const availW = Math.max(1, viewW - margin * 2)
  const availH = Math.max(1, viewH - margin * 2)
  const ideal = Math.min(availW / docW, availH / docH)
  let zoom: number
  if (ideal >= 1) {
    zoom = 1
    for (const z of ZOOM_LEVELS) if (z <= ideal) zoom = z
  } else {
    zoom = clampZoom(Math.floor(ideal * 100) / 100)
  }
  return centerViewport(docW, docH, viewW, viewH, zoom)
}

export function centerViewport(docW: number, docH: number, viewW: number, viewH: number, zoom: number): Viewport {
  return {
    zoom,
    panX: Math.round((viewW - docW * zoom) / 2),
    panY: Math.round((viewH - docH * zoom) / 2)
  }
}
