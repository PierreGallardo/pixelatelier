import {
  cloneBitmap,
  createBitmap,
  flipHorizontal,
  flipVertical,
  isEmpty,
  resizeCanvas,
  rotate90,
  scaleNearest,
  unionRect,
  type Bitmap,
  type Point,
  type Rect
} from '../model/bitmap'
import { colorsEqual, type RGBA } from '../model/color'
import { composeFrame } from '../model/compose'
import {
  clampFps,
  findFrameIndex,
  findLayerIndex,
  isValidDimension,
  newId,
  nextLayerName,
  type PixelDocument
} from '../model/document'
import { DEFAULT_PALETTE, MAX_PALETTE_SIZE } from '../model/palette'
import {
  clearSelected,
  combineSelections,
  extractSelected,
  invertSelection,
  rectSelection,
  selectAll,
  selectionFromMask,
  stampImage,
  type PixelClip,
  type Selection,
  type SelectionMode
} from '../model/selection'
import { History, type ActiveTarget, type HistoryEntry } from '../history/history'
import { captureStructure } from '../history/snapshot'
import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE } from '../raster/brush'
import { magicWandMask } from '../raster/wand'
import { EditSession, type EditSessionHost } from './EditSession'

export type ToolId =
  | 'select'
  | 'wand'
  | 'pencil'
  | 'eraser'
  | 'picker'
  | 'fill'
  | 'line'
  | 'rect'
  | 'rectFilled'
  | 'ellipse'
  | 'ellipseFilled'

/** Réglages de la baguette magique. */
export interface WandSettings {
  /** Vrai : zone de même couleur connectée ; faux : toute l'image. */
  contiguous: boolean
  /** Écart de couleur toléré par composante (0 à 255). */
  tolerance: number
  /** Au clic : sélectionner les pixels, ou les supprimer directement. */
  action: 'select' | 'delete'
}

/** Image collée encore déplaçable, posée sur la cellule active par une session ouverte. */
export interface FloatingPaste {
  session: EditSession
  image: Bitmap
  x: number
  y: number
}

export interface OnionSkinSettings {
  enabled: boolean
  before: number
  after: number
  /** Opacité de l'image voisine la plus proche, dans [0, 1]. */
  opacity: number
}

export type Anchor = 'tl' | 't' | 'tr' | 'l' | 'c' | 'r' | 'bl' | 'b' | 'br'

export type NoticeKind = 'info' | 'error'

export interface Notice {
  id: number
  text: string
  kind: NoticeKind
}

/** Actions de la vue (zoom, cadrage) enregistrées par le composant de dessin. */
export interface ViewCommands {
  zoomIn(): void
  zoomOut(): void
  fit(): void
  actualSize(): void
}

type Listener = () => void
type RenderListener = (rect: Rect | null) => void

/**
 * État central de l'application et commandes d'édition.
 *
 * L'éditeur ne dépend ni de React ni du DOM : l'interface s'abonne aux
 * changements (`subscribe`) et le canevas aux demandes de rendu
 * (`subscribeRender`). Toute modification du document passe par l'historique.
 */
export class Editor implements EditSessionHost {
  doc: PixelDocument | null = null
  filePath: string | null = null
  fileName = 'Sans titre'
  readonly history = new History()

  activeLayer = 0
  activeFrame = 0

  tool: ToolId = 'pencil'
  brushSize = 1
  fillContiguous = true
  /** Pipette : vrai = couleur affichée (tous les calques), faux = calque actif. */
  pickerSampleAll = true
  primary: RGBA = { r: 15, g: 13, b: 20, a: 255 }
  secondary: RGBA = { r: 255, g: 255, b: 255, a: 255 }
  selectedSwatch: number | null = null

  playing = false
  onion: OnionSkinSettings = { enabled: false, before: 1, after: 1, opacity: 0.4 }
  showGrid = true
  zoom = 1
  notice: Notice | null = null

