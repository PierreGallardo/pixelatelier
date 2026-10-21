import { getPixel, inBounds, rectFromPoints, setPixel, unionRect, type Point, type Rect } from '../model/bitmap'
import { TRANSPARENT, type RGBA } from '../model/color'
import { composePixel } from '../model/compose'
import type { Editor, ToolId } from '../editor/Editor'
import type { EditSession } from '../editor/EditSession'
import {
  clearSelected,
  extractSelected,
  isSelected,
  rectSelection,
  stampImage,
  translateSelection,
  type PixelClip,
  type Selection,
  type SelectionMode
} from '../model/selection'
import { brushRect } from '../raster/brush'
import { PixelPerfectStroke } from '../raster/pixelPerfect'
import { mirroredBounds, mirrorPoints, stampBrushSymmetric, type Symmetry } from '../raster/symmetry'
import { floodFill } from '../raster/fill'
import { constrainLine, constrainSquare, plotEllipse, plotLine, plotRect } from '../raster/shapes'

/** Description d'un outil pour l'interface. */
export interface ToolInfo {
  id: ToolId
  label: string
  shortcut: string
  hint: string
  usesBrush: boolean
}

export const TOOLS: readonly ToolInfo[] = [
  {
    id: 'select',
    label: 'Sélection rectangulaire',
    shortcut: 'M',
    hint: 'Glisser : sélectionner (Maj : ajouter, Alt : retirer). Glisser dans la sélection : déplacer son contenu. Clic simple : tout désélectionner.',
    usesBrush: false
  },
  {
    id: 'wand',
    label: 'Baguette magique',
    shortcut: 'W',
    hint: 'Sélectionne ou supprime une couleur, en zone contiguë ou dans toute l’image (limitée à la sélection active). Maj : ajouter, Alt : retirer.',
    usesBrush: false
  },
  { id: 'pencil', label: 'Crayon', shortcut: 'B', hint: 'Clic gauche : couleur principale, clic droit : secondaire. Maj+clic : ligne depuis le dernier point. Option « pixel parfait » : traits sans angles en L.', usesBrush: true },
  { id: 'eraser', label: 'Gomme', shortcut: 'E', hint: 'Rend les pixels transparents.', usesBrush: true },
  { id: 'picker', label: 'Pipette', shortcut: 'I', hint: 'Clic gauche : couleur principale, clic droit : secondaire. Alt+clic avec un autre outil.', usesBrush: false },
  { id: 'fill', label: 'Pot de peinture', shortcut: 'G', hint: 'Remplit la zone de même couleur (calque actif).', usesBrush: false },
  { id: 'line', label: 'Ligne', shortcut: 'L', hint: 'Maj : angles de 45°.', usesBrush: true },
  { id: 'rect', label: 'Rectangle', shortcut: 'R', hint: 'Maj : carré.', usesBrush: true },
  { id: 'rectFilled', label: 'Rectangle plein', shortcut: 'Maj+R', hint: 'Maj : carré.', usesBrush: false },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O', hint: 'Maj : cercle.', usesBrush: true },
  { id: 'ellipseFilled', label: 'Ellipse pleine', shortcut: 'Maj+O', hint: 'Maj : cercle.', usesBrush: false }
]

export function toolInfo(id: ToolId): ToolInfo {
  return TOOLS.find((t) => t.id === id) ?? TOOLS[0]
}

/** Position du pointeur en pixels du document et état des boutons/modificateurs. */
export interface ToolPointer {
  x: number
  y: number
  /** 0 = bouton principal, 2 = bouton secondaire. */
  button: number
  shift: boolean
  alt: boolean
}

/** Comportement d'un outil pendant un glisser (créé à chaque appui). */
export interface ToolBehavior {
  down(p: ToolPointer): void
  move(p: ToolPointer): void
  up(p: ToolPointer): void
  /** Interrompt l'action (perte du pointeur, Échap). */
  cancel(): void
}

function strokeColor(editor: Editor, p: ToolPointer): RGBA {
  return p.button === 2 ? editor.secondary : editor.primary
}

