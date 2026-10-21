import { describe, expect, it } from 'vitest'
import { createBitmap, getPixel } from '../src/renderer/src/model/bitmap'
import { createDocument } from '../src/renderer/src/model/document'
import { rectSelection } from '../src/renderer/src/model/selection'
import { mirroredBounds, mirrorPoints, mirrorRects, snapAxis, stampBrushSymmetric, type Symmetry } from '../src/renderer/src/raster/symmetry'
import { Editor, type ToolId } from '../src/renderer/src/editor/Editor'
import { createToolBehavior, type ToolPointer } from '../src/renderer/src/tools/tools'
import { RED, opaqueSet } from './helpers'

const sym = (patch: Partial<Symmetry>): Symmetry => ({ mirrorX: false, mirrorY: false, axisX: 4, axisY: 4, ...patch })

describe('calcul de la symétrie', () => {
  it('axe entre deux colonnes (taille paire)', () => {
    expect(mirrorPoints(0, 2, sym({ mirrorX: true }))).toEqual([
      { x: 0, y: 2 },
      { x: 7, y: 2 }
    ])
    expect(mirrorPoints(3, 2, sym({ mirrorX: true }))).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 2 }
    ])
  })

  it('axe au milieu d’une colonne : le pixel central n’est pas dupliqué', () => {
    expect(mirrorPoints(4, 0, sym({ mirrorX: true, axisX: 4.5 }))).toEqual([{ x: 4, y: 0 }])
    expect(mirrorPoints(2, 0, sym({ mirrorX: true, axisX: 4.5 }))).toEqual([
      { x: 2, y: 0 },
      { x: 6, y: 0 }
    ])
  })

  it('deux axes : quatre points', () => {
    expect(mirrorPoints(1, 2, sym({ mirrorX: true, mirrorY: true }))).toEqual([
      { x: 1, y: 2 },
      { x: 6, y: 2 },
      { x: 1, y: 5 },
      { x: 6, y: 5 }
    ])
  })

  it('reflète les rectangles et calcule leur englobant', () => {
    expect(mirrorRects({ x: 0, y: 0, w: 2, h: 1 }, sym({ mirrorX: true }))).toEqual([
      { x: 0, y: 0, w: 2, h: 1 },
      { x: 6, y: 0, w: 2, h: 1 }
    ])
    expect(mirroredBounds({ x: 1, y: 1, w: 1, h: 1 }, sym({ mirrorX: true, mirrorY: true }))).toEqual({ x: 1, y: 1, w: 6, h: 6 })
    expect(mirroredBounds({ x: 1, y: 1, w: 1, h: 1 }, null)).toEqual({ x: 1, y: 1, w: 1, h: 1 })
  })

  it('une brosse de taille paire reste exactement symétrique', () => {
    const bmp = createBitmap(8, 4)
    stampBrushSymmetric(bmp, 1, 1, 2, RED, sym({ mirrorX: true }))
    const s = opaqueSet(bmp)
    for (const k of s) {
      const [x, y] = k.split(',').map(Number)
      expect(s.has(`${7 - x},${y}`)).toBe(true)
    }
    expect(s.size).toBe(8)
  })

  it('aligne les axes sur des demi-pixels dans l’image', () => {
    expect(snapAxis(3.3, 8)).toBe(3.5)
    expect(snapAxis(-2, 8)).toBe(0)
    expect(snapAxis(99, 8)).toBe(8)
    expect(snapAxis(Number.NaN, 8)).toBe(4)
  })
})

function setup(w = 8, h = 8): Editor {
  const e = new Editor()
  e.setDocument(createDocument({ width: w, height: h }), null)
  e.primary = { ...RED }
  return e
}

function drag(e: Editor, tool: ToolId, points: [number, number][]): void {
  const p = (x: number, y: number): ToolPointer => ({ x, y, button: 0, shift: false, alt: false })
  const b = createToolBehavior(e, tool)
  b.down(p(points[0][0], points[0][1]))
  for (const [x, y] of points.slice(1)) b.move(p(x, y))
  const last = points[points.length - 1]
  b.up(p(last[0], last[1]))
}