  /** Sélection de pixels (masque à la taille du document), ou `null`. */
  selection: Selection | null = null
  /** Incrémenté à chaque changement de sélection (contour à redessiner). */
  selectionVersion = 0
  /** Décalage d'aperçu du contour pendant le déplacement du contenu sélectionné. */
  selectionOffset: Point | null = null
  /** Rectangle en cours de tracé avec l'outil de sélection (aperçu). */
  selectionPreview: Rect | null = null
  /** Collage en cours, encore déplaçable (Entrée valide, Échap annule). */
  floating: FloatingPaste | null = null
  /** Presse-papiers interne : copie exacte, transparence comprise. */
  clipboard: PixelClip | null = null
  wand: WandSettings = { contiguous: true, tolerance: 0, action: 'select' }

  /** Incrémenté à chaque changement observable (état ou document). */
  version = 0
  /** Incrémenté à chaque changement de structure (et à chaque annulation). */
  structureRevision = 0
  private frameRevisions = new Map<string, number>()
  private listeners = new Set<Listener>()
  private renderListeners = new Set<RenderListener>()
  private session: EditSession | null = null
  private sessionLabel = 'Dessin'
  private noticeCounter = 0
  viewCommands: ViewCommands | null = null
  /** Dernier point dessiné au crayon (Maj+clic trace une ligne depuis ce point). */
  lastFreehandPoint: { x: number; y: number } | null = null

  /* ------------------------------ Abonnements ------------------------------ */

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  subscribeRender(fn: RenderListener): () => void {
    this.renderListeners.add(fn)
    return () => this.renderListeners.delete(fn)
  }

  emit(): void {
    this.version++
    for (const fn of [...this.listeners]) fn()
  }

  requestRender(rect: Rect | null = null): void {
    for (const fn of [...this.renderListeners]) fn(rect)
  }

  notify(text: string, kind: NoticeKind = 'info'): void {
    this.notice = { id: ++this.noticeCounter, text, kind }
    this.emit()
  }

  clearNotice(id: number): void {
    if (this.notice?.id === id) {
      this.notice = null
      this.emit()
    }
  }

  /* ------------------------------- Document ------------------------------- */

  get dirty(): boolean {
    return this.doc !== null && this.history.dirty
  }

  get title(): string {
    return this.doc ? `${this.fileName}${this.dirty ? ' •' : ''} — Pixelatelier` : 'Pixelatelier'
  }

  setDocument(doc: PixelDocument, filePath: string | null, opts: { name?: string; dirty?: boolean } = {}): void {
    this.finishSession()
    this.doc = doc
    this.filePath = filePath
    this.fileName = opts.name ?? (filePath ? baseName(filePath) : 'Sans titre')
    this.history.clear(!opts.dirty)
    this.activeLayer = doc.layers.length - 1
    this.activeFrame = 0
    this.playing = false
    this.selectedSwatch = null
    this.lastFreehandPoint = null
    this.resetSelectionState()
    this.frameRevisions.clear()
    this.structureRevision++
    this.requestRender(null)
    this.emit()
  }

  private resetSelectionState(): void {
    this.selection = null
    this.selectionOffset = null
    this.selectionPreview = null
    this.selectionVersion++
  }

  closeDocument(): void {
    this.finishSession()
    this.doc = null
    this.filePath = null
    this.fileName = 'Sans titre'
    this.history.clear()
    this.playing = false
    this.resetSelectionState()
    this.structureRevision++
    this.emit()
  }

  /**
   * Note qu'un enregistrement a réussi. `stateId` est l'état de l'historique au
   * moment où le contenu a été sérialisé (des modifications ont pu suivre).
   */
  markSaved(filePath: string, stateId = this.history.stateId): void {
    this.filePath = filePath
    this.fileName = baseName(filePath)
    this.history.markSaved(stateId)
    this.emit()
  }

  frameRevision(frameId: string): number {
    return this.frameRevisions.get(frameId) ?? 0
  }

  get activeLayerObj() {
    return this.doc?.layers[this.activeLayer] ?? null
  }

  /* ------------------------ Calque et image actifs ------------------------ */

  private activeTarget(): ActiveTarget {
    return { layerId: this.doc?.layers[this.activeLayer]?.id ?? null, frameIndex: this.activeFrame }
  }

  private applyActiveTarget(sel: ActiveTarget): void {
    if (!this.doc) return
    const li = sel.layerId ? findLayerIndex(this.doc, sel.layerId) : -1
    if (li >= 0) this.activeLayer = li
    this.activeFrame = sel.frameIndex
    this.clampActive()
  }