/** Crayon et gomme : tracé continu, une seule entrée d'historique par trait. */
class FreehandTool implements ToolBehavior {
  private session: EditSession | null = null
  private last: Point | null = null
  private color: RGBA = TRANSPARENT
  /** Filtre « pixel parfait » (brosse de 1 px uniquement), ou `null`. */
  private perfect: PixelPerfectStroke | null = null
  private sym: Symmetry | null = null

  constructor(
    private readonly editor: Editor,
    private readonly erase: boolean
  ) {}

  private segment(a: Point, b: Point): void {
    const s = this.session
    if (!s || s.isClosed) return
    const size = this.editor.brushSize
    const perfect = this.perfect
    const original = s.originalPixels
    const sym = this.sym
    plotLine(a.x, a.y, b.x, b.y, (x, y) => {
      if (perfect) {
        // Coin d'un « L » : le pixel (et ses symétriques) retrouve sa couleur d'avant le trait.
        const corner = perfect.add({ x, y })
        if (corner) {
          for (const c of sym ? mirrorPoints(corner.x, corner.y, sym) : [corner]) {
            if (inBounds(original, c.x, c.y)) setPixel(s.cel, c.x, c.y, getPixel(original, c.x, c.y))
          }
        }
      }
      stampBrushSymmetric(s.cel, x, y, size, this.color, sym)
    })
    // Le coin retiré est voisin du segment : on élargit d'un pixel la zone à redessiner.
    const grow = perfect ? 1 : 0
    const r = unionRect(brushRect(a.x, a.y, size), brushRect(b.x, b.y, size))
    if (r) s.touch(mirroredBounds({ x: r.x - grow, y: r.y - grow, w: r.w + grow * 2, h: r.h + grow * 2 }, sym))
  }

  down(p: ToolPointer): void {
    this.session = this.editor.beginEdit()
    if (!this.session) return
    this.color = this.erase ? TRANSPARENT : strokeColor(this.editor, p)
    this.perfect = this.editor.pixelPerfect && this.editor.brushSize === 1 ? new PixelPerfectStroke() : null
    this.sym = this.editor.activeSymmetry
    const from = p.shift && this.editor.lastFreehandPoint ? this.editor.lastFreehandPoint : p
    this.segment(from, p)
    this.last = { x: p.x, y: p.y }
    this.editor.lastFreehandPoint = this.last
  }

  move(p: ToolPointer): void {
    if (!this.last || (p.x === this.last.x && p.y === this.last.y)) return
    this.segment(this.last, p)
    this.last = { x: p.x, y: p.y }
    this.editor.lastFreehandPoint = this.last
  }

  up(): void {
    this.session?.commit(this.erase ? 'Gomme' : 'Crayon')
    this.session = null
  }

  cancel(): void {
    this.up()
  }
}

type ShapeKind = 'line' | 'rect' | 'ellipse'

/** Ligne, rectangle et ellipse : aperçu pendant le glisser, validation au relâchement. */
class ShapeTool implements ToolBehavior {
  private session: EditSession | null = null
  private start: Point | null = null
  private color: RGBA = TRANSPARENT
  private lastRect: Rect | null = null

  constructor(
    private readonly editor: Editor,
    private readonly kind: ShapeKind,
    private readonly filled: boolean
  ) {}

  private draw(p: ToolPointer): void {
    const s = this.session
    const start = this.start
    if (!s || s.isClosed || !start) return
    s.restore()
    const end =
      p.shift && this.kind === 'line'
        ? constrainLine(start.x, start.y, p.x, p.y)
        : p.shift
          ? constrainSquare(start.x, start.y, p.x, p.y)
          : { x: p.x, y: p.y }
    const size = this.filled ? 1 : this.editor.brushSize
    const sym = this.editor.activeSymmetry
    const plot = (x: number, y: number): void => stampBrushSymmetric(s.cel, x, y, size, this.color, sym)
    if (this.kind === 'line') plotLine(start.x, start.y, end.x, end.y, plot)
    else if (this.kind === 'rect') plotRect(start.x, start.y, end.x, end.y, this.filled, plot)
    else plotEllipse(start.x, start.y, end.x, end.y, this.filled, plot)

    const r = rectFromPoints(start.x, start.y, end.x, end.y)
    const off = Math.floor((size - 1) / 2)
    const rect = mirroredBounds({ x: r.x - off, y: r.y - off, w: r.w + size - 1, h: r.h + size - 1 }, sym)
    s.touch(unionRect(this.lastRect, rect))
    this.lastRect = rect
  }

