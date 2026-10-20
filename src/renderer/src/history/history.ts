import { writeRect, type Rect } from '../model/bitmap'
import { findFrameIndex, findLayerIndex, type PixelDocument } from '../model/document'
import { restoreStructure, type StructureSnapshot } from './snapshot'

/** Calque et image actifs, restaurés lors d'une annulation. */
export interface ActiveTarget {
  layerId: string | null
  frameIndex: number
}

/** Modification de pixels dans une seule cellule (un trait complet = une entrée). */
export interface PixelEntry {
  kind: 'pixels'
  id: number
  label: string
  layerId: string
  frameId: string
  rect: Rect
  before: Uint8ClampedArray
  after: Uint8ClampedArray
}

/** Modification de structure (calques, images, palette, dimensions…). */
export interface StructureEntry {
  kind: 'structure'
  id: number
  label: string
  before: StructureSnapshot
  after: StructureSnapshot
  selBefore: ActiveTarget
  selAfter: ActiveTarget
  /** Deux entrées consécutives de même clé sont fusionnées (ex. curseur d'opacité). */
  mergeKey?: string
  time: number
}

export type HistoryEntry = PixelEntry | StructureEntry
export type NewHistoryEntry = Omit<PixelEntry, 'id'> | Omit<StructureEntry, 'id' | 'time'>

/** Délai pendant lequel des entrées de même `mergeKey` sont fusionnées. */
const MERGE_WINDOW_MS = 1500

export class History {
  private undoStack: HistoryEntry[] = []
  private redoStack: HistoryEntry[] = []
  private nextId = 1
  /** Identifiant de l'entrée au sommet de la pile lors du dernier enregistrement (0 = pile vide). */
  private savedId = 0

  constructor(public readonly limit = 300) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  get undoLabel(): string | null {
    return this.undoStack.at(-1)?.label ?? null
  }

  get redoLabel(): string | null {
    return this.redoStack.at(-1)?.label ?? null
  }

  get size(): number {
    return this.undoStack.length
  }

  push(entry: NewHistoryEntry, now = Date.now()): HistoryEntry {
    const top = this.undoStack.at(-1)
    if (
      entry.kind === 'structure' &&
      entry.mergeKey &&
      top?.kind === 'structure' &&
      top.mergeKey === entry.mergeKey &&
      top.id !== this.savedId &&
      this.redoStack.length === 0 &&
      now - top.time < MERGE_WINDOW_MS
    ) {
      top.after = entry.after
      top.selAfter = entry.selAfter
      top.time = now
      return top
    }
    const full: HistoryEntry =
      entry.kind === 'structure' ? { ...entry, id: this.nextId++, time: now } : { ...entry, id: this.nextId++ }
    this.undoStack.push(full)
    this.redoStack = []
    if (this.undoStack.length > this.limit) this.undoStack.splice(0, this.undoStack.length - this.limit)
    return full
  }

  undo(doc: PixelDocument): HistoryEntry | null {
    const entry = this.undoStack.pop()
    if (!entry) return null
    applyEntry(doc, entry, 'undo')
    this.redoStack.push(entry)
    return entry
  }

  redo(doc: PixelDocument): HistoryEntry | null {
    const entry = this.redoStack.pop()
    if (!entry) return null
    applyEntry(doc, entry, 'redo')
    this.undoStack.push(entry)
    return entry
  }

  /** Identifiant de l'état courant (0 si aucune entrée). */
  get stateId(): number {
    return this.undoStack.at(-1)?.id ?? 0
  }

  /** Marque l'état courant (ou un état antérieur, capturé avec `stateId`) comme enregistré. */
  markSaved(stateId = this.stateId): void {
    this.savedId = stateId
  }

  /** Vrai si l'état courant diffère du dernier état enregistré. */
  get dirty(): boolean {
    return (this.undoStack.at(-1)?.id ?? 0) !== this.savedId
  }

  /** Vide l'historique ; `saved` indique si l'état courant correspond à un fichier enregistré. */
  clear(saved = true): void {
    this.undoStack = []
    this.redoStack = []
    this.savedId = saved ? 0 : -1
  }
}

export function applyEntry(doc: PixelDocument, entry: HistoryEntry, direction: 'undo' | 'redo'): void {
  if (entry.kind === 'structure') {
    restoreStructure(doc, direction === 'undo' ? entry.before : entry.after)
    return
  }
  const li = findLayerIndex(doc, entry.layerId)
  const fi = findFrameIndex(doc, entry.frameId)
  if (li < 0 || fi < 0) throw new Error('Historique incohérent : cellule introuvable')
  writeRect(doc.layers[li].cels[fi], entry.rect, direction === 'undo' ? entry.before : entry.after)
}