  private clampActive(): void {
    if (!this.doc) return
    this.activeLayer = Math.min(Math.max(0, this.activeLayer), this.doc.layers.length - 1)
    this.activeFrame = Math.min(Math.max(0, this.activeFrame), this.doc.frames.length - 1)
  }

  setActiveLayer(index: number): void {
    if (!this.doc || index === this.activeLayer) return
    this.finishSession()
    this.activeLayer = index
    this.clampActive()
    this.emit()
  }

  setActiveFrame(index: number): void {
    if (!this.doc) return
    const n = this.doc.frames.length
    const next = ((index % n) + n) % n
    if (next === this.activeFrame) return
    this.finishSession()
    this.activeFrame = next
    this.requestRender(null)
    this.emit()
  }

  nextFrame(): void {
    this.setActiveFrame(this.activeFrame + 1)
  }

  prevFrame(): void {
    this.setActiveFrame(this.activeFrame - 1)
  }

  /* ----------------------- Sessions de modification ----------------------- */

  /**
   * Ouvre une session de modification sur la cellule active.
   * Retourne `null` (avec un message) si le calque actif est masqué.
   *
   * Par défaut, le dessin est confiné à la sélection active (`clip`) ;
   * `label` nomme l'entrée d'historique si la session est validée par `finishSession()`.
   */
  beginEdit(opts: { clip?: boolean; label?: string } = {}): EditSession | null {
    const doc = this.doc
    if (!doc) return null
    this.finishSession()
    if (this.playing) this.pause()
    const layer = doc.layers[this.activeLayer]
    if (!layer) return null
    if (!layer.visible) {
      this.notify('Le calque actif est masqué : affichez-le pour dessiner.', 'error')
      return null
    }
    const frame = doc.frames[this.activeFrame]
    const clip = opts.clip === false ? null : (this.selection?.mask ?? null)
    this.session = new EditSession(this, layer.cels[this.activeFrame], layer.id, frame.id, clip)
    this.sessionLabel = opts.label ?? 'Dessin'
    return this.session
  }

  /** Termine (valide) la session en cours, s'il y en a une, y compris un collage flottant. */
  finishSession(): void {
    if (this.floating) this.commitFloating()
    if (this.session && !this.session.isClosed) this.session.commit(this.sessionLabel)
    this.session = null
  }

  commitPixels(session: EditSession, label: string, rect: Rect, before: Uint8ClampedArray, after: Uint8ClampedArray): void {
    this.history.push({ kind: 'pixels', label, layerId: session.layerId, frameId: session.frameId, rect, before, after })
    this.bumpFrame(session.frameId)
    this.emit()
  }

  endSession(session: EditSession): void {
    if (this.session === session) this.session = null
  }

  private bumpFrame(frameId: string): void {
    this.frameRevisions.set(frameId, this.frameRevision(frameId) + 1)
  }

  /* ------------------------- Annuler / rétablir ------------------------- */

  undo(): void {
    if (!this.doc) return
    this.finishSession()
    const entry = this.history.undo(this.doc)
    if (entry) this.afterHistoryMove(entry, 'undo')
  }

  redo(): void {
    if (!this.doc) return
    this.finishSession()
    const entry = this.history.redo(this.doc)
    if (entry) this.afterHistoryMove(entry, 'redo')
  }

  private afterHistoryMove(entry: HistoryEntry, direction: 'undo' | 'redo'): void {
    const doc = this.doc
    if (!doc) return
    if (entry.kind === 'pixels') {
      const li = findLayerIndex(doc, entry.layerId)
      const fi = findFrameIndex(doc, entry.frameId)
      if (li >= 0) this.activeLayer = li
      if (fi >= 0) this.activeFrame = fi
      this.bumpFrame(entry.frameId)
    } else {
      this.applyActiveTarget(direction === 'undo' ? entry.selBefore : entry.selAfter)
      this.structureRevision++
    }
    this.playing = false
    this.clampActive()
    this.validateSelection()
    this.requestRender(null)
    this.emit()
  }

  /** Supprime la sélection si elle ne correspond plus aux dimensions du document. */
  private validateSelection(): void {
    const sel = this.selection
    const doc = this.doc
    if (sel && (!doc || sel.width !== doc.width || sel.height !== doc.height)) this.resetSelectionState()
  }

