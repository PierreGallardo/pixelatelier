import { scaleNearest, type Bitmap } from '../model/bitmap'
import { composeFrame } from '../model/compose'
import type { PixelDocument } from '../model/document'
import { encodeGif } from './gif'
import { encodePng } from './png'

/**
 * Fonctions d'export de haut niveau : elles composent les calques visibles
 * puis appellent les encodeurs. Aucune ne dépend du DOM.
 */

export const MAX_EXPORT_SCALE = 32

function composeScaled(doc: PixelDocument, frameIndex: number, scale: number): Bitmap {
  const data = composeFrame(doc, frameIndex)
  const bmp: Bitmap = { width: doc.width, height: doc.height, data }
  return scale === 1 ? bmp : scaleNearest(bmp, doc.width * scale, doc.height * scale)
}

function checkScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < 1 || scale > MAX_EXPORT_SCALE) {
    throw new RangeError(`Échelle d'export invalide : ${scale}`)
  }
}

/** PNG de l'image d'animation `frameIndex` (calques visibles composés). */
export async function exportFramePng(doc: PixelDocument, frameIndex: number, scale = 1): Promise<Uint8Array<ArrayBuffer>> {
  checkScale(scale)
  const bmp = composeScaled(doc, frameIndex, scale)
  return encodePng(bmp.width, bmp.height, bmp.data)
}

export interface GifExportOptions {
  scale?: number
  /** Première et dernière image incluses (par défaut : toutes). */
  fromFrame?: number
  toFrame?: number
}

export function exportAnimationGif(doc: PixelDocument, opts: GifExportOptions = {}): Uint8Array<ArrayBuffer> {
  const scale = opts.scale ?? 1
  checkScale(scale)
  const from = Math.max(0, opts.fromFrame ?? 0)
  const to = Math.min(doc.frames.length - 1, opts.toFrame ?? doc.frames.length - 1)
  if (to < from) throw new RangeError('Plage d’images vide')
  const durationMs = 1000 / doc.fps
  const frames = []
  for (let f = from; f <= to; f++) frames.push({ data: composeScaled(doc, f, scale).data, durationMs })
  return encodeGif(doc.width * scale, doc.height * scale, frames)
}

export type SheetLayout = 'horizontal' | 'vertical' | 'grid'

export interface SpritesheetOptions {
  layout: SheetLayout
  /** Nombre de colonnes pour la disposition en grille. */
  columns?: number
  /** Espace (en pixels de sortie) entre les images. */
  padding?: number
  scale?: number
}

export interface SheetFrameRect {
  index: number
  x: number
  y: number
  w: number
  h: number
}

export interface Spritesheet {
  width: number
  height: number
  data: Uint8ClampedArray
  frames: SheetFrameRect[]
  columns: number
  rows: number
}

export function sheetGrid(frameCount: number, opts: SpritesheetOptions): { columns: number; rows: number } {
  if (opts.layout === 'horizontal') return { columns: frameCount, rows: 1 }
  if (opts.layout === 'vertical') return { columns: 1, rows: frameCount }
  const columns = Math.max(1, Math.min(frameCount, Math.floor(opts.columns ?? Math.ceil(Math.sqrt(frameCount)))))
  return { columns, rows: Math.ceil(frameCount / columns) }
}

export function buildSpritesheet(doc: PixelDocument, opts: SpritesheetOptions): Spritesheet {
  const scale = opts.scale ?? 1
  checkScale(scale)
  const padding = Math.max(0, Math.floor(opts.padding ?? 0))
  const fw = doc.width * scale
  const fh = doc.height * scale
  const { columns, rows } = sheetGrid(doc.frames.length, opts)
  const width = columns * fw + (columns - 1) * padding
  const height = rows * fh + (rows - 1) * padding
  const data = new Uint8ClampedArray(width * height * 4)
  const frames: SheetFrameRect[] = []
  for (let f = 0; f < doc.frames.length; f++) {
    const col = f % columns
    const row = Math.floor(f / columns)
    const x = col * (fw + padding)
    const y = row * (fh + padding)
    const bmp = composeScaled(doc, f, scale)
    for (let yy = 0; yy < fh; yy++) {
      data.set(bmp.data.subarray(yy * fw * 4, (yy + 1) * fw * 4), ((y + yy) * width + x) * 4)
    }
    frames.push({ index: f, x, y, w: fw, h: fh })
  }
  return { width, height, data, frames, columns, rows }
}

/** Métadonnées JSON décrivant la planche (positions des images, durée). */
export function spritesheetMetadata(doc: PixelDocument, sheet: Spritesheet, imageName: string, scale: number): string {
  return JSON.stringify(
    {
      generator: 'Pixelatelier',
      image: imageName,
      size: { w: sheet.width, h: sheet.height },
      frameSize: { w: doc.width * scale, h: doc.height * scale },
      scale,
      fps: doc.fps,
      frames: sheet.frames.map((r) => ({ ...r, durationMs: Math.round(1000 / doc.fps) }))
    },
    null,
    2
  )
}

export async function exportSpritesheetPng(doc: PixelDocument, opts: SpritesheetOptions): Promise<{ png: Uint8Array<ArrayBuffer>; sheet: Spritesheet }> {
  const sheet = buildSpritesheet(doc, opts)
  return { png: await encodePng(sheet.width, sheet.height, sheet.data), sheet }
}
