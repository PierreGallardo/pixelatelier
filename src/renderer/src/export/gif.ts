import { medianCut, nearestIndex } from './quantize'

/**
 * Encodeur GIF89a animé écrit pour Pixelatelier (aucune dépendance).
 *
 * - Palette globale exacte si l'animation utilise au plus 256 couleurs
 *   (255 s'il y a de la transparence), sinon réduction par median cut.
 * - Transparence binaire : un pixel dont l'alpha est < 128 devient transparent,
 *   les autres sont opaques (le GIF ne gère pas l'alpha partiel).
 * - Boucle infinie via l'extension NETSCAPE2.0.
 */

export interface GifFrame {
  /** Pixels RGBA de taille `width * height * 4`. */
  data: Uint8Array | Uint8ClampedArray
  /** Durée d'affichage en millisecondes. */
  durationMs: number
}

export interface GifOptions {
  /** Nombre de répétitions ; 0 = boucle infinie (par défaut). */
  loop?: number
}

export const GIF_ALPHA_THRESHOLD = 128

class ByteWriter {
  private buf = new Uint8Array(1024)
  length = 0

  private ensure(extra: number): void {
    if (this.length + extra <= this.buf.length) return
    let size = this.buf.length * 2
    while (size < this.length + extra) size *= 2
    const next = new Uint8Array(size)
    next.set(this.buf.subarray(0, this.length))
    this.buf = next
  }

  byte(b: number): void {
    this.ensure(1)
    this.buf[this.length++] = b & 0xff
  }

  u16(v: number): void {
    this.byte(v & 0xff)
    this.byte((v >> 8) & 0xff)
  }

  bytes(arr: ArrayLike<number>): void {
    this.ensure(arr.length)
    for (let i = 0; i < arr.length; i++) this.buf[this.length++] = arr[i]
  }

  ascii(s: string): void {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i))
  }

  result(): Uint8Array<ArrayBuffer> {
    return this.buf.slice(0, this.length)
  }
}

/**
 * Compression LZW à longueur de code variable telle que définie par la norme
 * GIF89a. Retourne le flux de codes (avant découpage en sous-blocs).
 */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clearCode = 1 << minCodeSize
  const eoiCode = clearCode + 1
  let codeSize = minCodeSize + 1
  let nextCode = eoiCode + 1
  const dict = new Map<number, number>()

  const out = new ByteWriter()
  let acc = 0
  let accBits = 0
  const write = (code: number): void => {
    acc |= code << accBits
    accBits += codeSize
    while (accBits >= 8) {
      out.byte(acc & 0xff)
      acc >>>= 8
      accBits -= 8
    }
  }

  write(clearCode)
  if (indices.length === 0) {
    write(eoiCode)
    if (accBits > 0) out.byte(acc & 0xff)
    return out.result()
  }

  let prefix = indices[0]
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const key = (prefix << 8) | k
    const found = dict.get(key)
    if (found !== undefined) {
      prefix = found
      continue
    }
    write(prefix)
    if (nextCode < 4096) {
      dict.set(key, nextCode++)
      // Le décodeur agrandit ses codes dès que son dictionnaire atteint 2^codeSize ;
      // il a toujours une entrée de retard sur l'encodeur.
      if (nextCode > 1 << codeSize && codeSize < 12) codeSize++
    } else {
      write(clearCode)
      dict.clear()
      codeSize = minCodeSize + 1
      nextCode = eoiCode + 1
    }
    prefix = k
  }
  write(prefix)
  if (nextCode >= 1 << codeSize && codeSize < 12) codeSize++
  write(eoiCode)
  if (accBits > 0) out.byte(acc & 0xff)
  return out.result()
}

interface PaletteResult {
  /** Couleurs 0xRRGGBB (sans l'entrée transparente). */
  colors: number[]
  /** Correspondance couleur → index. */
  lookup: (rgb: number) => number
  transparentIndex: number | null
}