  /* ----------------------- Opérations de structure ----------------------- */

  /**
   * Exécute une modification de structure et l'enregistre dans l'historique.
   * `mutate` peut retourner `false` pour annuler l'opération (rien n'est enregistré).
   */
  private structural(label: string, mutate: (doc: PixelDocument) => boolean | void, opts: { mergeKey?: string } = {}): boolean {
    const doc = this.doc
    if (!doc) return false
    this.finishSession()
    const before = captureStructure(doc)
    const selBefore = this.activeTarget()
    if (mutate(doc) === false) return false
    this.clampActive()
    this.validateSelection()
    this.history.push({
      kind: 'structure',
      label,
      before,
      after: captureStructure(doc),
      selBefore,
      selAfter: this.activeTarget(),
      mergeKey: opts.mergeKey
    })
    this.structureRevision++
    this.requestRender(null)
    this.emit()
    return true
  }

  addLayer(): void {
    this.structural('Nouveau calque', (doc) => {
      const at = this.activeLayer + 1
      doc.layers.splice(at, 0, {
        id: newId('layer'),
        name: nextLayerName(doc),
        visible: true,
        opacity: 1,
        cels: doc.frames.map(() => createBitmap(doc.width, doc.height))
      })
      this.activeLayer = at
    })
  }

  duplicateLayer(): void {
    this.structural('Dupliquer le calque', (doc) => {
      const src = doc.layers[this.activeLayer]
      if (!src) return false
      const at = this.activeLayer + 1
      doc.layers.splice(at, 0, {
        id: newId('layer'),
        name: `${src.name} (copie)`,
        visible: src.visible,
        opacity: src.opacity,
        cels: src.cels.map(cloneBitmap)
      })
      this.activeLayer = at
    })
  }

  deleteLayer(index = this.activeLayer): void {
    if (this.doc && this.doc.layers.length <= 1) {
      this.notify('Impossible de supprimer le dernier calque.', 'error')
      return
    }
    this.structural('Supprimer le calque', (doc) => {
      if (!doc.layers[index]) return false
      doc.layers.splice(index, 1)
      if (this.activeLayer > index) this.activeLayer--
      else if (this.activeLayer === index) this.activeLayer = Math.max(0, index - 1)
    })
  }

  /** Déplace un calque d'un cran : `direction` > 0 vers le haut, < 0 vers le bas. */
  moveLayer(index: number, direction: number): void {
    const doc = this.doc
    if (!doc) return
    const target = index + Math.sign(direction)
    if (target < 0 || target >= doc.layers.length) return
    this.structural(direction > 0 ? 'Monter le calque' : 'Descendre le calque', (d) => {
      const [layer] = d.layers.splice(index, 1)
      d.layers.splice(target, 0, layer)
      if (this.activeLayer === index) this.activeLayer = target
      else if (this.activeLayer === target) this.activeLayer = index
    })
  }

  /** Place le calque `from` à la position `to` (glisser-déposer). */
  reorderLayer(from: number, to: number): void {
    const doc = this.doc
    if (!doc || from === to || !doc.layers[from] || to < 0 || to >= doc.layers.length) return
    this.structural('Réordonner les calques', (d) => {
      const activeId = d.layers[this.activeLayer]?.id
      const [layer] = d.layers.splice(from, 1)
      d.layers.splice(to, 0, layer)
      const idx = d.layers.findIndex((l) => l.id === activeId)
      if (idx >= 0) this.activeLayer = idx
    })
  }

  renameLayer(index: number, name: string): void {
    const clean = name.trim().slice(0, 100)
    const layer = this.doc?.layers[index]
    if (!layer || !clean || clean === layer.name) return
    this.structural('Renommer le calque', (doc) => {
      doc.layers[index].name = clean
    })
  }

  setLayerVisible(index: number, visible: boolean): void {
    const layer = this.doc?.layers[index]
    if (!layer || layer.visible === visible) return
    this.structural(visible ? 'Afficher le calque' : 'Masquer le calque', (doc) => {
      doc.layers[index].visible = visible
    })
  }

