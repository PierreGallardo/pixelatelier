/**
 * Couleurs RGBA non prémultipliées, chaque composante dans [0, 255].
 */
export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}

export const TRANSPARENT: RGBA = Object.freeze({ r: 0, g: 0, b: 0, a: 0 })
export const BLACK: RGBA = Object.freeze({ r: 0, g: 0, b: 0, a: 255 })
export const WHITE: RGBA = Object.freeze({ r: 255, g: 255, b: 255, a: 255 })

export function rgba(r: number, g: number, b: number, a = 255): RGBA {
  return { r: clampByte(r), g: clampByte(g), b: clampByte(b), a: clampByte(a) }
}

export function clampByte(v: number): number {
  if (Number.isNaN(v)) return 0
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}

export function colorsEqual(a: RGBA, b: RGBA): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a
}

function hex2(v: number): string {
  return clampByte(v).toString(16).padStart(2, '0')
}

/** `#rrggbb` pour une couleur opaque, `#rrggbbaa` sinon (modifiable avec `alpha`). */
export function toHex(c: RGBA, alpha: 'auto' | 'always' | 'never' = 'auto'): string {
  const base = `#${hex2(c.r)}${hex2(c.g)}${hex2(c.b)}`
  if (alpha === 'never') return base
  if (alpha === 'always' || c.a !== 255) return base + hex2(c.a)
  return base
}

/** Accepte `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` (le `#` est facultatif). */
export function parseHex(input: string): RGBA | null {
  let s = input.trim()
  if (s.startsWith('#')) s = s.slice(1)
  if (!/^[0-9a-fA-F]+$/.test(s)) return null
  if (s.length === 3 || s.length === 4) {
    s = s
      .split('')
      .map((ch) => ch + ch)
      .join('')
  }
  if (s.length !== 6 && s.length !== 8) return null
  const r = parseInt(s.slice(0, 2), 16)
  const g = parseInt(s.slice(2, 4), 16)
  const b = parseInt(s.slice(4, 6), 16)
  const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) : 255
  return { r, g, b, a }
}

export function toCss(c: RGBA): string {
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${(c.a / 255).toFixed(3)})`
}

export interface HSV {
  /** Teinte en degrés [0, 360[ */
  h: number
  /** Saturation [0, 1] */
  s: number
  /** Valeur [0, 1] */
  v: number
}

export function rgbToHsv(r: number, g: number, b: number): HSV {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6
    else if (max === gn) h = (bn - rn) / d + 2
    else h = (rn - gn) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, v: max }
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const hh = (((h % 360) + 360) % 360) / 60
  const c = v * s
  const x = c * (1 - Math.abs((hh % 2) - 1))
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (hh < 1) [r1, g1, b1] = [c, x, 0]
  else if (hh < 2) [r1, g1, b1] = [x, c, 0]
  else if (hh < 3) [r1, g1, b1] = [0, c, x]
  else if (hh < 4) [r1, g1, b1] = [0, x, c]
  else if (hh < 5) [r1, g1, b1] = [x, 0, c]
  else [r1, g1, b1] = [c, 0, x]
  const m = v - c
  return {
    r: clampByte((r1 + m) * 255),
    g: clampByte((g1 + m) * 255),
    b: clampByte((b1 + m) * 255)
  }
}
