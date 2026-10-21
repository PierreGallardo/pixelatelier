import { describe, expect, it } from 'vitest'
import { getPixel, setPixel } from '../src/renderer/src/model/bitmap'
import { createDocument } from '../src/renderer/src/model/document'
import { isCorner, PixelPerfectStroke } from '../src/renderer/src/raster/pixelPerfect'
import { Editor, type ToolId } from '../src/renderer/src/editor/Editor'
import { createToolBehavior, type ToolPointer } from '../src/renderer/src/tools/tools'
import { BLUE, RED } from './helpers'

describe('filtre pixel parfait', () => {
  it('reconnaît les angles en L', () => {
    expect(isCorner({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 })).toBe(true)
    expect(isCorner({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(true)
    expect(isCorner({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBe(false) // ligne droite
    expect(isCorner({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBe(false) // diagonale
    expect(isCorner({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })).toBe(false) // demi-tour
  })

  it('retire le coin de chaque marche d’un escalier', () => {
    const stroke = new PixelPerfectStroke()
    const removed = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 2 }
    ].map((p) => stroke.add(p))
    expect(removed).toEqual([null, null, { x: 1, y: 0 }, null, { x: 2, y: 1 }])
    expect(stroke.length).toBe(3) // (0,0) (1,1) (2,2) : diagonale propre
  })

  it('ignore les pixels répétés', () => {
    const stroke = new PixelPerfectStroke()
    stroke.add({ x: 3, y: 3 })
    expect(stroke.add({ x: 3, y: 3 })).toBeNull()
    expect(stroke.length).toBe(1)
  })
})

function setup(): Editor {
  const editor = new Editor()
  editor.setDocument(createDocument({ width: 12, height: 12 }), null)
  editor.primary = { ...RED }
  return editor
}

function drag(editor: Editor, tool: ToolId, points: [number, number][]): void {
  const p = (x: number, y: number): ToolPointer => ({ x, y, button: 0, shift: false, alt: false })
  const b = createToolBehavior(editor, tool)
  b.down(p(points[0][0], points[0][1]))
  for (const [x, y] of points.slice(1)) b.move(p(x, y))
  const last = points[points.length - 1]
  b.up(p(last[0], last[1]))
}

const cel = (e: Editor) => e.doc!.layers[e.activeLayer].cels[e.activeFrame]
const staircase: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [2, 1],
  [2, 2],
  [3, 2]
]

describe('crayon en mode pixel parfait', () => {
  it('désactivé (par défaut) : les angles en L restent', () => {
    const e = setup()
    expect(e.pixelPerfect).toBe(false)
    drag(e, 'pencil', staircase)
    expect(getPixel(cel(e), 1, 0)).toEqual(RED)
    expect(getPixel(cel(e), 2, 1)).toEqual(RED)
  })

  it('activé : les coins sont retirés, en une seule annulation', () => {
    const e = setup()
    e.setPixelPerfect(true)
    drag(e, 'pencil', staircase)
    expect(getPixel(cel(e), 1, 0).a).toBe(0)
    expect(getPixel(cel(e), 2, 1).a).toBe(0)
    for (const [x, y] of [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 2]
    ]) {
      expect(getPixel(cel(e), x, y)).toEqual(RED)
    }
    expect(e.history.size).toBe(1)
    e.undo()
    expect(getPixel(cel(e), 1, 1).a).toBe(0)
  })

  it('un coin retiré retrouve sa couleur d’origine', () => {
    const e = setup()
    setPixel(cel(e), 1, 0, BLUE)
    e.setPixelPerfect(true)
    drag(e, 'pencil', staircase)
    expect(getPixel(cel(e), 1, 0)).toEqual(BLUE)
  })

  it('s’applique aussi aux mouvements rapides (segments de plusieurs pixels)', () => {
    const e = setup()
    e.setPixelPerfect(true)
    drag(e, 'pencil', [
      [0, 5],
      [4, 5],
      [4, 9]
    ])
    expect(getPixel(cel(e), 4, 5).a).toBe(0) // coin entre l'horizontale et la verticale
    expect(getPixel(cel(e), 3, 5)).toEqual(RED)
    expect(getPixel(cel(e), 4, 6)).toEqual(RED)
  })

  it('sans effet avec une brosse de plus d’un pixel', () => {
    const e = setup()
    e.setPixelPerfect(true)
    e.setBrushSize(2)
    drag(e, 'pencil', staircase)
    expect(getPixel(cel(e), 1, 0)).toEqual(RED)
  })

  it('fonctionne aussi avec la gomme', () => {
    const e = setup()
    drag(e, 'rectFilled', [
      [0, 0],
      [11, 11]
    ])
    e.setPixelPerfect(true)
    drag(e, 'eraser', staircase)
    expect(getPixel(cel(e), 1, 1).a).toBe(0)
    expect(getPixel(cel(e), 1, 0)).toEqual(RED) // coin non effacé
  })
})