  setLayerOpacity(index: number, opacity: number): void {
    const layer = this.doc?.layers[index]
    const value = Math.min(1, Math.max(0, Math.round(opacity * 100) / 100))
    if (!layer || layer.opacity === value) return
    this.structural(
      'Opacité du calque',
      (doc) => {
        doc.layers[index].opacity = value
      },
      { mergeKey: `opacity:${layer.id}` }
    )
  }

  /** Fusionne le calque actif dans le calque situé juste en dessous. */
  mergeLayerDown(): void {
    const doc = this.doc
    if (!doc) return
    if (this.activeLayer === 0) {
      this.notify('Aucun calque en dessous avec lequel fusionner.', 'error')
      return
    }
    this.structural('Fusionner vers le bas', (d) => {
      const upper = d.layers[this.activeLayer]
      const lower = d.layers[this.activeLayer - 1]
      const pair: PixelDocument = {
        ...d,
        layers: [
          { ...lower, visible: true, opacity: 1 },
          { ...upper, visible: true }
        ]
      }
      lower.cels = d.frames.map((_, f) => ({ width: d.width, height: d.height, data: composeFrame(pair, f) }))
      d.layers.splice(this.activeLayer, 1)
      this.activeLayer -= 1
    })
  }

  addFrame(): void {
    this.structural('Nouvelle image', (doc) => {
      const at = this.activeFrame + 1
      doc.frames.splice(at, 0, { id: newId('frame') })
      for (const layer of doc.layers) layer.cels.splice(at, 0, createBitmap(doc.width, doc.height))
      this.activeFrame = at
    })
  }

  duplicateFrame(): void {
    this.structural("Dupliquer l'image", (doc) => {
      const at = this.activeFrame + 1
      doc.frames.splice(at, 0, { id: newId('frame') })
      for (const layer of doc.layers) layer.cels.splice(at, 0, cloneBitmap(layer.cels[this.activeFrame]))
      this.activeFrame = at
    })
  }

  deleteFrame(index = this.activeFrame): void {
    if (this.doc && this.doc.frames.length <= 1) {
      this.notify('Impossible de supprimer la dernière image.', 'error')
      return
    }
    this.structural("Supprimer l'image", (doc) => {
      if (!doc.frames[index]) return false
      doc.frames.splice(index, 1)
      for (const layer of doc.layers) layer.cels.splice(index, 1)
      if (this.activeFrame > index || this.activeFrame >= doc.frames.length) this.activeFrame--
    })
  }

  /** Déplace une image d'animation d'un cran : `direction` > 0 vers la droite. */
  moveFrame(index: number, direction: number): void {
    const doc = this.doc
    if (!doc) return
    const target = index + Math.sign(direction)
    if (target < 0 || target >= doc.frames.length) return
    this.structural("Déplacer l'image", (d) => {
      const [frame] = d.frames.splice(index, 1)
      d.frames.splice(target, 0, frame)
      for (const layer of d.layers) {
        const [cel] = layer.cels.splice(index, 1)
        layer.cels.splice(target, 0, cel)
      }
      if (this.activeFrame === index) this.activeFrame = target
      else if (this.activeFrame === target) this.activeFrame = index
    })
  }

  setFps(fps: number): void {
    const value = clampFps(fps)
    if (!this.doc || this.doc.fps === value) return
    this.structural(
      'Images par seconde',
      (doc) => {
        doc.fps = value
      },
      { mergeKey: 'fps' }
    )
  }

  /* -------------------------------- Palette -------------------------------- */

  addPaletteColor(c: RGBA): void {
    const doc = this.doc
    if (!doc) return
    const existing = doc.palette.findIndex((p) => colorsEqual(p, c))
    if (existing >= 0) {
      this.selectedSwatch = existing
      this.emit()
      return
    }
    if (doc.palette.length >= MAX_PALETTE_SIZE) {
      this.notify(`La palette est limitée à ${MAX_PALETTE_SIZE} couleurs.`, 'error')
      return
    }
    this.structural('Ajouter une couleur', (d) => {
      d.palette.push({ ...c })
      this.selectedSwatch = d.palette.length - 1
    })
  }

  replacePaletteColor(index: number, c: RGBA): void {
    const doc = this.doc
    if (!doc || !doc.palette[index] || colorsEqual(doc.palette[index], c)) return
    this.structural('Modifier une couleur', (d) => {
      d.palette[index] = { ...c }
    })
  }

