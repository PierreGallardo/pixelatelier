import { describe, expect, it } from 'vitest'
import { createBitmap, getPixel, setPixel } from '../src/renderer/src/model/bitmap'
import { createDocument } from '../src/renderer/src/model/document'
import {
  clearSelected,
  combineSelections,
  countSelected,
  extractSelected,
  invertSelection,
  isSelected,
  rectSelection,
  selectAll,
  selectionEdges,
  stampImage,
  translateSelection
} from '../src/renderer/src/model/selection'
import { magicWandMask } from '../src/renderer/src/raster/wand'
import { Editor } from '../src/renderer/src/editor/Editor'
import { createToolBehavior, type ToolPointer } from '../src/renderer/src/tools/tools'
import type { ToolId } from '../src/renderer/src/editor/Editor'
import { BLUE, GREEN, RED } from './helpers'

describe('modèle de sélection', () => {
  it('crée une sélection rectangulaire limitée au document', () => {
    const sel = rectSelection(10, 8, { x: -2, y: 5, w: 6, h: 10 })!
    expect(sel.bounds).toEqual({ x: 0, y: 5, w: 4, h: 3 })
    expect(countSelected(sel)).toBe(12)
    expect(isSelected(sel, 3, 7)).toBe(true)
    expect(isSelected(sel, 4, 7)).toBe(false)
    expect(rectSelection(10, 8, { x: 20, y: 0, w: 2, h: 2 })).toBeNull()
  })

  it('ajoute, retire et inverse', () => {
    const a = rectSelection(10, 10, { x: 0, y: 0, w: 4, h: 4 })
    const b = rectSelection(10, 10, { x: 2, y: 2, w: 4, h: 4 })
    expect(countSelected(combineSelections(a, b, 'add'))).toBe(16 + 16 - 4)
    expect(countSelected(combineSelections(a, b, 'subtract'))).toBe(12)
    expect(combineSelections(a, b, 'replace')).toBe(b)
    expect(combineSelections(a, a, 'subtract')).toBeNull()
    expect(combineSelections(null, b, 'add')).toBe(b)
    expect(countSelected(invertSelection(a, 10, 10))).toBe(84)
    expect(invertSelection(selectAll(10, 10), 10, 10)).toBeNull()
  })

  it('décale la sélection et perd ce qui sort du document', () => {
    const sel = rectSelection(8, 8, { x: 5, y: 0, w: 3, h: 2 })!
    const moved = translateSelection(sel, 2, 1)!
    expect(moved.bounds).toEqual({ x: 7, y: 1, w: 1, h: 2 })
    expect(translateSelection(sel, 10, 0)).toBeNull()
  })

  it('calcule le contour en segments fusionnés', () => {
    const sel = rectSelection(8, 8, { x: 1, y: 1, w: 3, h: 2 })!
    // Un rectangle = 4 segments.
    expect(selectionEdges(sel)).toHaveLength(16)
  })

  it('extrait, efface et repose des pixels', () => {
    const bmp = createBitmap(6, 6)
    setPixel(bmp, 1, 1, RED)
    setPixel(bmp, 2, 1, GREEN)
    setPixel(bmp, 4, 4, BLUE)
    const sel = rectSelection(6, 6, { x: 1, y: 1, w: 2, h: 1 })!
    const clip = extractSelected(bmp, sel)
    expect([clip.x, clip.y, clip.image.width, clip.image.height]).toEqual([1, 1, 2, 1])
    expect(getPixel(clip.image, 1, 0)).toEqual(GREEN)

    clearSelected(bmp, sel)
    expect(getPixel(bmp, 1, 1).a).toBe(0)
    expect(getPixel(bmp, 4, 4)).toEqual(BLUE)

    // Les pixels transparents de l'image posée laissent voir le dessous.
    const img = createBitmap(2, 2)
    setPixel(img, 0, 0, RED)
    const area = stampImage(bmp, img, 3, 3)
    expect(area).toEqual({ x: 3, y: 3, w: 2, h: 2 })
    expect(getPixel(bmp, 3, 3)).toEqual(RED)
    expect(getPixel(bmp, 4, 4)).toEqual(BLUE)
    expect(stampImage(bmp, img, 10, 10)).toBeNull()
  })
})

