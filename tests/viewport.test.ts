import { describe, expect, it } from 'vitest'
import {
  docToScreen,
  fitViewport,
  screenToDoc,
  screenToDocExact,
  stepZoom,
  zoomAt,
  ZOOM_LEVELS,
  type Viewport
} from '../src/renderer/src/model/viewport'

describe('conversion des coordonnées', () => {
  const vp: Viewport = { zoom: 8, panX: 100, panY: 50 }

  it("convertit un point écran en pixel du document", () => {
    expect(screenToDoc(vp, 100, 50)).toEqual({ x: 0, y: 0 })
    expect(screenToDoc(vp, 107.9, 57.9)).toEqual({ x: 0, y: 0 })
    expect(screenToDoc(vp, 108, 58)).toEqual({ x: 1, y: 1 })
    expect(screenToDoc(vp, 100 + 8 * 5 + 3, 50 + 8 * 2)).toEqual({ x: 5, y: 2 })
  })

  it('arrondit vers le bas à gauche et au-dessus de l’image (coordonnées négatives)', () => {
    expect(screenToDoc(vp, 99, 49)).toEqual({ x: -1, y: -1 })
    expect(screenToDoc(vp, 92, 42)).toEqual({ x: -1, y: -1 })
    expect(screenToDoc(vp, 91.9, 41.9)).toEqual({ x: -2, y: -2 })
  })

  it('docToScreen est l’inverse de screenToDoc', () => {
    for (const [x, y] of [
      [0, 0],
      [3, 7],
      [-2, 5],
      [31, 31]
    ]) {
      const s = docToScreen(vp, x, y)
      expect(screenToDoc(vp, s.x, s.y)).toEqual({ x, y })
      expect(screenToDoc(vp, s.x + vp.zoom - 0.01, s.y + vp.zoom - 0.01)).toEqual({ x, y })
    }
  })

  it('gère les zooms fractionnaires', () => {
    const small: Viewport = { zoom: 0.5, panX: 0, panY: 0 }
    expect(screenToDoc(small, 10, 10)).toEqual({ x: 20, y: 20 })
    expect(screenToDocExact(small, 1, 1)).toEqual({ x: 2, y: 2 })
  })

  it('zoomAt garde le point sous le curseur immobile', () => {
    const before = screenToDocExact(vp, 260, 210)
    const after = zoomAt(vp, 16, 260, 210)
    expect(after.zoom).toBe(16)
    const p = screenToDocExact(after, 260, 210)
    expect(p.x).toBeCloseTo(before.x, 1)
    expect(p.y).toBeCloseTo(before.y, 1)
  })

  it('stepZoom parcourt les niveaux prédéfinis et reste dans les bornes', () => {
    expect(stepZoom(8, 1)).toBe(12)
    expect(stepZoom(8, -1)).toBe(6)
    expect(stepZoom(5, 1)).toBe(6)
    expect(stepZoom(ZOOM_LEVELS[ZOOM_LEVELS.length - 1], 1)).toBe(ZOOM_LEVELS[ZOOM_LEVELS.length - 1])
    expect(stepZoom(ZOOM_LEVELS[0], -1)).toBe(ZOOM_LEVELS[0])
  })

  it('fitViewport centre l’image avec le plus grand zoom qui tient', () => {
    const fit = fitViewport(32, 32, 800, 600, 24)
    expect(fit.zoom).toBe(16) // 552 / 32 = 17.25 → 16
    expect(fit.panX).toBe((800 - 32 * 16) / 2)
    expect(fit.panY).toBe((600 - 32 * 16) / 2)
    // Image plus grande que la zone : facteur exact (0,4) plutôt que le niveau inférieur.
    const big = fitViewport(2000, 1000, 800, 600, 0)
    expect(big.zoom).toBe(0.4)
    expect(fitViewport(1254, 1254, 1082, 648).zoom).toBe(0.47)
    expect(fitViewport(100000, 100000, 800, 600).zoom).toBe(0.125)
  })
})