  removePaletteColor(index: number): void {
    if (!this.doc?.palette[index]) return
    this.structural('Retirer une couleur', (d) => {
      d.palette.splice(index, 1)
      this.selectedSwatch = d.palette.length === 0 ? null : Math.min(index, d.palette.length - 1)
    })
  }

  resetPalette(): void {
    this.structural('Palette par défaut', (d) => {
      d.palette = DEFAULT_PALETTE.map((c) => ({ ...c }))
      this.selectedSwatch = null
    })
  }

  selectSwatch(index: number | null): void {
    this.selectedSwatch = index
    this.emit()
  }

  /* -------------------------------- Image -------------------------------- */

  private transformAllCels(label: string, fn: (cel: Bitmap) => Bitmap, newSize?: { w: number; h: number }): void {
    this.structural(label, (doc) => {
      for (const layer of doc.layers) layer.cels = layer.cels.map(fn)
      if (newSize) {
        doc.width = newSize.w
        doc.height = newSize.h
      }
    })
  }

  flipHorizontal(): void {
    this.transformAllCels('Retourner horizontalement', flipHorizontal)
  }

  flipVertical(): void {
    this.transformAllCels('Retourner verticalement', flipVertical)
  }

  rotate(clockwise: boolean): void {
    const doc = this.doc
    if (!doc) return
    this.transformAllCels(clockwise ? 'Rotation horaire' : 'Rotation antihoraire', (c) => rotate90(c, clockwise), {
      w: doc.height,
      h: doc.width
    })
  }

  resizeCanvas(width: number, height: number, anchor: Anchor): boolean {
    const doc = this.doc
    if (!doc || !isValidDimension(width) || !isValidDimension(height)) return false
    if (width === doc.width && height === doc.height) return false
    const col = anchor.endsWith('l') ? 0 : anchor.endsWith('r') ? 2 : 1
    const row = anchor.startsWith('t') ? 0 : anchor.startsWith('b') ? 2 : 1
    const ox = col === 0 ? 0 : col === 2 ? width - doc.width : Math.floor((width - doc.width) / 2)
    const oy = row === 0 ? 0 : row === 2 ? height - doc.height : Math.floor((height - doc.height) / 2)
    this.transformAllCels('Taille du canevas', (c) => resizeCanvas(c, width, height, ox, oy), { w: width, h: height })
    return true
  }

  scaleImage(width: number, height: number): boolean {
    const doc = this.doc
    if (!doc || !isValidDimension(width) || !isValidDimension(height)) return false
    if (width === doc.width && height === doc.height) return false
    this.transformAllCels("Redimensionner l'image", (c) => scaleNearest(c, width, height), { w: width, h: height })
    return true
  }

  /** Efface la cellule active (calque actif, image active). */
  clearCel(): void {
    const session = this.beginEdit({ clip: false, label: "Effacer l'image" })
    if (!session) return
    if (isEmpty(session.cel)) {
      session.cancel()
      return
    }
    session.cel.data.fill(0)
    session.touch({ x: 0, y: 0, w: session.cel.width, h: session.cel.height })
    session.commit("Effacer l'image")
  }

  /* ------------------------- Sélection de pixels ------------------------- */

  setSelection(sel: Selection | null): void {
    this.selection = sel
    this.selectionOffset = null
    this.selectionVersion++
    this.emit()
  }

  /** Combine une nouvelle zone avec la sélection actuelle (remplacer, ajouter, retirer). */
  applySelection(next: Selection | null, mode: SelectionMode): void {
    this.setSelection(combineSelections(this.selection, next, mode))
  }

  selectAllPixels(): void {
    if (!this.doc) return
    this.finishSession()
    this.setSelection(selectAll(this.doc.width, this.doc.height))
  }

  deselect(): void {
    if (this.floating) this.commitFloating()
    if (this.selection) this.setSelection(null)
  }

  invertSelectionPixels(): void {
    if (!this.doc) return
    this.finishSession()
    this.setSelection(invertSelection(this.selection, this.doc.width, this.doc.height))
  }

  /** Aperçu du rectangle de sélection en cours de tracé. */
  setSelectionPreview(rect: Rect | null): void {
    this.selectionPreview = rect
    this.emit()
  }

