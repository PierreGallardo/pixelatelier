import { describe, expect, it } from 'vitest'
import { getPixel } from '../src/renderer/src/model/bitmap'
import { createDocument } from '../src/renderer/src/model/document'
import { Editor, type ToolId } from '../src/renderer/src/editor/Editor'
import { createToolBehavior, type ToolPointer } from '../src/renderer/src/tools/tools'
import { RED } from './helpers'

function setup(width = 16, height = 16): Editor {
  const editor = new Editor()
  editor.setDocument(createDocument({ width, height }), null)
  editor.primary = { ...RED }
  return editor
}

function pointer(x: number, y: number, extra: Partial<ToolPointer> = {}): ToolPointer {
  return { x, y, button: 0, shift: false, alt: false, ...extra }
}

/** Simule un glisser complet de l'outil à travers une suite de points. */
function drag(editor: Editor, tool: ToolId, points: [number, number][], extra: Partial<ToolPointer> = {}): void {
  const behavior = createToolBehavior(editor, tool)
  const [first, ...rest] = points
  behavior.down(pointer(first[0], first[1], extra))
  for (const [x, y] of rest) behavior.move(pointer(x, y, extra))
  const last = points[points.length - 1]
  behavior.up(pointer(last[0], last[1], extra))
}

function cel(editor: Editor) {
  return editor.doc!.layers[editor.activeLayer].cels[editor.activeFrame]
}

describe('historique et regroupement des traits', () => {
  it('un trait de crayon complet = une seule entrée d’annulation', () => {
    const editor = setup()
    drag(editor, 'pencil', [
      [1, 1],
      [5, 1],
      [5, 6],
      [9, 9]
    ])
    expect(editor.history.size).toBe(1)
    expect(getPixel(cel(editor), 3, 1)).toEqual(RED)
    expect(getPixel(cel(editor), 5, 4)).toEqual(RED)
    expect(editor.dirty).toBe(true)

    editor.undo()
    expect(getPixel(cel(editor), 3, 1).a).toBe(0)
    expect(getPixel(cel(editor), 9, 9).a).toBe(0)
    expect(editor.dirty).toBe(false)

    editor.redo()
    expect(getPixel(cel(editor), 9, 9)).toEqual(RED)
  })

  it('l’aperçu d’une forme ne laisse aucune trace intermédiaire', () => {
    const editor = setup()
    drag(editor, 'rect', [
      [2, 2],
      [12, 12],
      [6, 5]
    ])
    expect(editor.history.size).toBe(1)
    expect(getPixel(cel(editor), 12, 12).a).toBe(0) // position intermédiaire effacée
    expect(getPixel(cel(editor), 6, 5)).toEqual(RED)
    expect(getPixel(cel(editor), 2, 2)).toEqual(RED)
    expect(getPixel(cel(editor), 4, 4).a).toBe(0) // rectangle vide
  })

  it('le rectangle plein et l’ellipse pleine remplissent l’intérieur', () => {
    const editor = setup()
    drag(editor, 'rectFilled', [
      [1, 1],
      [4, 4]
    ])
    expect(getPixel(cel(editor), 2, 3)).toEqual(RED)
    drag(editor, 'ellipseFilled', [
      [6, 6],
      [14, 14]
    ])
    expect(getPixel(cel(editor), 10, 10)).toEqual(RED)
    expect(getPixel(cel(editor), 6, 6).a).toBe(0) // coin hors de l'ellipse
    expect(editor.history.size).toBe(2)
  })

  it('le clic droit utilise la couleur secondaire, la gomme rend transparent', () => {
    const editor = setup()
    editor.secondary = { r: 0, g: 0, b: 255, a: 255 }
    drag(editor, 'pencil', [[0, 0]], { button: 2 })
    expect(getPixel(cel(editor), 0, 0)).toEqual(editor.secondary)
    drag(editor, 'eraser', [[0, 0]])
    expect(getPixel(cel(editor), 0, 0).a).toBe(0)
  })

  it('le pot de peinture et la pipette fonctionnent sur le document', () => {
    const editor = setup(8, 8)
    drag(editor, 'fill', [[3, 3]])
    expect(getPixel(cel(editor), 7, 7)).toEqual(RED)
    editor.primary = { r: 0, g: 0, b: 0, a: 255 }
    drag(editor, 'picker', [[2, 2]])
    expect(editor.primary).toEqual(RED)
  })

  it('refuse de dessiner sur un calque masqué', () => {
    const editor = setup()
    editor.setLayerVisible(0, false)
    drag(editor, 'pencil', [[1, 1]])
    expect(getPixel(cel(editor), 1, 1).a).toBe(0)
    expect(editor.notice?.kind).toBe('error')
  })

  it('un nouveau trait après une annulation efface la pile « rétablir »', () => {
    const editor = setup()
    drag(editor, 'pencil', [[1, 1]])
    drag(editor, 'pencil', [[2, 2]])
    editor.undo()
    expect(editor.history.canRedo).toBe(true)
    drag(editor, 'pencil', [[3, 3]])
    expect(editor.history.canRedo).toBe(false)
    expect(getPixel(cel(editor), 2, 2).a).toBe(0)
  })
})

