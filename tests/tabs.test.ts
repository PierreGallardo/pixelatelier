import { describe, expect, it } from 'vitest'
import { getPixel } from '../src/renderer/src/model/bitmap'
import { createDocument } from '../src/renderer/src/model/document'
import { rectSelection } from '../src/renderer/src/model/selection'
import { Editor, type ToolId } from '../src/renderer/src/editor/Editor'
import { createToolBehavior, type ToolPointer } from '../src/renderer/src/tools/tools'
import { BLUE, RED } from './helpers'

function drag(e: Editor, tool: ToolId, points: [number, number][]): void {
  const p = (x: number, y: number): ToolPointer => ({ x, y, button: 0, shift: false, alt: false })
  const b = createToolBehavior(e, tool)
  b.down(p(points[0][0], points[0][1]))
  for (const [x, y] of points.slice(1)) b.move(p(x, y))
  const last = points[points.length - 1]
  b.up(p(last[0], last[1]))
}

const cel = (e: Editor) => e.doc!.layers[e.activeLayer].cels[e.activeFrame]

function twoDocs(): Editor {
  const e = new Editor()
  e.setDocument(createDocument({ width: 8, height: 8 }), 'C:/dessins/Chat.pixatelier')
  e.setDocument(createDocument({ width: 16, height: 12 }), null)
  return e
}

describe('plusieurs documents ouverts (onglets)', () => {
  it('chaque ouverture ajoute un onglet et l’active', () => {
    const e = twoDocs()
    expect(e.tabCount).toBe(2)
    expect(e.activeTabIndex).toBe(1)
    expect(e.doc!.width).toBe(16)
    expect(e.tabList.map((t) => [t.name, t.active])).toEqual([
      ['Chat.pixatelier', false],
      ['Sans titre', true]
    ])
  })

  it('les dessins et l’historique restent propres à chaque document', () => {
    const e = twoDocs()
    e.primary = { ...RED }
    drag(e, 'pencil', [[1, 1]])
    e.switchTab(0)
    expect(e.doc!.width).toBe(8)
    expect(getPixel(cel(e), 1, 1).a).toBe(0)
    expect(e.history.canUndo).toBe(false)
    e.primary = { ...BLUE }
    drag(e, 'pencil', [[2, 2]])
    e.switchTab(1)
    expect(getPixel(cel(e), 1, 1)).toEqual(RED)
    expect(getPixel(cel(e), 2, 2).a).toBe(0)
    e.undo() // n'annule que dans le document actif
    expect(getPixel(cel(e), 1, 1).a).toBe(0)
    e.switchTab(0)
    expect(getPixel(cel(e), 2, 2)).toEqual(BLUE)
  })

  it('l’état « modifié » de chaque onglet est suivi séparément', () => {
    const e = twoDocs()
    drag(e, 'pencil', [[0, 0]])
    expect(e.tabList.map((t) => t.dirty)).toEqual([false, true])
    expect(e.anyDirty).toBe(true)
    e.switchTab(0)
    expect(e.dirty).toBe(false)
    expect(e.tabList.map((t) => t.dirty)).toEqual([false, true])
  })

  it('calque, image, sélection et symétrie sont mémorisés par document', () => {
    const e = twoDocs()
    e.addLayer()
    e.addFrame()
    e.setSelection(rectSelection(16, 12, { x: 0, y: 0, w: 4, h: 4 }))
    e.setSymmetry({ mirrorX: true })
    e.switchTab(0)
    expect(e.activeLayer).toBe(0)
    expect(e.activeFrame).toBe(0)
    expect(e.selection).toBeNull()
    expect(e.symmetry.mirrorX).toBe(false)
    e.switchTab(1)
    expect([e.activeLayer, e.activeFrame]).toEqual([1, 1])
    expect(e.selection?.bounds).toEqual({ x: 0, y: 0, w: 4, h: 4 })
    expect(e.symmetry.mirrorX).toBe(true)
  })

  it('un collage en cours est validé en changeant d’onglet', () => {
    const e = twoDocs()
    e.paste({ image: { width: 1, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255]) }, x: 3, y: 3 })
    e.switchTab(0)
    e.switchTab(1)
    expect(e.floating).toBeNull()
    expect(getPixel(cel(e), 3, 3)).toEqual(RED)
  })

  it('le presse-papiers est commun : copier dans un document, coller dans l’autre', () => {
    const e = twoDocs()
    e.primary = { ...RED }
    drag(e, 'pencil', [[5, 5]])
    e.setSelection(rectSelection(16, 12, { x: 5, y: 5, w: 1, h: 1 }))
    e.copySelection()
    e.switchTab(0)
    expect(e.paste(e.clipboard!)).toBe(true)
    e.commitFloating()
    expect(getPixel(cel(e), 5, 5)).toEqual(RED)
  })

  it('passe d’un onglet à l’autre en boucle', () => {
    const e = twoDocs()
    e.setDocument(createDocument({ width: 4, height: 4 }), null)
    expect(e.activeTabIndex).toBe(2)
    e.cycleTab(1)
    expect(e.activeTabIndex).toBe(0)
    e.cycleTab(-1)
    expect(e.activeTabIndex).toBe(2)
  })

  it('retrouve un fichier déjà ouvert par son chemin', () => {
    const e = twoDocs()
    expect(e.findTabByPath('C:/dessins/Chat.pixatelier')).toBe(0)
    expect(e.findTabByPath('c:/DESSINS/chat.pixatelier')).toBe(0)
    expect(e.findTabByPath('C:/autre.pixatelier')).toBe(-1)
  })

  it('fermer un onglet active son voisin ; fermer le dernier revient à l’accueil', () => {
    const e = twoDocs()
    e.closeTab(1)
    expect(e.tabCount).toBe(1)
    expect(e.fileName).toBe('Chat.pixatelier')
    e.closeDocument()
    expect(e.tabCount).toBe(0)
    expect(e.doc).toBeNull()
    expect(e.history.canUndo).toBe(false)
  })

  it('fermer un onglet inactif garde le document actif', () => {
    const e = twoDocs()
    e.closeTab(0)
    expect(e.tabCount).toBe(1)
    expect(e.activeTabIndex).toBe(0)
    expect(e.doc!.width).toBe(16)
  })

  it('mémorise la vue de chaque document', () => {
    const e = twoDocs()
    let current = { zoom: 8, panX: 10, panY: 20 }
    e.viewCommands = { zoomIn() {}, zoomOut() {}, fit() {}, actualSize() {}, getViewport: () => current }
    e.switchTab(0) // mémorise la vue de l'onglet 1
    expect(e.takeViewportHint()).toBeNull() // jamais affiché : ajustement à l'écran
    current = { zoom: 2, panX: 0, panY: 0 }
    e.switchTab(1)
    expect(e.takeViewportHint()).toEqual({ zoom: 8, panX: 10, panY: 20 })
    expect(e.takeViewportHint()).toBeNull()
  })
})