describe('baguette magique', () => {
  function stripes() {
    // Deux zones rouges séparées par une colonne bleue, plus un pixel presque rouge.
    const bmp = createBitmap(5, 3)
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 5; x++) setPixel(bmp, x, y, x === 2 ? BLUE : RED)
    }
    setPixel(bmp, 4, 2, { r: 250, g: 4, b: 0, a: 255 })
    return bmp
  }

  it('zone contiguë : seulement les pixels reliés', () => {
    const mask = magicWandMask(stripes(), 0, 0, { contiguous: true, tolerance: 0 })!
    expect(mask.reduce((a, b) => a + b, 0)).toBe(6)
    expect(mask[3]).toBe(0)
  })

  it('toute l’image : toutes les occurrences de la couleur', () => {
    const mask = magicWandMask(stripes(), 0, 0, { contiguous: false, tolerance: 0 })!
    expect(mask.reduce((a, b) => a + b, 0)).toBe(11)
  })

  it('la tolérance inclut les couleurs proches', () => {
    const mask = magicWandMask(stripes(), 0, 0, { contiguous: false, tolerance: 8 })!
    expect(mask.reduce((a, b) => a + b, 0)).toBe(12)
  })

  it('les pixels transparents forment une seule couleur', () => {
    const bmp = createBitmap(3, 1)
    setPixel(bmp, 1, 0, { r: 9, g: 9, b: 9, a: 0 })
    setPixel(bmp, 2, 0, RED)
    const mask = magicWandMask(bmp, 0, 0, { contiguous: true, tolerance: 0 })!
    expect([...mask]).toEqual([1, 1, 0])
    expect(magicWandMask(bmp, 9, 0, { contiguous: true, tolerance: 0 })).toBeNull()
  })
})

/* ------------------------------ Éditeur ------------------------------ */

function setup(width = 12, height = 12): Editor {
  const editor = new Editor()
  editor.setDocument(createDocument({ width, height }), null)
  editor.primary = { ...RED }
  return editor
}

function pointer(x: number, y: number, extra: Partial<ToolPointer> = {}): ToolPointer {
  return { x, y, button: 0, shift: false, alt: false, ...extra }
}

function drag(editor: Editor, tool: ToolId, points: [number, number][], extra: Partial<ToolPointer> = {}): void {
  const b = createToolBehavior(editor, tool)
  b.down(pointer(points[0][0], points[0][1], extra))
  for (const [x, y] of points.slice(1)) b.move(pointer(x, y, extra))
  const last = points[points.length - 1]
  b.up(pointer(last[0], last[1], extra))
}

const cel = (e: Editor) => e.doc!.layers[e.activeLayer].cels[e.activeFrame]

