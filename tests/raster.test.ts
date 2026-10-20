import { describe, expect, it } from 'vitest'
import { createBitmap, getPixel } from '../src/renderer/src/model/bitmap'
import { stampBrush, brushRect } from '../src/renderer/src/raster/brush'
import {
  constrainLine,
  constrainSquare,
  linePoints,
  plotEllipse,
  plotRect
} from '../src/renderer/src/raster/shapes'
import { RED } from './helpers'

function collect(fn: (plot: (x: number, y: number) => void) => void): Set<string> {
  const s = new Set<string>()
  fn((x, y) => s.add(`${x},${y}`))
  return s
}

describe('ligne de Bresenham', () => {
  it('trace un point unique', () => {
    expect(linePoints(3, 4, 3, 4)).toEqual([{ x: 3, y: 4 }])
  })

  it('trace des lignes horizontales, verticales et diagonales exactes', () => {
    expect(linePoints(0, 0, 4, 0).map((p) => p.x)).toEqual([0, 1, 2, 3, 4])
    expect(linePoints(2, 5, 2, 1).map((p) => p.y)).toEqual([5, 4, 3, 2, 1])
    expect(linePoints(0, 0, 3, 3)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 }
    ])
  })

  it('inclut les extrémités, est continue (8-connexe) et sans doublon dans tous les octants', () => {
    const ends: [number, number][] = [
      [7, 2],
      [2, 7],
      [-2, 7],
      [-7, 2],
      [-7, -2],
      [-2, -7],
      [2, -7],
      [7, -2],
      [13, 5]
    ]
    for (const [ex, ey] of ends) {
      const pts = linePoints(0, 0, ex, ey)
      expect(pts[0]).toEqual({ x: 0, y: 0 })
      expect(pts[pts.length - 1]).toEqual({ x: ex, y: ey })
      expect(pts.length).toBe(Math.max(Math.abs(ex), Math.abs(ey)) + 1)
      for (let i = 1; i < pts.length; i++) {
        expect(Math.abs(pts[i].x - pts[i - 1].x)).toBeLessThanOrEqual(1)
        expect(Math.abs(pts[i].y - pts[i - 1].y)).toBeLessThanOrEqual(1)
      }
      expect(new Set(pts.map((p) => `${p.x},${p.y}`)).size).toBe(pts.length)
    }
  })

  it('donne des coordonnées entières même avec des entrées réelles', () => {
    for (const p of linePoints(0.4, 0.6, 5.2, 2.7)) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true)
    }
  })

  it('contraint les angles à 45° avec Maj', () => {
    expect(constrainLine(0, 0, 10, 2)).toEqual({ x: 10, y: 0 })
    expect(constrainLine(0, 0, 1, 9)).toEqual({ x: 0, y: 9 })
    expect(constrainLine(0, 0, 6, -5)).toEqual({ x: 6, y: -6 })
    expect(constrainSquare(2, 2, 5, 9)).toEqual({ x: 9, y: 9 })
    expect(constrainSquare(2, 2, -1, 0)).toEqual({ x: -1, y: -1 })
  })
})

describe('rectangles', () => {
  it('trace le contour sans doublon ni pixel intérieur', () => {
    const pts: string[] = []
    plotRect(1, 1, 4, 3, false, (x, y) => pts.push(`${x},${y}`))
    expect(new Set(pts).size).toBe(pts.length)
    expect(pts.length).toBe(2 * 4 + 2 * 1) // 4×3 : périmètre de 10 pixels
    expect(pts).not.toContain('2,2')
  })

  it('remplit le rectangle et accepte des coins inversés', () => {
    const s = collect((plot) => plotRect(4, 3, 1, 1, true, plot))
    expect(s.size).toBe(12)
    expect(s.has('2,2')).toBe(true)
  })

  it('gère les rectangles d’un pixel de large', () => {
    expect(collect((plot) => plotRect(2, 0, 2, 4, false, plot)).size).toBe(5)
    expect(collect((plot) => plotRect(0, 0, 0, 0, false, plot)).size).toBe(1)
  })
})

describe('ellipses', () => {
  it('trace un cercle 5×5 attendu', () => {
    const s = collect((plot) => plotEllipse(0, 0, 4, 4, false, plot))
    const expected = ['1,0', '2,0', '3,0', '0,1', '4,1', '0,2', '4,2', '0,3', '4,3', '1,4', '2,4', '3,4']
    expect([...s].sort()).toEqual(expected.sort())
  })

  it('reste dans le rectangle englobant et touche ses quatre côtés', () => {
    for (const [w, h] of [
      [1, 1],
      [2, 2],
      [2, 5],
      [7, 3],
      [8, 8],
      [16, 9],
      [31, 12]
    ]) {
      const s = collect((plot) => plotEllipse(3, 2, 3 + w - 1, 2 + h - 1, false, plot))
      const pts = [...s].map((k) => k.split(',').map(Number))
      const xs = pts.map((p) => p[0])
      const ys = pts.map((p) => p[1])
      expect(Math.min(...xs)).toBe(3)
      expect(Math.max(...xs)).toBe(3 + w - 1)
      expect(Math.min(...ys)).toBe(2)
      expect(Math.max(...ys)).toBe(2 + h - 1)
    }
  })

  it('est symétrique horizontalement et verticalement', () => {
    const s = collect((plot) => plotEllipse(0, 0, 10, 6, false, plot))
    for (const k of s) {
      const [x, y] = k.split(',').map(Number)
      expect(s.has(`${10 - x},${y}`)).toBe(true)
      expect(s.has(`${x},${6 - y}`)).toBe(true)
    }
  })

  it('l’ellipse pleine contient le contour et n’a pas de trou par ligne', () => {
    const outline = collect((plot) => plotEllipse(0, 0, 9, 6, false, plot))
    const filled = collect((plot) => plotEllipse(0, 0, 9, 6, true, plot))
    for (const k of outline) expect(filled.has(k)).toBe(true)
    for (let y = 0; y <= 6; y++) {
      const xs = [...filled].filter((k) => k.endsWith(`,${y}`)).map((k) => Number(k.split(',')[0]))
      expect(Math.max(...xs) - Math.min(...xs) + 1).toBe(xs.length)
    }
  })
})

describe('brosse', () => {
  it('applique une brosse carrée centrée sans anticrénelage', () => {
    const bmp = createBitmap(6, 6)
    stampBrush(bmp, 2, 2, 3, RED)
    expect(brushRect(2, 2, 3)).toEqual({ x: 1, y: 1, w: 3, h: 3 })
    let count = 0
    for (let i = 3; i < bmp.data.length; i += 4) {
      if (bmp.data[i] !== 0) {
        expect(bmp.data[i]).toBe(255)
        count++
      }
    }
    expect(count).toBe(9)
    expect(getPixel(bmp, 0, 0).a).toBe(0)
  })
})