  /** Aperçu du décalage du contour pendant un déplacement. */
  setSelectionOffset(offset: Point | null): void {
    this.selectionOffset = offset
    this.emit()
  }

  /**
   * Copie la sélection dans le presse-papiers interne : calque actif, ou image
   * composée (tous les calques visibles) si `merged`.
   */
  copySelection(merged = false): PixelClip | null {
    const doc = this.doc
    if (!doc) return null
    this.finishSession()
    const sel = this.selection
    if (!sel) {
      this.notify('Aucune sélection : sélectionnez une zone (Ctrl+A pour tout sélectionner).', 'error')
      return null
    }
    const src: Bitmap = merged
      ? { width: doc.width, height: doc.height, data: composeFrame(doc, this.activeFrame) }
      : doc.layers[this.activeLayer].cels[this.activeFrame]
    const clip = extractSelected(src, sel)
    this.clipboard = clip
    this.emit()
    return clip
  }

  /** Copie puis efface la sélection du calque actif. */
  cutSelection(): PixelClip | null {
    const clip = this.copySelection(false)
    if (!clip) return null
    this.clearSelectionPixels('Couper')
    return clip
  }

  /** Rend transparents les pixels sélectionnés du calque actif (une entrée d'historique). */
  clearSelectionPixels(label = 'Supprimer la sélection'): boolean {
    const sel = this.selection
    if (!sel) return false
    const session = this.beginEdit({ clip: false, label })
    if (!session) return false
    session.touch(clearSelected(session.cel, sel))
    return session.commit(label)
  }

  /** Commande « Supprimer » : collage en cours, sinon sélection, sinon toute l'image du calque. */
  deleteCommand(): void {
    if (this.floating) this.cancelFloating()
    else if (this.selection) this.clearSelectionPixels()
    else this.clearCel()
  }

  /**
   * Colle une image sur le calque actif. Elle reste « flottante » (déplaçable avec
   * l'outil de sélection ou les flèches) jusqu'à validation : Entrée, clic en dehors,
   * changement d'outil, d'image ou de calque… Échap annule le collage.
   */
  paste(clip: PixelClip): boolean {
    const doc = this.doc
    if (!doc) return false
    this.finishSession()
    this.tool = 'select'
    const session = this.beginEdit({ clip: false, label: 'Coller' })
    if (!session) {
      this.emit()
      return false
    }
    // Même position que l'original si l'image y tient, sinon ramenée dans le document.
    const x = Math.max(0, Math.min(clip.x, doc.width - clip.image.width))
    const y = Math.max(0, Math.min(clip.y, doc.height - clip.image.height))
    this.floating = { session, image: clip.image, x, y }
    this.selection = null
    this.selectionVersion++
    this.drawFloating(null)
    this.emit()
    return true
  }

  get floatingRect(): Rect | null {
    const f = this.floating
    return f ? { x: f.x, y: f.y, w: f.image.width, h: f.image.height } : null
  }

  private drawFloating(previous: Rect | null): void {
    const f = this.floating
    if (!f) return
    f.session.restore()
    const placed = stampImage(f.session.cel, f.image, f.x, f.y)
    const area = unionRect(previous, placed)
    if (area) f.session.touch(area)
  }

  moveFloatingTo(x: number, y: number): void {
    const f = this.floating
    if (!f || (f.x === x && f.y === y)) return
    const previous = this.floatingRect
    f.x = Math.round(x)
    f.y = Math.round(y)
    this.drawFloating(previous)
    this.emit()
  }

  /** Valide le collage : une entrée d'historique, et la zone collée devient la sélection. */
  commitFloating(): void {
    const f = this.floating
    if (!f) return
    const rect = this.floatingRect
    this.floating = null
    f.session.commit('Coller')
    const doc = this.doc
    this.selection = doc && rect ? rectSelection(doc.width, doc.height, rect) : null
    this.selectionVersion++
    this.emit()
  }

  cancelFloating(): void {
    const f = this.floating
    if (!f) return
    this.floating = null
    f.session.cancel()
    this.selectionVersion++
    this.emit()
  }

  /** Masque de la baguette magique au point (x, y) du calque actif, ou `null`. */
  wandMask(x: number, y: number): Uint8Array | null {
    const doc = this.doc
    const cel = doc?.layers[this.activeLayer]?.cels[this.activeFrame]
    if (!doc || !cel) return null
    return magicWandMask(cel, x, y, { contiguous: this.wand.contiguous, tolerance: this.wand.tolerance })
  }