describe('calques et images d’animation', () => {
  it('ajoute, réordonne, renomme et supprime des calques avec annulation', () => {
    const editor = setup()
    editor.addLayer()
    expect(editor.doc!.layers).toHaveLength(2)
    expect(editor.activeLayer).toBe(1)
    editor.renameLayer(1, 'Contours')
    editor.moveLayer(1, -1)
    expect(editor.doc!.layers[0].name).toBe('Contours')
    expect(editor.activeLayer).toBe(0)
    editor.setLayerOpacity(0, 0.5)
    editor.setLayerOpacity(0, 0.25) // fusionné avec la précédente
    expect(editor.doc!.layers[0].opacity).toBe(0.25)
    editor.deleteLayer(0)
    expect(editor.doc!.layers).toHaveLength(1)

    editor.undo() // suppression
    expect(editor.doc!.layers).toHaveLength(2)
    editor.undo() // opacité (une seule entrée)
    expect(editor.doc!.layers[0].opacity).toBe(1)
    editor.undo() // déplacement
    expect(editor.doc!.layers[1].name).toBe('Contours')
    editor.undo() // renommage
    editor.undo() // ajout
    expect(editor.doc!.layers).toHaveLength(1)
    expect(editor.dirty).toBe(false)
  })

  it('le dernier calque et la dernière image ne peuvent pas être supprimés', () => {
    const editor = setup()
    editor.deleteLayer()
    editor.deleteFrame()
    expect(editor.doc!.layers).toHaveLength(1)
    expect(editor.doc!.frames).toHaveLength(1)
  })

  it('duplique, sélectionne et supprime des images ; annuler restaure les pixels', () => {
    const editor = setup()
    drag(editor, 'pencil', [[4, 4]])
    editor.duplicateFrame()
    expect(editor.doc!.frames).toHaveLength(2)
    expect(editor.activeFrame).toBe(1)
    expect(getPixel(cel(editor), 4, 4)).toEqual(RED)

    // La copie est indépendante de l'original.
    drag(editor, 'eraser', [[4, 4]])
    editor.setActiveFrame(0)
    expect(getPixel(cel(editor), 4, 4)).toEqual(RED)

    editor.addFrame()
    expect(editor.activeFrame).toBe(1)
    expect(editor.doc!.frames).toHaveLength(3)
    editor.deleteFrame()
    expect(editor.doc!.frames).toHaveLength(2)

    editor.undo()
    editor.undo()
    editor.undo() // gomme sur l'image 2
    editor.setActiveFrame(1)
    expect(getPixel(cel(editor), 4, 4)).toEqual(RED)
  })

  it('les opérations d’image (rotation, canevas) sont annulables', () => {
    const editor = setup(4, 2)
    drag(editor, 'pencil', [[3, 0]])
    editor.rotate(true)
    expect(editor.doc!.width).toBe(2)
    expect(editor.doc!.height).toBe(4)
    expect(getPixel(cel(editor), 1, 3)).toEqual(RED)
    editor.resizeCanvas(6, 6, 'c')
    expect(editor.doc!.width).toBe(6)
    expect(getPixel(cel(editor), 3, 4)).toEqual(RED)
    editor.undo()
    editor.undo()
    expect(editor.doc!.width).toBe(4)
    expect(getPixel(cel(editor), 3, 0)).toEqual(RED)
  })
})