const cel = (e: Editor) => e.doc!.layers[e.activeLayer].cels[e.activeFrame]

describe('outils avec symétrie', () => {
  it('inactive par défaut', () => {
    const e = setup()
    expect(e.activeSymmetry).toBeNull()
    drag(e, 'pencil', [[1, 1]])
    expect(opaqueSet(cel(e)).size).toBe(1)
  })

  it('crayon : gauche/droite autour du centre, une seule annulation', () => {
    const e = setup()
    e.setSymmetry({ mirrorX: true })
    expect(e.activeSymmetry).toMatchObject({ axisX: 4 })
    drag(e, 'pencil', [
      [0, 1],
      [2, 1]
    ])
    for (const x of [0, 1, 2, 5, 6, 7]) expect(getPixel(cel(e), x, 1)).toEqual(RED)
    expect(e.history.size).toBe(1)
    e.undo()
    expect(opaqueSet(cel(e)).size).toBe(0)
  })

  it('deux axes : un clic dessine les quatre symétriques', () => {
    const e = setup()
    e.setSymmetry({ mirrorX: true, mirrorY: true })
    drag(e, 'pencil', [[1, 2]])
    expect([...opaqueSet(cel(e))].sort()).toEqual(['1,2', '1,5', '6,2', '6,5'])
  })

  it('axe personnalisé (milieu d’une colonne)', () => {
    const e = setup(9, 3)
    e.setSymmetry({ mirrorX: true, axisX: 2.5 })
    drag(e, 'pencil', [[0, 0]])
    expect([...opaqueSet(cel(e))].sort()).toEqual(['0,0', '4,0'])
  })

  it('formes et gomme sont reflétées', () => {
    const e = setup()
    e.setSymmetry({ mirrorX: true })
    drag(e, 'line', [
      [0, 0],
      [0, 3]
    ])
    expect(getPixel(cel(e), 7, 3)).toEqual(RED)
    drag(e, 'eraser', [[0, 0]])
    expect(getPixel(cel(e), 7, 0).a).toBe(0)
    expect(getPixel(cel(e), 7, 1)).toEqual(RED)
  })

  it('pot de peinture : rempli aussi la zone symétrique', () => {
    const e = setup()
    // Mur vertical au milieu : deux zones séparées
    e.setSymmetry({ mirrorX: false })
    drag(e, 'line', [
      [3, 0],
      [3, 7]
    ])
    drag(e, 'line', [
      [4, 0],
      [4, 7]
    ])
    e.primary = { r: 0, g: 0, b: 255, a: 255 }
    e.setSymmetry({ mirrorX: true })
    drag(e, 'fill', [[0, 0]])
    expect(getPixel(cel(e), 7, 7)).toEqual(e.primary)
    expect(getPixel(cel(e), 0, 7)).toEqual(e.primary)
  })

  it('compatible avec le mode pixel parfait (coins symétriques retirés)', () => {
    const e = setup()
    e.setPixelPerfect(true)
    e.setSymmetry({ mirrorX: true })
    drag(e, 'pencil', [
      [0, 0],
      [1, 0],
      [1, 1],
      [2, 1]
    ])
    expect(getPixel(cel(e), 1, 0).a).toBe(0)
    expect(getPixel(cel(e), 6, 0).a).toBe(0) // coin symétrique retiré aussi
    expect(getPixel(cel(e), 6, 1)).toEqual(RED)
  })

  it('respecte la sélection active', () => {
    const e = setup()
    e.setSelection(rectSelection(8, 8, { x: 0, y: 0, w: 4, h: 8 }))
    e.setSymmetry({ mirrorX: true })
    drag(e, 'pencil', [[1, 1]])
    expect(getPixel(cel(e), 1, 1)).toEqual(RED)
    expect(getPixel(cel(e), 6, 1).a).toBe(0) // symétrique hors sélection
  })

  it('l’axe reste dans l’image après un changement de taille', () => {
    const e = setup(8, 8)
    e.setSymmetry({ mirrorX: true, axisX: 8 })
    e.resizeCanvas(4, 8, 'tl')
    expect(e.activeSymmetry?.axisX).toBe(4)
  })
})
