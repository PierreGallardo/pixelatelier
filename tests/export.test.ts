import { describe, expect, it } from 'vitest'
import { createBitmap, setPixel } from '../src/renderer/src/model/bitmap'
import { createDocument } from '../src/renderer/src/model/document'
import { encodePng } from '../src/renderer/src/export/png'
import { encodeGif, lzwEncode } from '../src/renderer/src/export/gif'
import { buildSpritesheet, exportAnimationGif, exportFramePng, exportSpritesheetPng } from '../src/renderer/src/export/exporters'
import { BLUE, GREEN, RED, decodeGif, decodePng } from './helpers'

function animatedDoc() {
  const doc = createDocument({ width: 4, height: 3, fps: 10 })
  for (let f = 1; f < 3; f++) {
    doc.frames.push({ id: `f${f}` })
    doc.layers[0].cels.push(createBitmap(4, 3))
  }
  setPixel(doc.layers[0].cels[0], 0, 0, RED)
  setPixel(doc.layers[0].cels[1], 1, 1, GREEN)
  setPixel(doc.layers[0].cels[2], 3, 2, BLUE)
  return doc
}

describe('export PNG', () => {
  it('produit un PNG valide contenant exactement les pixels', async () => {
    const data = new Uint8ClampedArray(3 * 2 * 4)
    data.set([255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 0, 0, 1, 2, 3, 4, 250, 251, 252, 253, 9, 9, 9, 255])
    const png = await encodePng(3, 2, data)
    const decoded = decodePng(png)
    expect(decoded.chunks).toEqual(['IHDR', 'IDAT', 'IEND'])
    expect(decoded.width).toBe(3)
    expect(decoded.height).toBe(2)
    expect([...decoded.data]).toEqual([...data])
  })

  it('exporte l’image courante composée, avec agrandissement sans lissage', async () => {
    const doc = animatedDoc()
    const png = decodePng(await exportFramePng(doc, 1, 3))
    expect(png.width).toBe(12)
    expect(png.height).toBe(9)
    const at = (x: number, y: number) => [...png.data.subarray((y * 12 + x) * 4, (y * 12 + x) * 4 + 4)]
    for (let y = 3; y < 6; y++) for (let x = 3; x < 6; x++) expect(at(x, y)).toEqual([0, 255, 0, 255])
    expect(at(2, 3)[3]).toBe(0)
    expect(at(6, 6)[3]).toBe(0)
  })
})

describe('export GIF', () => {
  it('produit un GIF animé décodable avec transparence, durée et boucle', () => {
    const doc = animatedDoc()
    const gif = decodeGif(exportAnimationGif(doc))
    expect(gif.width).toBe(4)
    expect(gif.height).toBe(3)
    expect(gif.loop).toBe(0)
    expect(gif.frames).toHaveLength(3)
    const colorAt = (f: number, x: number, y: number) => {
      const frame = gif.frames[f]
      const idx = frame.indices[y * 4 + x]
      return idx === frame.transparentIndex ? null : gif.palette[idx]
    }
    expect(colorAt(0, 0, 0)).toBe(0xff0000)
    expect(colorAt(0, 1, 1)).toBeNull()
    expect(colorAt(1, 1, 1)).toBe(0x00ff00)
    expect(colorAt(2, 3, 2)).toBe(0x0000ff)
    for (const f of gif.frames) {
      expect(f.delayCs).toBe(10) // 10 images/s
      expect(f.disposal).toBe(2)
    }
  })

  it('encode correctement le LZW sur de grandes images (réinitialisation du dictionnaire)', () => {
    // Bruit pseudo-aléatoire sur 200 couleurs : force des codes de 12 bits et des codes « clear ».
    const w = 300
    const h = 200
    const data = new Uint8ClampedArray(w * h * 4)
    let seed = 12345
    for (let i = 0; i < w * h; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const v = seed % 200
      data.set([v, (v * 7) % 256, (v * 13) % 256, 255], i * 4)
    }
    const gif = decodeGif(encodeGif(w, h, [{ data, durationMs: 100 }]))
    const frame = gif.frames[0]
    for (let i = 0; i < w * h; i += 997) {
      const c = gif.palette[frame.indices[i]]
      expect(c).toBe((data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2])
    }
  })

  it('réduit la palette au-delà de 256 couleurs', () => {
    const w = 64
    const h = 64
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) data.set([i % 64 * 4, Math.floor(i / 64) * 4, (i * 3) % 256, 255], i * 4)
    const gif = decodeGif(encodeGif(w, h, [{ data, durationMs: 50 }]))
    expect(gif.palette.length).toBe(256)
    expect(gif.frames[0].indices.length).toBe(w * h)
  })

  it('lzwEncode gère les cas limites (un seul pixel)', () => {
    const single = lzwEncode(new Uint8Array([1]), 2)
    expect(single.length).toBeGreaterThan(0)
    const gif = decodeGif(encodeGif(1, 1, [{ data: new Uint8ClampedArray([1, 2, 3, 255]), durationMs: 100 }]))
    expect(gif.palette[gif.frames[0].indices[0]]).toBe(0x010203)
  })
})

describe('planche de sprites', () => {
  it('dispose les images horizontalement, verticalement ou en grille', () => {
    const doc = animatedDoc()
    const h = buildSpritesheet(doc, { layout: 'horizontal' })
    expect([h.width, h.height]).toEqual([12, 3])
    const v = buildSpritesheet(doc, { layout: 'vertical', padding: 1 })
    expect([v.width, v.height]).toEqual([4, 11])
    const g = buildSpritesheet(doc, { layout: 'grid', columns: 2, scale: 2 })
    expect([g.width, g.height]).toEqual([16, 12])
    expect(g.frames[2]).toEqual({ index: 2, x: 0, y: 6, w: 8, h: 6 })
  })

  it('place chaque image au bon endroit dans le PNG', async () => {
    const doc = animatedDoc()
    const { png } = await exportSpritesheetPng(doc, { layout: 'horizontal', padding: 2 })
    const decoded = decodePng(png)
    expect(decoded.width).toBe(4 * 3 + 2 * 2)
    const at = (x: number, y: number) => [...decoded.data.subarray((y * decoded.width + x) * 4, (y * decoded.width + x) * 4 + 4)]
    expect(at(0, 0)).toEqual([255, 0, 0, 255])
    expect(at(6 + 1, 1)).toEqual([0, 255, 0, 255])
    expect(at(12 + 3, 2)).toEqual([0, 0, 255, 255])
  })
})