  /** Baguette magique : sélectionne les pixels de même couleur. */
  wandSelect(x: number, y: number, mode: SelectionMode): void {
    const doc = this.doc
    if (!doc) return
    this.finishSession()
    const mask = this.wandMask(x, y)
    if (!mask) return
    this.applySelection(selectionFromMask(doc.width, doc.height, mask), mode)
  }

  /**
   * Baguette magique en mode suppression : rend transparents les pixels de même
   * couleur (zone contiguë ou toute l'image), limités à la sélection si elle existe.
   * Une seule entrée d'historique. Retourne le nombre de pixels effacés.
   */
  wandDelete(x: number, y: number): number {
    const doc = this.doc
    if (!doc) return 0
    this.finishSession()
    const mask = this.wandMask(x, y)
    const cel = doc.layers[this.activeLayer]?.cels[this.activeFrame]
    if (!mask || !cel) return 0
    const sel = this.selection
    let visible = 0
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] && sel && !sel.mask[i]) mask[i] = 0
      if (mask[i] && cel.data[i * 4 + 3] !== 0) visible++
    }
    const target = selectionFromMask(doc.width, doc.height, mask)
    if (!target || visible === 0) {
      this.notify(sel && !target ? 'Ce pixel est hors de la sélection.' : 'Ces pixels sont déjà transparents.')
      return 0
    }
    const session = this.beginEdit({ clip: false, label: 'Supprimer la couleur' })
    if (!session) return 0
    session.touch(clearSelected(session.cel, target))
    session.commit('Supprimer la couleur')
    this.notify(`${visible} pixel${visible > 1 ? 's' : ''} supprimé${visible > 1 ? 's' : ''}${sel ? ' dans la sélection' : ''}.`)
    return visible
  }

  setWand(settings: Partial<WandSettings>): void {
    const tolerance = Math.min(255, Math.max(0, Math.round(settings.tolerance ?? this.wand.tolerance)))
    this.wand = { ...this.wand, ...settings, tolerance }
    this.emit()
  }


  /* ------------------------------- Couleurs ------------------------------- */

  setPrimary(c: RGBA): void {
    if (colorsEqual(c, this.primary)) return
    this.primary = { ...c }
    this.emit()
  }

  setSecondary(c: RGBA): void {
    if (colorsEqual(c, this.secondary)) return
    this.secondary = { ...c }
    this.emit()
  }

  swapColors(): void {
    ;[this.primary, this.secondary] = [this.secondary, this.primary]
    this.emit()
  }

  /* -------------------------------- Outils -------------------------------- */

  setTool(tool: ToolId): void {
    if (this.tool === tool) return
    this.finishSession()
    this.tool = tool
    this.emit()
  }

  setBrushSize(size: number): void {
    const s = Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, Math.round(size)))
    if (s === this.brushSize) return
    this.brushSize = s
    this.emit()
  }

  setFillContiguous(v: boolean): void {
    this.fillContiguous = v
    this.emit()
  }

  setPickerSampleAll(v: boolean): void {
    this.pickerSampleAll = v
    this.emit()
  }

  /* --------------------------- Vue et lecture --------------------------- */

  setZoom(zoom: number): void {
    if (zoom === this.zoom) return
    this.zoom = zoom
    this.emit()
  }

  toggleGrid(): void {
    this.showGrid = !this.showGrid
    this.requestRender(null)
    this.emit()
  }

  setOnion(settings: Partial<OnionSkinSettings>): void {
    this.onion = { ...this.onion, ...settings }
    this.requestRender(null)
    this.emit()
  }

  play(): void {
    if (!this.doc || this.playing) return
    this.finishSession()
    if (this.doc.frames.length < 2) {
      this.notify("Ajoutez au moins deux images pour lire l'animation.")
      return
    }
    this.playing = true
    this.emit()
  }

  pause(): void {
    if (!this.playing) return
    this.playing = false
    this.requestRender(null)
    this.emit()
  }

  togglePlay(): void {
    if (this.playing) this.pause()
    else this.play()
  }
}

function baseName(p: string): string {
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1] || p
}