  down(p: ToolPointer): void {
    this.session = this.editor.beginEdit()
    if (!this.session) return
    this.color = strokeColor(this.editor, p)
    this.start = { x: p.x, y: p.y }
    this.draw(p)
  }

  move(p: ToolPointer): void {
    this.draw(p)
  }

  up(p: ToolPointer): void {
    if (!this.session) return
    this.draw(p)
    const label = this.kind === 'line' ? 'Ligne' : this.kind === 'rect' ? 'Rectangle' : 'Ellipse'
    this.session.commit(label)
    this.session = null
  }

  cancel(): void {
    this.session?.cancel()
    this.session = null
  }
}

class FillTool implements ToolBehavior {
  constructor(private readonly editor: Editor) {}

  down(p: ToolPointer): void {
    const doc = this.editor.doc
    if (!doc || p.x < 0 || p.y < 0 || p.x >= doc.width || p.y >= doc.height) return
    const session = this.editor.beginEdit()
    if (!session) return
    const color = strokeColor(this.editor, p)
    const sym = this.editor.activeSymmetry
    let rect: Rect | null = null
    for (const q of sym ? mirrorPoints(p.x, p.y, sym) : [p]) {
      rect = unionRect(rect, floodFill(session.cel, q.x, q.y, color, { contiguous: this.editor.fillContiguous }))
    }
    session.touch(rect)
    session.commit('Remplissage')
  }

  move(): void {}
  up(): void {}
  cancel(): void {}
}

class PickerTool implements ToolBehavior {
  constructor(private readonly editor: Editor) {}

  private pick(p: ToolPointer): void {
    const e = this.editor
    const doc = e.doc
    if (!doc || p.x < 0 || p.y < 0 || p.x >= doc.width || p.y >= doc.height) return
    let color: RGBA
    if (e.pickerSampleAll) {
      color = composePixel(doc, e.activeFrame, p.x, p.y)
    } else {
      const cel = doc.layers[e.activeLayer]?.cels[e.activeFrame]
      if (!cel || !inBounds(cel, p.x, p.y)) return
      color = getPixel(cel, p.x, p.y)
    }
    if (p.button === 2) e.setSecondary(color)
    else e.setPrimary(color)
  }

  down(p: ToolPointer): void {
    this.pick(p)
  }

  move(p: ToolPointer): void {
    this.pick(p)
  }

  up(): void {}
  cancel(): void {}
}

function selectionMode(p: ToolPointer): SelectionMode {
  return p.shift ? 'add' : p.alt ? 'subtract' : 'replace'
}

function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h
}

/**
 * Sélection rectangulaire. Selon l'endroit du clic :
 * - dans un collage en cours : déplace l'image collée ;
 * - dans la sélection (sans modificateur) : déplace le contenu sélectionné (une entrée d'historique) ;
 * - ailleurs : trace un rectangle qui remplace, s'ajoute à (Maj) ou se retire de (Alt) la sélection.
 */
class SelectTool implements ToolBehavior {
  private mode: 'none' | 'rect' | 'move' | 'floating' = 'none'
  private start: Point = { x: 0, y: 0 }
  private selMode: SelectionMode = 'replace'
  private floatOrigin: Point = { x: 0, y: 0 }
  private session: EditSession | null = null
  private moving: Selection | null = null
  private lifted: PixelClip | null = null
  private offset: Point = { x: 0, y: 0 }

  constructor(private readonly editor: Editor) {}

  down(p: ToolPointer): void {
    const e = this.editor
    if (!e.doc) return
    this.start = { x: p.x, y: p.y }
    const fr = e.floatingRect
    if (e.floating && fr) {
      if (inside(fr, p.x, p.y)) {
        this.mode = 'floating'
        this.floatOrigin = { x: e.floating.x, y: e.floating.y }
        return
      }
      e.commitFloating()
    }
    this.selMode = selectionMode(p)
    if (this.selMode === 'replace' && e.selection && isSelected(e.selection, p.x, p.y)) {
      const session = e.beginEdit({ clip: false, label: 'Déplacer la sélection' })
      if (!session || !e.selection) return
      this.session = session
      this.moving = e.selection
      this.lifted = extractSelected(session.originalPixels, e.selection)
      this.offset = { x: 0, y: 0 }
      this.mode = 'move'
      return
    }
    this.mode = 'rect'
    e.setSelectionPreview(rectFromPoints(p.x, p.y, p.x, p.y))
  }

