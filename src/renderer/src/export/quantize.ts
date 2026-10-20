/**
 * Réduction de palette par « median cut » pondéré, utilisée uniquement quand
 * une animation contient plus de couleurs que n'en accepte le format GIF.
 * Les couleurs sont manipulées au format 0xRRGGBB.
 */

interface Entry {
  r: number
  g: number
  b: number
  count: number
}

interface Box {
  entries: Entry[]
  /** Étendue maximale sur un canal, pour choisir la prochaine boîte à couper. */
  range: number
  channel: 'r' | 'g' | 'b'
  weight: number
}

function makeBox(entries: Entry[]): Box {
  let rMin = 255
  let rMax = 0
  let gMin = 255
  let gMax = 0
  let bMin = 255
  let bMax = 0
  let weight = 0
  for (const e of entries) {
    if (e.r < rMin) rMin = e.r
    if (e.r > rMax) rMax = e.r
    if (e.g < gMin) gMin = e.g
    if (e.g > gMax) gMax = e.g
    if (e.b < bMin) bMin = e.b
    if (e.b > bMax) bMax = e.b
    weight += e.count
  }
  const rr = rMax - rMin
  const gr = gMax - gMin
  const br = bMax - bMin
  const channel = rr >= gr && rr >= br ? 'r' : gr >= br ? 'g' : 'b'
  return { entries, range: Math.max(rr, gr, br), channel, weight }
}

export function medianCut(histogram: Map<number, number>, maxColors: number): number[] {
  const entries: Entry[] = []
  for (const [rgb, count] of histogram) entries.push({ r: (rgb >> 16) & 255, g: (rgb >> 8) & 255, b: rgb & 255, count })
  if (entries.length <= maxColors) return entries.map((e) => (e.r << 16) | (e.g << 8) | e.b)

  const boxes: Box[] = [makeBox(entries)]
  while (boxes.length < maxColors) {
    // Coupe la boîte la plus « étendue » pondérée par le nombre de pixels.
    let best = -1
    let bestScore = -1
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]
      if (b.entries.length < 2 || b.range === 0) continue
      const score = b.range * Math.sqrt(b.weight)
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }
    if (best < 0) break
    const box = boxes[best]
    const ch = box.channel
    box.entries.sort((a, b) => a[ch] - b[ch])
    let acc = 0
    let cut = 1
    for (let i = 0; i < box.entries.length - 1; i++) {
      acc += box.entries[i].count
      if (acc >= box.weight / 2) {
        cut = i + 1
        break
      }
      cut = i + 1
    }
    boxes.splice(best, 1, makeBox(box.entries.slice(0, cut)), makeBox(box.entries.slice(cut)))
  }

  return boxes.map((b) => {
    let r = 0
    let g = 0
    let bl = 0
    for (const e of b.entries) {
      r += e.r * e.count
      g += e.g * e.count
      bl += e.b * e.count
    }
    const w = b.weight || 1
    return (Math.round(r / w) << 16) | (Math.round(g / w) << 8) | Math.round(bl / w)
  })
}

/** Index de la couleur de `palette` la plus proche (distance euclidienne pondérée). */
export function nearestIndex(palette: number[], rgb: number): number {
  const r = (rgb >> 16) & 255
  const g = (rgb >> 8) & 255
  const b = rgb & 255
  let best = 0
  let bestDist = Infinity
  for (let i = 0; i < palette.length; i++) {
    const p = palette[i]
    const dr = r - ((p >> 16) & 255)
    const dg = g - ((p >> 8) & 255)
    const db = b - (p & 255)
    const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db
    if (d < bestDist) {
      bestDist = d
      best = i
      if (d === 0) break
    }
  }
  return best
}
