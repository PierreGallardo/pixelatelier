import { describe, expect, it } from 'vitest'
import { createBitmap, getPixel } from '../src/renderer/src/model/bitmap'
import { floodFill } from '../src/renderer/src/raster/fill'
import { plotRect } from '../src/renderer/src/raster/shapes'
import { setPixel } from '../src/renderer/src/model/bitmap'
import { BLUE, GREEN, RED, opaqueSet } from './helpers'

describe('pot de peinture', () => {
  it('remplit une image vide entièrement', () => {
    const bmp = createBitmap(5, 4)
    const rect = floodFill(bmp, 2, 2, RED)
    expect(rect).toEqual({ x: 0, y: 0, w: 5, h: 4 })
    expect(opaqueSet(bmp).size).toBe(20)
  })

  it('respecte les bords (4-voisinage) et ne déborde pas par les diagonales', () => {
    const bmp = createBitmap(7, 7)
    plotRect(1, 1, 5, 5, false, (x, y) => setPixel(bmp, x, y, BLUE))
    floodFill(bmp, 3, 3, RED)
    expect(getPixel(bmp, 3, 3)).toEqual(RED)
    expect(getPixel(bmp, 2, 2)).toEqual(RED)
    expect(getPixel(bmp, 1, 1)).toEqual(BLUE)
    expect(getPixel(bmp, 0, 0).a).toBe(0)

    // Une diagonale de pixels bloque le remplissage en 4-voisinage.
    const diag = createBitmap(4, 4)
    for (let i = 0; i < 4; i++) setPixel(diag, i, 3 - i, BLUE)
    floodFill(diag, 0, 0, RED)
    expect(getPixel(diag, 3, 3).a).toBe(0)
    expect(getPixel(diag, 0, 0)).toEqual(RED)
  })

  it('remplit des formes concaves (serpentin qui repart vers la gauche)', () => {
    // y0 : . . . . . . .
    // y1 : B B B B B B .
    // y2 : . . . . . . .
    // y3 : . B B B B B B
    // y4 : . . . . . . .
    const bmp = createBitmap(7, 5)
    for (let x = 0; x < 6; x++) setPixel(bmp, x, 1, BLUE)
    for (let x = 1; x < 7; x++) setPixel(bmp, x, 3, BLUE)
    floodFill(bmp, 0, 0, RED)
    expect(getPixel(bmp, 0, 2)).toEqual(RED)
    expect(getPixel(bmp, 0, 4)).toEqual(RED)
    expect(getPixel(bmp, 6, 4)).toEqual(RED)
    let red = 0
    for (let i = 0; i < bmp.data.length; i += 4) if (bmp.data[i] === 255 && bmp.data[i + 3] === 255) red++
    expect(red).toBe(35 - 12)
  })

  it('ne fait rien si la couleur est déjà celle de la zone', () => {
    const bmp = createBitmap(3, 3)
    floodFill(bmp, 0, 0, GREEN)
    expect(floodFill(bmp, 1, 1, GREEN)).toBeNull()
    expect(floodFill(bmp, 5, 5, RED)).toBeNull()
  })

  it('traite tous les pixels transparents comme une seule couleur', () => {
    const bmp = createBitmap(3, 1)
    setPixel(bmp, 1, 0, { r: 200, g: 10, b: 10, a: 0 })
    floodFill(bmp, 0, 0, RED)
    expect(opaqueSet(bmp).size).toBe(3)
  })

  it('mode non contigu : remplace toutes les occurrences', () => {
    const bmp = createBitmap(5, 1)
    setPixel(bmp, 0, 0, BLUE)
    setPixel(bmp, 4, 0, BLUE)
    setPixel(bmp, 2, 0, GREEN)
    const rect = floodFill(bmp, 0, 0, RED, { contiguous: false })
    expect(rect).toEqual({ x: 0, y: 0, w: 5, h: 1 })
    expect(getPixel(bmp, 4, 0)).toEqual(RED)
    expect(getPixel(bmp, 2, 0)).toEqual(GREEN)
  })

  it('gère une grande image sans récursion (pas de dépassement de pile)', () => {
    const bmp = createBitmap(2048, 2048)
    // Labyrinthe de colonnes pour multiplier les segments.
    for (let x = 1; x < 2048; x += 2) {
      for (let y = x % 4 === 1 ? 0 : 1; y < (x % 4 === 1 ? 2047 : 2048); y++) setPixel(bmp, x, y, BLUE)
    }
    const rect = floodFill(bmp, 0, 0, RED)
    expect(rect).not.toBeNull()
    expect(getPixel(bmp, 2046, 2047)).toEqual(RED)
  })
})
