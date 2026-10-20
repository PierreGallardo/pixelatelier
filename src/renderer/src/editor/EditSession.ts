import { clipRect, diffBounds, readRect, unionRect, type Bitmap, type Rect } from '../model/bitmap'

/**
 * Session de modification des pixels d'une cellule.
 *
 * Un outil ouvre une session au début d'un trait, modifie `cel` autant de fois
 * que nécessaire, puis appelle `commit()` : toutes les modifications du trait
 * deviennent une seule entrée d'historique (l'état d'origine est mémorisé à
 * l'ouverture de la session).
 *
 * Avec un masque `clip` (sélection active), les pixels hors du masque sont
 * rétablis à chaque `touch()` : le dessin reste confiné à la sélection.
 */
export interface EditSessionHost {
  requestRender(rect: Rect | null): void
  commitPixels(session: EditSession, label: string, rect: Rect, before: Uint8ClampedArray, after: Uint8ClampedArray): void
  endSession(session: EditSession): void
}

export class EditSession {
  private readonly original: Uint8ClampedArray
  private touched: Rect | null = null
  private closed = false

  constructor(
    private readonly host: EditSessionHost,
    readonly cel: Bitmap,
    readonly layerId: string,
    readonly frameId: string,
    private readonly clip: Uint8Array | null = null
  ) {
    this.original = new Uint8ClampedArray(cel.data)
  }

  /** Pixels de la cellule au début de la session (non modifiés). */
  get originalPixels(): Bitmap {
    return { width: this.cel.width, height: this.cel.height, data: this.original }
  }

  get isClosed(): boolean {
    return this.closed
  }

  /** Signale qu'une zone a été modifiée (pour le rendu et le calcul du patch). */
  touch(rect: Rect | null): void {
    if (!rect || this.closed) return
    if (this.clip) this.applyClip(rect)
    this.touched = unionRect(this.touched, rect)
    this.host.requestRender(rect)
  }

  private applyClip(rect: Rect): void {
    const clip = this.clip
    const area = clipRect(rect, this.cel.width, this.cel.height)
    if (!clip || !area) return
    const { width } = this.cel
    const data = this.cel.data
    for (let y = area.y; y < area.y + area.h; y++) {
      for (let x = area.x; x < area.x + area.w; x++) {
        const p = y * width + x
        if (clip[p]) continue
        const i = p * 4
        data[i] = this.original[i]
        data[i + 1] = this.original[i + 1]
        data[i + 2] = this.original[i + 2]
        data[i + 3] = this.original[i + 3]
      }
    }
  }

  /** Remet la cellule dans l'état du début de session (aperçu des formes). */
  restore(): void {
    if (this.closed || !this.touched) return
    this.cel.data.set(this.original)
    this.host.requestRender(this.touched)
  }

  /** Enregistre les modifications dans l'historique (une seule entrée) et ferme la session. */
  commit(label: string): boolean {
    if (this.closed) return false
    this.closed = true
    const { width, height } = this.cel
    const rect = this.touched ? diffBounds(this.original, this.cel.data, width, height, this.touched) : null
    if (rect) {
      const before = readRect({ width, height, data: this.original }, rect)
      const after = readRect(this.cel, rect)
      this.host.commitPixels(this, label, rect, before, after)
    }
    this.host.endSession(this)
    return rect !== null
  }

  /** Annule les modifications en cours sans rien ajouter à l'historique. */
  cancel(): void {
    if (this.closed) return
    this.restore()
    this.closed = true
    this.host.endSession(this)
  }
}