function buildPalette(frames: GifFrame[]): PaletteResult {
  const histogram = new Map<number, number>()
  let hasTransparency = false
  for (const f of frames) {
    const d = f.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < GIF_ALPHA_THRESHOLD) {
        hasTransparency = true
        continue
      }
      const rgb = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]
      histogram.set(rgb, (histogram.get(rgb) ?? 0) + 1)
    }
  }
  const maxColors = hasTransparency ? 255 : 256
  const colors = histogram.size <= maxColors ? [...histogram.keys()] : medianCut(histogram, maxColors)
  if (colors.length === 0) colors.push(0)
  const exact = new Map<number, number>()
  colors.forEach((c, i) => {
    if (!exact.has(c)) exact.set(c, i)
  })
  const cache = new Map<number, number>()
  const lookup = (rgb: number): number => {
    const hit = exact.get(rgb) ?? cache.get(rgb)
    if (hit !== undefined) return hit
    const idx = nearestIndex(colors, rgb)
    cache.set(rgb, idx)
    return idx
  }
  return { colors, lookup, transparentIndex: hasTransparency ? colors.length : null }
}

export function encodeGif(width: number, height: number, frames: GifFrame[], opts: GifOptions = {}): Uint8Array<ArrayBuffer> {
  if (frames.length === 0) throw new RangeError('Aucune image à exporter')
  if (width < 1 || height < 1 || width > 65535 || height > 65535) throw new RangeError('Dimensions GIF invalides')
  for (const f of frames) if (f.data.length !== width * height * 4) throw new RangeError('Taille d’image GIF incorrecte')

  const palette = buildPalette(frames)
  const entries = palette.colors.length + (palette.transparentIndex !== null ? 1 : 0)
  let tableBits = 1
  while (1 << tableBits < entries) tableBits++
  const tableSize = 1 << tableBits
  const minCodeSize = Math.max(2, tableBits)

  const w = new ByteWriter()
  w.ascii('GIF89a')
  // Descripteur d'écran logique
  w.u16(width)
  w.u16(height)
  w.byte(0x80 | (0x07 << 4) | (tableBits - 1)) // table globale, 8 bits/canal, taille
  w.byte(palette.transparentIndex ?? 0) // couleur de fond
  w.byte(0) // rapport d'aspect
  // Table de couleurs globale
  for (let i = 0; i < tableSize; i++) {
    const c = i < palette.colors.length ? palette.colors[i] : 0
    w.byte((c >> 16) & 255)
    w.byte((c >> 8) & 255)
    w.byte(c & 255)
  }

  if (frames.length > 1) {
    w.bytes([0x21, 0xff, 0x0b])
    w.ascii('NETSCAPE2.0')
    w.bytes([0x03, 0x01])
    w.u16(opts.loop ?? 0)
    w.byte(0)
  }

  const indices = new Uint8Array(width * height)
  const transparent = palette.transparentIndex
  for (const frame of frames) {
    const d = frame.data
    for (let p = 0, i = 0; p < indices.length; p++, i += 4) {
      indices[p] = d[i + 3] < GIF_ALPHA_THRESHOLD ? (transparent ?? 0) : palette.lookup((d[i] << 16) | (d[i + 1] << 8) | d[i + 2])
    }

    // Extension de contrôle graphique : durée, transparence, méthode de disposition.
    // Disposition 2 (effacer) pour que les zones transparentes ne laissent pas voir l'image précédente.
    const disposal = transparent !== null ? 2 : 1
    w.bytes([0x21, 0xf9, 0x04, (disposal << 2) | (transparent !== null ? 1 : 0)])
    w.u16(Math.max(2, Math.round(frame.durationMs / 10)))
    w.byte(transparent ?? 0)
    w.byte(0)

    // Descripteur d'image (plein cadre, pas de table locale, non entrelacé)
    w.byte(0x2c)
    w.u16(0)
    w.u16(0)
    w.u16(width)
    w.u16(height)
    w.byte(0)

    w.byte(minCodeSize)
    const lzw = lzwEncode(indices, minCodeSize)
    for (let i = 0; i < lzw.length; i += 255) {
      const n = Math.min(255, lzw.length - i)
      w.byte(n)
      w.bytes(lzw.subarray(i, i + n))
    }
    w.byte(0) // fin des sous-blocs
  }

  w.byte(0x3b) // fin de fichier
  return w.result()
}