describe('outil de sélection et presse-papiers', () => {
  it('trace une sélection rectangulaire, Maj ajoute, Alt retire, clic simple désélectionne', () => {
    const e = setup()
    drag(e, 'select', [
      [1, 1],
      [3, 3]
    ])
    expect(e.selection?.bounds).toEqual({ x: 1, y: 1, w: 3, h: 3 })
    drag(e, 'select', [
      [6, 6],
      [7, 7]
    ], { shift: true })
    expect(countSelected(e.selection)).toBe(9 + 4)
    drag(e, 'select', [
      [1, 1],
      [1, 3]
    ], { alt: true })
    expect(countSelected(e.selection)).toBe(13 - 3)
    drag(e, 'select', [[10, 10]])
    expect(e.selection).toBeNull()
    expect(e.history.size).toBe(0) // la sélection seule ne modifie pas le document
  })

  it('le dessin est confiné à la sélection', () => {
    const e = setup()
    e.setSelection(rectSelection(12, 12, { x: 0, y: 0, w: 4, h: 12 }))
    drag(e, 'pencil', [
      [0, 5],
      [10, 5]
    ])
    expect(getPixel(cel(e), 3, 5)).toEqual(RED)
    expect(getPixel(cel(e), 4, 5).a).toBe(0)
    drag(e, 'fill', [[6, 6]]) // clic hors sélection : rien n'est rempli
    expect(getPixel(cel(e), 6, 6).a).toBe(0)
    drag(e, 'fill', [[1, 1]])
    expect(getPixel(cel(e), 3, 11)).toEqual(RED)
    expect(getPixel(cel(e), 4, 11).a).toBe(0)
  })

  it('copier puis coller : collage flottant déplaçable, validé en une entrée d’historique', () => {
    const e = setup()
    drag(e, 'rectFilled', [
      [1, 1],
      [2, 2]
    ])
    e.setSelection(rectSelection(12, 12, { x: 1, y: 1, w: 2, h: 2 }))
    expect(e.copySelection()).not.toBeNull()
    const before = e.history.size

    const clip = e.clipboard!
    expect(e.paste(clip)).toBe(true)
    expect(e.tool).toBe('select')
    expect(e.floating).not.toBeNull()
    // Glisser dans l'image collée la déplace.
    drag(e, 'select', [
      [1, 1],
      [8, 5]
    ])
    expect(e.floatingRect).toEqual({ x: 8, y: 5, w: 2, h: 2 })
    expect(getPixel(cel(e), 9, 6)).toEqual(RED)
    e.moveFloatingTo(8, 6) // comme une flèche vers le bas
    e.commitFloating()
    expect(e.floating).toBeNull()
    expect(e.history.size).toBe(before + 1)
    expect(getPixel(cel(e), 8, 6)).toEqual(RED)
    expect(getPixel(cel(e), 8, 5).a).toBe(0)
    expect(getPixel(cel(e), 1, 1)).toEqual(RED) // l'original reste en place
    expect(e.selection?.bounds).toEqual({ x: 8, y: 6, w: 2, h: 2 })

    e.undo()
    expect(getPixel(cel(e), 8, 6).a).toBe(0)
  })

  it('Échap (annuler le collage) ne laisse aucune trace', () => {
    const e = setup()
    e.paste({ image: createBitmap(2, 2, BLUE), x: 4, y: 4 })
    expect(getPixel(cel(e), 4, 4)).toEqual(BLUE)
    e.cancelFloating()
    expect(getPixel(cel(e), 4, 4).a).toBe(0)
    expect(e.history.size).toBe(0)
  })

  it('le collage est validé par une autre action (changement d’image)', () => {
    const e = setup()
    e.addFrame()
    e.setActiveFrame(0)
    e.paste({ image: createBitmap(1, 1, BLUE), x: 0, y: 0 })
    e.setActiveFrame(1)
    expect(e.floating).toBeNull()
    e.setActiveFrame(0)
    expect(getPixel(cel(e), 0, 0)).toEqual(BLUE)
  })

  it('un collage hors limites est ramené dans le document', () => {
    const e = setup(8, 8)
    e.paste({ image: createBitmap(3, 3, GREEN), x: 50, y: -4 })
    expect(e.floatingRect).toEqual({ x: 5, y: 0, w: 3, h: 3 })
  })

  it('couper : copie puis efface ; annuler restaure', () => {
    const e = setup()
    drag(e, 'pencil', [
      [2, 2],
      [5, 2]
    ])
    e.setSelection(rectSelection(12, 12, { x: 2, y: 2, w: 2, h: 1 }))
    const clip = e.cutSelection()!
    expect(clip.image.width).toBe(2)
    expect(getPixel(cel(e), 2, 2).a).toBe(0)
    expect(getPixel(cel(e), 4, 2)).toEqual(RED)
    e.undo()
    expect(getPixel(cel(e), 2, 2)).toEqual(RED)
  })

  it('copier sans sélection affiche un message', () => {
    const e = setup()
    expect(e.copySelection()).toBeNull()
    expect(e.notice?.kind).toBe('error')
  })

  it('« copier tous les calques » utilise l’image composée', () => {
    const e = setup()
    drag(e, 'pencil', [[1, 1]])
    e.addLayer()
    e.primary = { ...BLUE }
    drag(e, 'pencil', [[2, 1]])
    e.setSelection(rectSelection(12, 12, { x: 1, y: 1, w: 2, h: 1 }))
    expect(getPixel(e.copySelection(false)!.image, 0, 0).a).toBe(0)
    const merged = e.copySelection(true)!
    expect(getPixel(merged.image, 0, 0)).toEqual(RED)
    expect(getPixel(merged.image, 1, 0)).toEqual(BLUE)
  })

  it('Supprimer : efface la sélection seulement, sinon toute l’image', () => {
    const e = setup()
    drag(e, 'rectFilled', [
      [0, 0],
      [11, 11]
    ])
    e.setSelection(rectSelection(12, 12, { x: 0, y: 0, w: 6, h: 12 }))
    e.deleteCommand()
    expect(getPixel(cel(e), 5, 5).a).toBe(0)
    expect(getPixel(cel(e), 6, 5)).toEqual(RED)
    e.setSelection(null)
    e.deleteCommand()
    expect(getPixel(cel(e), 6, 5).a).toBe(0)
  })

  it('glisser dans la sélection déplace son contenu (une entrée d’historique)', () => {
    const e = setup()
    drag(e, 'pencil', [[2, 2]])
    e.setTool('select')
    drag(e, 'select', [
      [1, 1],
      [3, 3]
    ])
    const before = e.history.size
    drag(e, 'select', [
      [2, 2],
      [5, 4],
      [7, 6]
    ])
    expect(getPixel(cel(e), 2, 2).a).toBe(0)
    expect(getPixel(cel(e), 7, 6)).toEqual(RED)
    expect(e.history.size).toBe(before + 1)
    expect(e.selection?.bounds).toEqual({ x: 6, y: 5, w: 3, h: 3 })
    e.undo()
    expect(getPixel(cel(e), 2, 2)).toEqual(RED)
    expect(getPixel(cel(e), 7, 6).a).toBe(0)
  })

  it('la sélection disparaît quand les dimensions du document changent', () => {
    const e = setup(8, 4)
    e.selectAllPixels()
    e.rotate(true)
    expect(e.selection).toBeNull()
  })
})

