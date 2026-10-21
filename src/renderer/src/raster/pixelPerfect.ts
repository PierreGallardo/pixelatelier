import type { Point } from '../model/bitmap'

/**
 * Mode « pixel parfait » des traits à main levée.
 *
 * Un trait de 1 px tracé à la souris produit souvent des angles en « L »
 * (un pixel de trop dans les diagonales). Ce filtre suit les pixels du trait
 * dans l'ordre : dès que les trois derniers forment un tel angle, le pixel du
 * coin est retiré. Le trait garde ainsi une épaisseur d'un pixel exactement.
 */
export class PixelPerfectStroke {
  private points: Point[] = []

  /** Nombre de pixels actuellement retenus dans le trait. */
  get length(): number {
    return this.points.length
  }

  /**
   * Ajoute le pixel suivant du trait. Retourne le pixel à effacer (coin d'un « L »),
   * ou `null`. Un pixel identique au précédent est ignoré.
   */
  add(p: Point): Point | null {
    const last = this.points[this.points.length - 1]
    if (last && last.x === p.x && last.y === p.y) return null
    this.points.push({ x: p.x, y: p.y })
    const n = this.points.length
    if (n < 3) return null
    const a = this.points[n - 3]
    const b = this.points[n - 2]
    const c = this.points[n - 1]
    if (isCorner(a, b, c)) {
      this.points.splice(n - 2, 1)
      return b
    }
    return null
  }
}

/** Vrai si `b` est le coin d'un angle en « L » entre `a` et `c` (voisins orthogonaux de `b`, en diagonale l'un de l'autre). */
export function isCorner(a: Point, b: Point, c: Point): boolean {
  const abOrthogonal = (a.x === b.x && Math.abs(a.y - b.y) === 1) || (a.y === b.y && Math.abs(a.x - b.x) === 1)
  const bcOrthogonal = (c.x === b.x && Math.abs(c.y - b.y) === 1) || (c.y === b.y && Math.abs(c.x - b.x) === 1)
  return abOrthogonal && bcOrthogonal && Math.abs(a.x - c.x) === 1 && Math.abs(a.y - c.y) === 1
}
