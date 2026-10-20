import { clipRect, createBitmap, type Bitmap, type Rect } from './bitmap'

/**
 * Sélection : masque d'un octet par pixel du document (1 = sélectionné),
 * accompagné de son rectangle englobant. Une sélection n'est jamais vide :
 * l'absence de sélection est représentée par `null`.
 */
export interface Selection {
  readonly width: number
  readonly height: number
  readonly mask: Uint8Array
  readonly bounds: Rect
}

export type SelectionMode = 'replace' | 'add' | 'subtract'

/** Construit une sélection à partir d'un masque ; `null` si aucun pixel n'est sélectionné. */
export function selectionFromMask(width: number, height: number, mask: Uint8Array): Selection | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (mask[row + x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { width, height, mask, bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } }
}

/** Sélection rectangulaire (limitée au document). */
export function rectSelection(width: number, height: number, rect: Rect): Selection | null {
  const r = clipRect(rect, width, height)
  if (!r) return null
  const mask = new Uint8Array(width * height)
  for (let y = r.y; y < r.y + r.h; y++) mask.fill(1, y * width + r.x, y * width + r.x + r.w)
  return { width, height, mask, bounds: r }
}

/** Toute l'image. */
export function selectAll(width: number, height: number): Selection {
  return { width, height, mask: new Uint8Array(width * height).fill(1), bounds: { x: 0, y: 0, w: width, h: height } }
}

/** Combine une nouvelle zone avec la sélection existante (remplacer, ajouter, retirer). */
export function combineSelections(base: Selection | null, next: Selection | null, mode: SelectionMode): Selection | null {
  if (mode === 'replace' || !base) return mode === 'subtract' ? base : next
  if (!next) return base
  const mask = new Uint8Array(base.mask)
  if (mode === 'add') {
    for (let i = 0; i < mask.length; i++) if (next.mask[i]) mask[i] = 1
  } else {
    for (let i = 0; i < mask.length; i++) if (next.mask[i]) mask[i] = 0
  }
  return selectionFromMask(base.width, base.height, mask)
}

export function invertSelection(sel: Selection | null, width: number, height: number): Selection | null {
  if (!sel) return selectAll(width, height)
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < mask.length; i++) mask[i] = sel.mask[i] ? 0 : 1
  return selectionFromMask(width, height, mask)
}

/** Décale la sélection ; la partie qui sort du document est perdue. */
export function translateSelection(sel: Selection, dx: number, dy: number): Selection | null {
  if (dx === 0 && dy === 0) return sel
  const { width, height } = sel
  const mask = new Uint8Array(width * height)
  const b = sel.bounds
  for (let y = b.y; y < b.y + b.h; y++) {
    const ny = y + dy
    if (ny < 0 || ny >= height) continue
    for (let x = b.x; x < b.x + b.w; x++) {
      const nx = x + dx
      if (nx >= 0 && nx < width && sel.mask[y * width + x]) mask[ny * width + nx] = 1
    }
  }
  return selectionFromMask(width, height, mask)
}

export function isSelected(sel: Selection | null, x: number, y: number): boolean {
  return !!sel && x >= 0 && y >= 0 && x < sel.width && y < sel.height && sel.mask[y * sel.width + x] === 1
}

export function countSelected(sel: Selection | null): number {
  if (!sel) return 0
  let n = 0
  for (let i = 0; i < sel.mask.length; i++) n += sel.mask[i]
  return n
}

/**
 * Contour de la sélection sous forme de segments [x0, y0, x1, y1, …] en
 * coordonnées du document (bords des pixels). Les segments alignés sont fusionnés.
 */
export function selectionEdges(sel: Selection): number[] {
  const { width, height, mask, bounds: b } = sel
  const at = (x: number, y: number): number => (x >= 0 && y >= 0 && x < width && y < height ? mask[y * width + x] : 0)
  const out: number[] = []
  // Bords horizontaux : entre la ligne y-1 et la ligne y
  for (let y = b.y; y <= b.y + b.h; y++) {
    let start = -1
    for (let x = b.x; x <= b.x + b.w; x++) {
      const edge = x < b.x + b.w && at(x, y - 1) !== at(x, y)
      if (edge && start < 0) start = x
      else if (!edge && start >= 0) {
        out.push(start, y, x, y)
        start = -1
      }
    }
  }
  // Bords verticaux : entre la colonne x-1 et la colonne x
  for (let x = b.x; x <= b.x + b.w; x++) {
    let start = -1
    for (let y = b.y; y <= b.y + b.h; y++) {
      const edge = y < b.y + b.h && at(x - 1, y) !== at(x, y)
      if (edge && start < 0) start = y
      else if (!edge && start >= 0) {
        out.push(x, start, x, y)
        start = -1
      }
    }
  }
  return out
}

/* ------------------------- Opérations sur les pixels ------------------------- */

/** Image flottante (contenu du presse-papiers, collage en cours) et sa position. */
export interface PixelClip {
  image: Bitmap
  x: number
  y: number
}

/** Copie les pixels sélectionnés (les autres deviennent transparents) dans une image de la taille du rectangle englobant. */
export function extractSelected(src: Bitmap, sel: Selection): PixelClip {
  const b = sel.bounds
  const image = createBitmap(b.w, b.h)
  for (let y = 0; y < b.h; y++) {
    for (let x = 0; x < b.w; x++) {
      const si = (b.y + y) * src.width + b.x + x
      if (!sel.mask[si]) continue
      const di = (y * b.w + x) * 4
      image.data[di] = src.data[si * 4]
      image.data[di + 1] = src.data[si * 4 + 1]
      image.data[di + 2] = src.data[si * 4 + 2]
      image.data[di + 3] = src.data[si * 4 + 3]
    }
  }
  return { image, x: b.x, y: b.y }
}

/** Rend transparents les pixels sélectionnés. Retourne le rectangle concerné. */
export function clearSelected(bmp: Bitmap, sel: Selection): Rect {
  const b = sel.bounds
  for (let y = b.y; y < b.y + b.h; y++) {
    for (let x = b.x; x < b.x + b.w; x++) {
      const i = y * bmp.width + x
      if (sel.mask[i]) bmp.data.fill(0, i * 4, i * 4 + 4)
    }
  }
  return { ...b }
}

/**
 * Pose une image sur `dst` à la position (x, y). Les pixels totalement transparents
 * de l'image sont ignorés (ils laissent voir le dessous), les autres remplacent la destination.
 * Retourne la zone touchée dans `dst`, ou `null` si l'image est entièrement hors du document.
 */
export function stampImage(dst: Bitmap, image: Bitmap, x: number, y: number): Rect | null {
  const area = clipRect({ x, y, w: image.width, h: image.height }, dst.width, dst.height)
  if (!area) return null
  for (let yy = area.y; yy < area.y + area.h; yy++) {
    for (let xx = area.x; xx < area.x + area.w; xx++) {
      const si = ((yy - y) * image.width + (xx - x)) * 4
      const a = image.data[si + 3]
      if (a === 0) continue
      const di = (yy * dst.width + xx) * 4
      dst.data[di] = image.data[si]
      dst.data[di + 1] = image.data[si + 1]
      dst.data[di + 2] = image.data[si + 2]
      dst.data[di + 3] = a
    }
  }
  return area
}