  move(p: ToolPointer): void {
    const e = this.editor
    const dx = p.x - this.start.x
    const dy = p.y - this.start.y
    if (this.mode === 'floating') {
      e.moveFloatingTo(this.floatOrigin.x + dx, this.floatOrigin.y + dy)
    } else if (this.mode === 'rect') {
      e.setSelectionPreview(rectFromPoints(this.start.x, this.start.y, p.x, p.y))
    } else if (this.mode === 'move') {
      const s = this.session
      const sel = this.moving
      const lifted = this.lifted
      if (!s || s.isClosed || !sel || !lifted || (dx === this.offset.x && dy === this.offset.y)) return
      const previous = { x: sel.bounds.x + this.offset.x, y: sel.bounds.y + this.offset.y, w: sel.bounds.w, h: sel.bounds.h }
      s.restore()
      clearSelected(s.cel, sel)
      const placed = stampImage(s.cel, lifted.image, lifted.x + dx, lifted.y + dy)
      s.touch(unionRect(unionRect(sel.bounds, previous), placed))
      this.offset = { x: dx, y: dy }
      e.setSelectionOffset(this.offset)
    }
  }

  up(p: ToolPointer): void {
    const e = this.editor
    const doc = e.doc
    this.move(p)
    if (this.mode === 'rect' && doc) {
      e.setSelectionPreview(null)
      const isClick = p.x === this.start.x && p.y === this.start.y
      if (isClick && this.selMode === 'replace') e.deselect()
      else e.applySelection(rectSelection(doc.width, doc.height, rectFromPoints(this.start.x, this.start.y, p.x, p.y)), this.selMode)
    } else if (this.mode === 'move' && this.session && this.moving) {
      this.session.commit('Déplacer la sélection')
      const { x: ox, y: oy } = this.offset
      e.setSelection(ox !== 0 || oy !== 0 ? translateSelection(this.moving, ox, oy) : this.moving)
    }
    this.reset()
  }

  cancel(): void {
    const e = this.editor
    if (this.mode === 'rect') e.setSelectionPreview(null)
    else if (this.mode === 'move') {
      this.session?.cancel()
      e.setSelectionOffset(null)
    } else if (this.mode === 'floating') e.moveFloatingTo(this.floatOrigin.x, this.floatOrigin.y)
    this.reset()
  }

  private reset(): void {
    this.mode = 'none'
    this.session = null
    this.moving = null
    this.lifted = null
  }
}

/** Baguette magique : sélectionne (ou supprime) les pixels de la couleur cliquée. */
class WandTool implements ToolBehavior {
  constructor(private readonly editor: Editor) {}

  down(p: ToolPointer): void {
    const e = this.editor
    const doc = e.doc
    if (!doc) return
    if (p.x < 0 || p.y < 0 || p.x >= doc.width || p.y >= doc.height) {
      if (selectionMode(p) === 'replace' && e.wand.action === 'select') e.deselect()
      return
    }
    if (e.wand.action === 'delete') e.wandDelete(p.x, p.y)
    else e.wandSelect(p.x, p.y, selectionMode(p))
  }

  move(): void {}
  up(): void {}
  cancel(): void {}
}

export function createToolBehavior(editor: Editor, tool: ToolId): ToolBehavior {
  switch (tool) {
    case 'select':
      return new SelectTool(editor)
    case 'wand':
      return new WandTool(editor)
    case 'pencil':
      return new FreehandTool(editor, false)
    case 'eraser':
      return new FreehandTool(editor, true)
    case 'picker':
      return new PickerTool(editor)
    case 'fill':
      return new FillTool(editor)
    case 'line':
      return new ShapeTool(editor, 'line', false)
    case 'rect':
      return new ShapeTool(editor, 'rect', false)
    case 'rectFilled':
      return new ShapeTool(editor, 'rect', true)
    case 'ellipse':
      return new ShapeTool(editor, 'ellipse', false)
    case 'ellipseFilled':
      return new ShapeTool(editor, 'ellipse', true)
  }
}
