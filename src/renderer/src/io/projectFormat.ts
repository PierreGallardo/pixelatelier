import { isEmpty, type Bitmap } from '../model/bitmap'
import { parseHex, toHex, type RGBA } from '../model/color'
import {
  assertDocumentValid,
  clampFps,
  isValidDimension,
  MAX_DIMENSION,
  newId,
  type Frame,
  type Layer,
  type PixelDocument
} from '../model/document'
import { MAX_PALETTE_SIZE } from '../model/palette'
import { base64ToBytes, bytesToBase64, zlibCompress, zlibDecompress } from './binary'

/**
 * Format de projet natif `.pixatelier` (JSON UTF-8).
 *
 * ```jsonc
 * {
 *   "format": "pixelatelier-project",
 *   "version": 1,
 *   "width": 32, "height": 32, "fps": 8,
 *   "palette": ["#rrggbbaa", ...],
 *   "frames": [{ "id": "..." }],
 *   // Calques du bas vers le haut ; une cellule par image :
 *   // base64 des pixels RGBA compressés en zlib, ou null si la cellule est vide.
 *   "layers": [{ "id": "...", "name": "...", "visible": true, "opacity": 1, "cels": ["eJz...", null] }]
 * }
 * ```
 *
 * Le numéro `version` augmente à chaque changement incompatible. Un fichier plus
 * récent que `PROJECT_FORMAT_VERSION` est refusé avec un message explicite ; un
 * fichier plus ancien passe par `migrate()`.
 */
export const PROJECT_FORMAT_ID = 'pixelatelier-project'
export const PROJECT_FORMAT_VERSION = 1
export const PROJECT_EXTENSION = 'pixatelier'

export class ProjectFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectFormatError'
  }
}

interface ProjectFileV1 {
  format: typeof PROJECT_FORMAT_ID
  version: 1
  app?: string
  width: number
  height: number
  fps: number
  palette: string[]
  frames: { id: string }[]
  layers: { id: string; name: string; visible: boolean; opacity: number; cels: (string | null)[] }[]
}

async function encodeCel(cel: Bitmap): Promise<string | null> {
  if (isEmpty(cel)) return null
  return bytesToBase64(await zlibCompress(cel.data))
}

export async function serializeProject(doc: PixelDocument, appName = 'Pixelatelier'): Promise<string> {
  assertDocumentValid(doc)
  const layers: ProjectFileV1['layers'] = []
  for (const l of doc.layers) {
    const cels: (string | null)[] = []
    for (const cel of l.cels) cels.push(await encodeCel(cel))
    layers.push({ id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, cels })
  }
  const file: ProjectFileV1 = {
    format: PROJECT_FORMAT_ID,
    version: PROJECT_FORMAT_VERSION,
    app: appName,
    width: doc.width,
    height: doc.height,
    fps: doc.fps,
    palette: doc.palette.map((c) => toHex(c, 'always')),
    frames: doc.frames.map((f) => ({ id: f.id })),
    layers
  }
  return JSON.stringify(file)
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Point d'entrée des migrations : convertit un fichier ancien vers la version courante. */
function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  const version = raw.version
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ProjectFormatError('Numéro de version du fichier manquant ou invalide.')
  }
  if (version > PROJECT_FORMAT_VERSION) {
    throw new ProjectFormatError(
      `Ce fichier utilise le format v${version}, plus récent que celui pris en charge (v${PROJECT_FORMAT_VERSION}). Mettez Pixelatelier à jour pour l'ouvrir.`
    )
  }
  // Version 1 = version courante : aucune migration n'est encore nécessaire.
  return raw
}

export async function parseProject(text: string): Promise<PixelDocument> {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new ProjectFormatError("Le fichier n'est pas un projet Pixelatelier valide (JSON illisible).")
  }
  if (!isObject(raw) || raw.format !== PROJECT_FORMAT_ID) {
    throw new ProjectFormatError("Le fichier n'est pas un projet Pixelatelier.")
  }
  const data = migrate(raw)

  const width = data.width
  const height = data.height
  if (typeof width !== 'number' || typeof height !== 'number' || !isValidDimension(width) || !isValidDimension(height)) {
    throw new ProjectFormatError(`Dimensions invalides (1 à ${MAX_DIMENSION} pixels attendus).`)
  }
  const fps = clampFps(typeof data.fps === 'number' ? data.fps : 8)

  const palette: RGBA[] = []
  if (Array.isArray(data.palette)) {
    for (const entry of data.palette.slice(0, MAX_PALETTE_SIZE)) {
      const c = typeof entry === 'string' ? parseHex(entry) : null
      if (c) palette.push(c)
    }
  }

  if (!Array.isArray(data.frames) || data.frames.length === 0) {
    throw new ProjectFormatError('Le projet ne contient aucune image d’animation.')
  }
  const usedIds = new Set<string>()
  const uniqueId = (candidate: unknown, prefix: string): string => {
    const id = typeof candidate === 'string' && candidate.length > 0 && !usedIds.has(candidate) ? candidate : newId(prefix)
    usedIds.add(id)
    return id
  }
  const frames: Frame[] = data.frames.map((f) => ({ id: uniqueId(isObject(f) ? f.id : null, 'frame') }))

  if (!Array.isArray(data.layers) || data.layers.length === 0) {
    throw new ProjectFormatError('Le projet ne contient aucun calque.')
  }
  const expectedBytes = width * height * 4
  const layers: Layer[] = []
  for (const [li, rawLayer] of data.layers.entries()) {
    if (!isObject(rawLayer)) throw new ProjectFormatError(`Calque n°${li + 1} invalide.`)
    const rawCels = rawLayer.cels
    if (!Array.isArray(rawCels) || rawCels.length !== frames.length) {
      throw new ProjectFormatError(`Le calque n°${li + 1} n'a pas une cellule par image.`)
    }
    const cels: Bitmap[] = []
    for (const [fi, rawCel] of rawCels.entries()) {
      if (rawCel === null) {
        cels.push({ width, height, data: new Uint8ClampedArray(expectedBytes) })
        continue
      }
      if (typeof rawCel !== 'string') throw new ProjectFormatError(`Cellule ${li + 1}/${fi + 1} invalide.`)
      let bytes: Uint8Array
      try {
        bytes = await zlibDecompress(base64ToBytes(rawCel))
      } catch {
        throw new ProjectFormatError(`Cellule ${li + 1}/${fi + 1} corrompue (décompression impossible).`)
      }
      if (bytes.length !== expectedBytes) {
        throw new ProjectFormatError(`Cellule ${li + 1}/${fi + 1} de taille incorrecte.`)
      }
      cels.push({ width, height, data: new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength) })
    }
    const opacity = typeof rawLayer.opacity === 'number' && Number.isFinite(rawLayer.opacity) ? rawLayer.opacity : 1
    layers.push({
      id: uniqueId(rawLayer.id, 'layer'),
      name: typeof rawLayer.name === 'string' && rawLayer.name.trim() ? rawLayer.name.slice(0, 100) : `Calque ${li + 1}`,
      visible: rawLayer.visible !== false,
      opacity: Math.min(1, Math.max(0, opacity)),
      cels
    })
  }

  const doc: PixelDocument = { width, height, fps, frames, layers, palette }
  try {
    assertDocumentValid(doc)
  } catch (e) {
    throw new ProjectFormatError(`Projet incohérent : ${(e as Error).message}`)
  }
  return doc
}
