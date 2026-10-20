import type { Bitmap } from '../model/bitmap'
import type { RGBA } from '../model/color'
import type { Frame, PixelDocument } from '../model/document'

/**
 * Instantané de la *structure* d'un document : dimensions, calques (avec leurs
 * propriétés), images et palette.
 *
 * Les cellules (`Bitmap`) sont conservées *par référence* : un instantané est
 * donc peu coûteux. Cela suppose une règle simple, respectée par l'éditeur :
 * les modifications de pixels passent par des « patchs » d'historique
 * (`PixelEntry`), et toute opération structurelle qui transforme des pixels
 * (retournement, rotation, redimensionnement…) crée de *nouveaux* tampons au
 * lieu de modifier les anciens. Annuler/rétablir dans l'ordre reste alors exact.
 */
export interface LayerSnapshot {
  id: string
  name: string
  visible: boolean
  opacity: number
  cels: Bitmap[]
}

export interface StructureSnapshot {
  width: number
  height: number
  fps: number
  frames: Frame[]
  layers: LayerSnapshot[]
  palette: RGBA[]
}

export function captureStructure(doc: PixelDocument): StructureSnapshot {
  return {
    width: doc.width,
    height: doc.height,
    fps: doc.fps,
    frames: doc.frames.map((f) => ({ ...f })),
    layers: doc.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, cels: l.cels.slice() })),
    palette: doc.palette.map((c) => ({ ...c }))
  }
}

/** Remet le document dans l'état décrit (l'objet document est conservé). */
export function restoreStructure(doc: PixelDocument, snap: StructureSnapshot): void {
  doc.width = snap.width
  doc.height = snap.height
  doc.fps = snap.fps
  doc.frames = snap.frames.map((f) => ({ ...f }))
  doc.layers = snap.layers.map((l) => ({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, cels: l.cels.slice() }))
  doc.palette = snap.palette.map((c) => ({ ...c }))
}
