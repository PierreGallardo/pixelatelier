import { setPixel, type Bitmap, type Rect } from '../model/bitmap'
import type { RGBA } from '../model/color'

export const MIN_BRUSH_SIZE = 1
export const MAX_BRUSH_SIZE = 32

/** Zone couverte par une brosse carrée de taille `size` centrée sur (x, y). */
export function brushRect(x: number, y: number, size: number): Rect {
  const off = Math.floor((size - 1) / 2)
  return { x: x - off, y: y - off, w: size, h: size }
}

/** Applique une brosse carrée pleine (remplacement des pixels, sans mélange). */
export function stampBrush(bmp: Bitmap, x: number, y: number, size: number, color: RGBA): void {
  if (size <= 1) {
    setPixel(bmp, x, y, color)
    return
  }
  const r = brushRect(x, y, size)
  for (let yy = r.y; yy < r.y + r.h; yy++) {
    for (let xx = r.x; xx < r.x + r.w; xx++) setPixel(bmp, xx, yy, color)
  }
}
