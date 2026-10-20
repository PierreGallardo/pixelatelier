import { describe, expect, it } from 'vitest'
import { createBitmap, setPixel } from '../src/renderer/src/model/bitmap'
import { composeFrame, composePixel } from '../src/renderer/src/model/compose'
import { BLUE, RED, makeDoc } from './helpers'

function twoLayerDoc() {
  const doc = makeDoc(4, 4)
  doc.layers.push({ id: 'top', name: 'Haut', visible: true, opacity: 1, cels: [createBitmap(4, 4)] })
  return doc
}

describe('composition des calques', () => {
  it('un document vide donne une image transparente', () => {
    const out = composeFrame(makeDoc(3, 3), 0)
    expect(out.every((v) => v === 0)).toBe(true)
  })

  it('le calque supérieur opaque recouvre le calque inférieur', () => {
    const doc = twoLayerDoc()
    setPixel(doc.layers[0].cels[0], 1, 1, RED)
    setPixel(doc.layers[1].cels[0], 1, 1, BLUE)
    setPixel(doc.layers[0].cels[0], 2, 2, RED)
    expect(composePixel(doc, 0, 1, 1)).toEqual(BLUE)
    expect(composePixel(doc, 0, 2, 2)).toEqual(RED)
    const out = composeFrame(doc, 0)
    const i = (1 * 4 + 1) * 4
    expect([...out.subarray(i, i + 4)]).toEqual([0, 0, 255, 255])
  })

  it('ignore les calques masqués', () => {
    const doc = twoLayerDoc()
    setPixel(doc.layers[0].cels[0], 0, 0, RED)
    setPixel(doc.layers[1].cels[0], 0, 0, BLUE)
    doc.layers[1].visible = false
    expect(composePixel(doc, 0, 0, 0)).toEqual(RED)
    expect(composeFrame(doc, 0, { includeHidden: true }).subarray(0, 4)).toEqual(new Uint8ClampedArray([0, 0, 255, 255]))
  })

  it("applique l'opacité du calque", () => {
    const doc = twoLayerDoc()
    setPixel(doc.layers[0].cels[0], 0, 0, RED)
    setPixel(doc.layers[1].cels[0], 0, 0, BLUE)
    doc.layers[1].opacity = 0.5
    const c = composePixel(doc, 0, 0, 0)
    expect(c.a).toBe(255)
    expect(c.r).toBeGreaterThanOrEqual(127)
    expect(c.r).toBeLessThanOrEqual(128)
    expect(c.b).toBeGreaterThanOrEqual(127)
    expect(c.b).toBeLessThanOrEqual(128)

    // Sur du transparent, l'opacité devient l'alpha du résultat sans changer la teinte.
    setPixel(doc.layers[1].cels[0], 3, 3, BLUE)
    const lone = composePixel(doc, 0, 3, 3)
    expect(lone.b).toBe(255)
    expect(lone.a).toBeGreaterThanOrEqual(127)
    expect(lone.a).toBeLessThanOrEqual(128)
  })

  it('mélange correctement deux couleurs semi-transparentes (source-over)', () => {
    const doc = twoLayerDoc()
    setPixel(doc.layers[0].cels[0], 0, 0, { r: 255, g: 0, b: 0, a: 128 })
    setPixel(doc.layers[1].cels[0], 0, 0, { r: 0, g: 0, b: 255, a: 128 })
    const c = composePixel(doc, 0, 0, 0)
    // αo = 0.502 + 0.502 × 0.498 ≈ 0.752
    expect(c.a).toBeGreaterThanOrEqual(191)
    expect(c.a).toBeLessThanOrEqual(192)
    // Le bleu (dessus) domine : 0.502 / 0.752 ≈ 0.667
    expect(c.b).toBeGreaterThanOrEqual(169)
    expect(c.b).toBeLessThanOrEqual(171)
    expect(c.r + c.b).toBeGreaterThanOrEqual(254)
  })

  it('ne recalcule que la zone demandée', () => {
    const doc = twoLayerDoc()
    setPixel(doc.layers[0].cels[0], 0, 0, RED)
    setPixel(doc.layers[0].cels[0], 3, 3, RED)
    const out = new Uint8ClampedArray(4 * 4 * 4).fill(7)
    composeFrame(doc, 0, { out, rect: { x: 0, y: 0, w: 2, h: 2 } })
    expect([...out.subarray(0, 4)]).toEqual([255, 0, 0, 255])
    expect(out[(3 * 4 + 3) * 4]).toBe(7)
  })

  it('compose l’image d’animation demandée', () => {
    const doc = makeDoc(2, 2)
    doc.frames.push({ id: 'f2' })
    doc.layers[0].cels.push(createBitmap(2, 2))
    setPixel(doc.layers[0].cels[1], 1, 1, RED)
    expect(composePixel(doc, 0, 1, 1).a).toBe(0)
    expect(composePixel(doc, 1, 1, 1)).toEqual(RED)
  })
})
