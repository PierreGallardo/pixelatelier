import { createBitmap, type Bitmap } from './bitmap'
import type { RGBA } from './color'
import { DEFAULT_PALETTE } from './palette'

/**
 * Modèle du document.
 *
 * Un document contient des images d'animation (`frames`) et des calques (`layers`).
 * Chaque calque possède exactement une cellule (`cels[i]`) par image d'animation :
 * `layers[l].cels[f]` est le tampon RGBA du calque `l` pour l'image `f`.
 * L'ordre des calques va du bas (index 0) vers le haut.
 */
export interface Layer {
  id: string
  name: string
  visible: boolean
  /** Opacité du calque dans [0, 1]. */
  opacity: number
  cels: Bitmap[]
}

export interface Frame {
  id: string
}

export interface PixelDocument {
  width: number
  height: number
  /** Images par seconde pour la lecture et l'export GIF. */
  fps: number
  layers: Layer[]
  frames: Frame[]
  palette: RGBA[]
}

export const MAX_DIMENSION = 4096
export const MIN_FPS = 1
export const MAX_FPS = 60

let idCounter = 0
export function newId(prefix: string): string {
  idCounter += 1
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${rand}`
}

export function isValidDimension(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= MAX_DIMENSION
}

export function clampFps(fps: number): number {
  if (!Number.isFinite(fps)) return 8
  return Math.min(MAX_FPS, Math.max(MIN_FPS, Math.round(fps)))
}

export interface NewDocumentOptions {
  width: number
  height: number
  /** Couleur de fond du premier calque ; transparent si absente. */
  background?: RGBA | null
  fps?: number
  palette?: RGBA[]
}

export function createDocument(opts: NewDocumentOptions): PixelDocument {
  if (!isValidDimension(opts.width) || !isValidDimension(opts.height)) {
    throw new RangeError(`Dimensions invalides (1 à ${MAX_DIMENSION} pixels) : ${opts.width}×${opts.height}`)
  }
  const frame: Frame = { id: newId('frame') }
  const layer: Layer = {
    id: newId('layer'),
    name: opts.background && opts.background.a > 0 ? 'Fond' : 'Calque 1',
    visible: true,
    opacity: 1,
    cels: [createBitmap(opts.width, opts.height, opts.background ?? undefined)]
  }
  return {
    width: opts.width,
    height: opts.height,
    fps: clampFps(opts.fps ?? 8),
    layers: [layer],
    frames: [frame],
    palette: (opts.palette ?? DEFAULT_PALETTE).map((c) => ({ ...c }))
  }
}

export function getCel(doc: PixelDocument, layerIndex: number, frameIndex: number): Bitmap {
  const layer = doc.layers[layerIndex]
  if (!layer) throw new RangeError(`Calque inexistant : ${layerIndex}`)
  const cel = layer.cels[frameIndex]
  if (!cel) throw new RangeError(`Image inexistante : ${frameIndex}`)
  return cel
}

export function findLayerIndex(doc: PixelDocument, layerId: string): number {
  return doc.layers.findIndex((l) => l.id === layerId)
}

export function findFrameIndex(doc: PixelDocument, frameId: string): number {
  return doc.frames.findIndex((f) => f.id === frameId)
}

/** Nom libre du type « Calque N » qui n'est pas déjà utilisé. */
export function nextLayerName(doc: PixelDocument): string {
  const used = new Set(doc.layers.map((l) => l.name))
  let n = doc.layers.length + 1
  while (used.has(`Calque ${n}`)) n++
  return `Calque ${n}`
}

/**
 * Vérifie les invariants du modèle. Lève une erreur décrivant le premier problème trouvé.
 * Utilisé après le chargement d'un fichier et dans les tests.
 */
export function assertDocumentValid(doc: PixelDocument): void {
  if (!isValidDimension(doc.width) || !isValidDimension(doc.height)) throw new Error('Dimensions du document invalides')
  if (doc.frames.length < 1) throw new Error('Le document doit contenir au moins une image')
  if (doc.layers.length < 1) throw new Error('Le document doit contenir au moins un calque')
  const ids = new Set<string>()
  for (const f of doc.frames) {
    if (ids.has(f.id)) throw new Error(`Identifiant d'image dupliqué : ${f.id}`)
    ids.add(f.id)
  }
  for (const l of doc.layers) {
    if (ids.has(l.id)) throw new Error(`Identifiant de calque dupliqué : ${l.id}`)
    ids.add(l.id)
    if (l.cels.length !== doc.frames.length) throw new Error(`Le calque « ${l.name} » n'a pas une cellule par image`)
    for (const cel of l.cels) {
      if (cel.width !== doc.width || cel.height !== doc.height || cel.data.length !== doc.width * doc.height * 4) {
        throw new Error(`Cellule de taille incorrecte dans le calque « ${l.name} »`)
      }
    }
    if (!(l.opacity >= 0 && l.opacity <= 1)) throw new Error(`Opacité invalide pour le calque « ${l.name} »`)
  }
}