describe('baguette magique dans l’éditeur', () => {
  function painted(): Editor {
    const e = setup(6, 2)
    // Ligne 0 : R R B R R R / ligne 1 : R R B B B B
    drag(e, 'rectFilled', [
      [0, 0],
      [5, 1]
    ])
    e.primary = { ...BLUE }
    drag(e, 'pencil', [
      [2, 0],
      [2, 1],
      [5, 1]
    ])
    return e
  }

  it('mode sélection : zone contiguë ou toute l’image, Maj pour ajouter', () => {
    const e = painted()
    e.wandSelect(0, 0, 'replace')
    expect(countSelected(e.selection)).toBe(4)
    e.setWand({ contiguous: false })
    e.wandSelect(0, 0, 'replace')
    expect(countSelected(e.selection)).toBe(7)
    e.wandSelect(2, 0, 'add')
    expect(countSelected(e.selection)).toBe(12)
  })

  it('mode suppression : supprime la couleur dans toute l’image en une seule annulation', () => {
    const e = painted()
    e.setWand({ contiguous: false, action: 'delete' })
    const before = e.history.size
    drag(e, 'wand', [[0, 0]])
    expect(e.history.size).toBe(before + 1)
    expect(getPixel(cel(e), 4, 0).a).toBe(0)
    expect(getPixel(cel(e), 0, 1).a).toBe(0)
    expect(getPixel(cel(e), 2, 0)).toEqual(BLUE)
    expect(e.notice?.text).toMatch(/7 pixels supprimés/)
    e.undo()
    expect(getPixel(cel(e), 4, 0)).toEqual(RED)
  })

  it('mode suppression en zone contiguë', () => {
    const e = painted()
    e.setWand({ contiguous: true, action: 'delete' })
    drag(e, 'wand', [[0, 0]])
    expect(getPixel(cel(e), 1, 1).a).toBe(0)
    expect(getPixel(cel(e), 3, 0)).toEqual(RED) // de l'autre côté de la colonne bleue
  })

  it('mode suppression limité à la sélection active', () => {
    const e = painted()
    e.setSelection(rectSelection(6, 2, { x: 4, y: 0, w: 2, h: 2 }))
    e.setWand({ contiguous: false, action: 'delete' })
    expect(e.wandDelete(0, 0)).toBe(2)
    expect(getPixel(cel(e), 4, 0).a).toBe(0)
    expect(getPixel(cel(e), 5, 0).a).toBe(0)
    expect(getPixel(cel(e), 0, 0)).toEqual(RED)
    expect(getPixel(cel(e), 5, 1)).toEqual(BLUE)
  })
})
