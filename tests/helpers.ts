import { inflateSync } from 'node:zlib'
import { createDocument, type PixelDocument } from '../src/renderer/src/model/document'
import { setPixel, type Bitmap } from '../src/renderer/src/model/bitmap'
import type { RGBA } from '../src/renderer/src/model/color'

export const RED: RGBA = { r: 255, g: 0, b: 0, a: 255 }
export const GREEN: RGBA = { r: 0, g: 255, b: 0, a: 255 }
export const BLUE: RGBA = { r: 0, g: 0, b: 255, a: 255 }

export function px(bmp: Bitmap, x: number, y: number): [number, number, number, number] {
  const i = (y * bmp.width + x) * 4
  return [bmp.data[i], bmp.data[i + 1], bmp.data[i + 2], bmp.data[i + 3]]
}

export function makeDoc(width = 8, height = 8): PixelDocument {
  return createDocument({ width, height })
}

/** Ensemble « x,y » des pixels opaques d'un bitmap. */
export function opaqueSet(bmp: Bitmap): Set<string> {
  const s = new Set<string>()
  for (let y = 0; y < bmp.height; y++) for (let x = 0; x < bmp.width; x++) if (bmp.data[(y * bmp.width + x) * 4 + 3] > 0) s.add(`${x},${y}`)
  return s
}

export function paint(bmp: Bitmap, points: [number, number][], c: RGBA): void {
  for (const [x, y] of points) setPixel(bmp, x, y, c)
}

/* ------------------------- Décodeur PNG (tests) ------------------------- */

export interface DecodedPng {
  width: number
  height: number
  data: Uint8Array
  chunks: string[]
}

/** Décode un PNG RGBA 8 bits non entrelacé (filtres 0 à 4) pour vérifier l'encodeur. */
export function decodePng(bytes: Uint8Array): DecodedPng {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  sig.forEach((b, i) => {
    if (bytes[i] !== b) throw new Error('Signature PNG invalide')
  })
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let off = 8
  let width = 0
  let height = 0
  const idat: Uint8Array[] = []
  const chunks: string[] = []
  while (off < bytes.length) {
    const len = view.getUint32(off)
    const type = String.fromCharCode(...bytes.subarray(off + 4, off + 8))
    const payload = bytes.subarray(off + 8, off + 8 + len)
    chunks.push(type)
    if (type === 'IHDR') {
      width = view.getUint32(off + 8)
      height = view.getUint32(off + 12)
      if (payload[8] !== 8 || payload[9] !== 6) throw new Error('Format PNG non pris en charge par le décodeur de test')
    } else if (type === 'IDAT') idat.push(payload)
    off += 12 + len
  }
  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * 4
  const out = new Uint8Array(stride * height)
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    if (filter !== 0) throw new Error(`Filtre ${filter} inattendu`)
    out.set(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), y * stride)
  }
  return { width, height, data: out, chunks }
}

/* ------------------------- Décodeur GIF (tests) ------------------------- */

export interface DecodedGifFrame {
  indices: Uint8Array
  delayCs: number
  disposal: number
  transparentIndex: number | null
}

export interface DecodedGif {
  width: number
  height: number
  palette: number[]
  loop: number | null
  frames: DecodedGifFrame[]
}

function lzwDecode(data: Uint8Array, minCodeSize: number, pixelCount: number): Uint8Array {
  const clear = 1 << minCodeSize
  const eoi = clear + 1
  let codeSize = minCodeSize + 1
  let next = eoi + 1
  let table: number[][] = []
  const reset = (): void => {
    table = []
    for (let i = 0; i < clear; i++) table[i] = [i]
    table[clear] = []
    table[eoi] = []
    codeSize = minCodeSize + 1
    next = eoi + 1
  }
  reset()
  const out: number[] = []
  let bitPos = 0
  const read = (): number | null => {
    if (bitPos + codeSize > data.length * 8) return null
    let code = 0
    for (let i = 0; i < codeSize; i++) {
      const bit = (data[(bitPos + i) >> 3] >> ((bitPos + i) & 7)) & 1
      code |= bit << i
    }
    bitPos += codeSize
    return code
  }
  let prev: number[] | null = null
  for (;;) {
    const code = read()
    if (code === null) throw new Error('Flux LZW tronqué (pas de code de fin)')
    if (code === clear) {
      reset()
      prev = null
      continue
    }
    if (code === eoi) break
    let entry: number[]
    if (code < next && table[code]) entry = table[code]
    else if (code === next && prev) entry = [...prev, prev[0]]
    else throw new Error(`Code LZW invalide : ${code} (suivant attendu ${next})`)
    out.push(...entry)
    if (prev && next < 4096) {
      table[next++] = [...prev, entry[0]]
      if (next === 1 << codeSize && codeSize < 12) codeSize++
    }
    prev = entry
  }
  if (out.length !== pixelCount) throw new Error(`Nombre de pixels décodés ${out.length} ≠ ${pixelCount}`)
  return Uint8Array.from(out)
}

export function decodeGif(bytes: Uint8Array): DecodedGif {
  const header = String.fromCharCode(...bytes.subarray(0, 6))
  if (header !== 'GIF89a') throw new Error(`En-tête GIF invalide : ${header}`)
  const u16 = (o: number): number => bytes[o] | (bytes[o + 1] << 8)
  const width = u16(6)
  const height = u16(8)
  const packed = bytes[10]
  let off = 13
  const palette: number[] = []
  if (packed & 0x80) {
    const size = 1 << ((packed & 7) + 1)
    for (let i = 0; i < size; i++) palette.push((bytes[off + i * 3] << 16) | (bytes[off + i * 3 + 1] << 8) | bytes[off + i * 3 + 2])
    off += size * 3
  }
  const frames: DecodedGifFrame[] = []
  let loop: number | null = null
  let gce = { delayCs: 0, disposal: 0, transparentIndex: null as number | null }
  const readSubBlocks = (): Uint8Array => {
    const parts: number[] = []
    for (;;) {
      const n = bytes[off++]
      if (n === 0) break
      for (let i = 0; i < n; i++) parts.push(bytes[off + i])
      off += n
    }
    return Uint8Array.from(parts)
  }
  for (;;) {
    const b = bytes[off++]
    if (b === 0x3b) break
    if (b === 0x21) {
      const label = bytes[off++]
      if (label === 0xf9) {
        const blk = readSubBlocks()
        gce = { disposal: (blk[0] >> 2) & 7, delayCs: blk[1] | (blk[2] << 8), transparentIndex: blk[0] & 1 ? blk[3] : null }
      } else if (label === 0xff) {
        const size = bytes[off++]
        const app = String.fromCharCode(...bytes.subarray(off, off + size))
        off += size
        const blk = readSubBlocks()
        if (app === 'NETSCAPE2.0') loop = blk[1] | (blk[2] << 8)
      } else readSubBlocks()
    } else if (b === 0x2c) {
      const w = u16(off + 4)
      const h = u16(off + 6)
      const p = bytes[off + 8]
      off += 9
      if (p & 0x80) off += (1 << ((p & 7) + 1)) * 3
      const minCode = bytes[off++]
      const data = readSubBlocks()
      frames.push({ indices: lzwDecode(data, minCode, w * h), ...gce })
      gce = { delayCs: 0, disposal: 0, transparentIndex: null }
    } else throw new Error(`Bloc GIF inconnu 0x${b.toString(16)} à l'octet ${off - 1}`)
  }
  return { width, height, palette, loop, frames }
}
