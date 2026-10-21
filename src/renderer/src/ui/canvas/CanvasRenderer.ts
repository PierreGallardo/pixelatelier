import { clipRect, type Point, type Rect } from '../../model/bitmap'
import { composeFrame } from '../../model/compose'
import type { PixelDocument } from '../../model/document'
import type { Viewport } from '../../model/viewport'
import type { Editor } from '../../editor/Editor'
import { selectionEdges } from '../../model/selection'
import { brushRect } from '../../raster/brush'
import { toolInfo } from '../../tools/tools'

const WORKSPACE_BG = '#101116'
const CHECKER_A = '#3a3b45'
const CHECKER_B = '#2c2d35'
const CHECKER_SIZE = 8
const ONION_BEFORE_TINT = 'rgba(255, 92, 92, 0.45)'
const ONION_AFTER_TINT = 'rgba(80, 170, 255, 0.45)'

interface OnionCache {
  key: string
  canvas: HTMLCanvasElement
}

/**
 * Dessin de la zone de travail sur un `<canvas>` 2D.
 *
 * Les calques de l'image active sont composés (en TypeScript, voir
 * `composeFrame`) dans un canevas hors écran à la taille du document, mis à
 * jour uniquement sur les zones modifiées, puis agrandi à l'écran sans aucun
 * lissage (`imageSmoothingEnabled = false`).
 */
export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private docCanvas = document.createElement('canvas')
  private docCtx: CanvasRenderingContext2D
  private docImage: ImageData | null = null
  private docRef: PixelDocument | null = null
  private onion = new Map<number, OnionCache>()
  private checker: CanvasPattern | null = null
  private cssWidth = 1
  private cssHeight = 1
  private dpr = 1

  viewport: Viewport = { zoom: 1, panX: 0, panY: 0 }
  hover: Point | null = null
  private frameRequest = 0
  /** Contour de la sélection (segments en coordonnées du document), mis en cache par version. */
  private edgesVersion = -1
  private edges: number[] = []

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly editor: Editor
  ) {
    const ctx = canvas.getContext('2d', { alpha: false })
    const docCtx = this.docCanvas.getContext('2d', { willReadFrequently: false })
    if (!ctx || !docCtx) throw new Error('Canevas 2D indisponible')
    this.ctx = ctx
    this.docCtx = docCtx
    this.checker = this.makeChecker()
  }

  get width(): number {
    return this.cssWidth
  }

  get height(): number {
    return this.cssHeight
  }

  private makeChecker(): CanvasPattern | null {
    const tile = document.createElement('canvas')
    tile.width = CHECKER_SIZE * 2
    tile.height = CHECKER_SIZE * 2
    const t = tile.getContext('2d')
    if (!t) return null
    t.fillStyle = CHECKER_A
    t.fillRect(0, 0, tile.width, tile.height)
    t.fillStyle = CHECKER_B
    t.fillRect(0, 0, CHECKER_SIZE, CHECKER_SIZE)
    t.fillRect(CHECKER_SIZE, CHECKER_SIZE, CHECKER_SIZE, CHECKER_SIZE)
    return this.ctx.createPattern(tile, 'repeat')
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.cssWidth = Math.max(1, cssWidth)
    this.cssHeight = Math.max(1, cssHeight)
    this.dpr = dpr
    this.canvas.width = Math.max(1, Math.round(cssWidth * dpr))
    this.canvas.height = Math.max(1, Math.round(cssHeight * dpr))
  }

  /** Recalcule la composition de l'image active (zone `rect`, ou tout si `null`). */
  invalidate(rect: Rect | null): void {
    const doc = this.editor.doc
    if (!doc) return
    if (!this.docImage || this.docRef !== doc || this.docImage.width !== doc.width || this.docImage.height !== doc.height) {
      this.docRef = doc
      this.docCanvas.width = doc.width
      this.docCanvas.height = doc.height
      this.docImage = new ImageData(doc.width, doc.height)
      rect = null
    }
    const area = rect ? clipRect(rect, doc.width, doc.height) : { x: 0, y: 0, w: doc.width, h: doc.height }
    if (!area) return
    const frame = Math.min(this.editor.activeFrame, doc.frames.length - 1)
    composeFrame(doc, frame, { out: this.docImage.data, rect: area })
    this.docCtx.putImageData(this.docImage, 0, 0, area.x, area.y, area.w, area.h)
  }

  private onionCanvas(doc: PixelDocument, frameIndex: number, offset: number): HTMLCanvasElement {
    const frame = doc.frames[frameIndex]
    const key = `${this.editor.structureRevision}:${frame.id}:${this.editor.frameRevision(frame.id)}:${doc.width}x${doc.height}`
    const cached = this.onion.get(offset)
    if (cached && cached.key === key) return cached.canvas
    const canvas = cached?.canvas ?? document.createElement('canvas')
    canvas.width = doc.width
    canvas.height = doc.height
    const c = canvas.getContext('2d')
    if (c) {
      const data = composeFrame(doc, frameIndex)
      c.putImageData(new ImageData(data, doc.width, doc.height), 0, 0)
      // Teinte : rouge pour les images précédentes, bleu pour les suivantes.
      c.globalCompositeOperation = 'source-atop'
      c.fillStyle = offset < 0 ? ONION_BEFORE_TINT : ONION_AFTER_TINT
      c.fillRect(0, 0, doc.width, doc.height)
      c.globalCompositeOperation = 'source-over'
    }
    this.onion.set(offset, { key, canvas })
    return canvas
  }

  /** Demande un rendu au prochain rafraîchissement de l'écran (plusieurs demandes = un seul rendu). */
  schedule(): void {
    if (this.frameRequest) return
    this.frameRequest = requestAnimationFrame(() => {
      this.frameRequest = 0
      this.render()
    })
  }

  dispose(): void {
    if (this.frameRequest) cancelAnimationFrame(this.frameRequest)
    this.frameRequest = 0
  }

  render(): void {
    const { ctx, dpr } = this
    const doc = this.editor.doc
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = WORKSPACE_BG
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    if (!doc || !this.docImage) return

    const vp = this.viewport
    // Position alignée sur les pixels physiques pour des bords nets.
    const x = Math.round(vp.panX * dpr)
    const y = Math.round(vp.panY * dpr)
    const w = Math.round(doc.width * vp.zoom * dpr)
    const h = Math.round(doc.height * vp.zoom * dpr)
    ctx.imageSmoothingEnabled = false

    // Ombre portée et damier de transparence
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillRect(x + 4, y + 4, w, h)
    if (this.checker) {
      this.checker.setTransform(new DOMMatrix([dpr, 0, 0, dpr, x, y]))
      ctx.fillStyle = this.checker
    } else {
      ctx.fillStyle = CHECKER_A
    }
    ctx.fillRect(x, y, w, h)

    // Pelures d'oignon
    const onion = this.editor.onion
    if (onion.enabled && !this.editor.playing && doc.frames.length > 1) {
      const active = this.editor.activeFrame
      const draw = (offset: number, distance: number, count: number): void => {
        const fi = active + offset
        if (fi < 0 || fi >= doc.frames.length) return
        ctx.globalAlpha = onion.opacity * (1 - (distance - 1) / (count + 1))
        ctx.drawImage(this.onionCanvas(doc, fi, offset), x, y, w, h)
      }
      for (let d = onion.before; d >= 1; d--) draw(-d, d, onion.before)
      for (let d = onion.after; d >= 1; d--) draw(d, d, onion.after)
      ctx.globalAlpha = 1
    }

    ctx.drawImage(this.docCanvas, x, y, w, h)

    // Grille de pixels (à partir d'un zoom suffisant pour rester lisible)
    if (this.editor.showGrid && vp.zoom >= 6) this.drawGrid(doc, x, y, w, h)

    // Contour de l'image
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.lineWidth = 1
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1)

    this.drawSymmetryAxes(doc, x, y, w, h)
    this.drawSelection()
    this.drawCursor(doc)
  }

  /** Axes de symétrie : lignes en pointillés sur toute la hauteur / largeur de l'image. */
  private drawSymmetryAxes(doc: PixelDocument, x: number, y: number, w: number, h: number): void {
    const sym = this.editor.activeSymmetry
    if (!sym) return
    const { ctx, dpr } = this
    const zoom = this.viewport.zoom
    ctx.save()
    ctx.lineWidth = Math.max(1, Math.round(dpr))
    ctx.setLineDash([6 * dpr, 4 * dpr])
    ctx.strokeStyle = 'rgba(89, 211, 194, 0.9)'
    ctx.beginPath()
    if (sym.mirrorX && doc.width > 0) {
      const ax = Math.round(x + sym.axisX * zoom * dpr) + 0.5
      ctx.moveTo(ax, y)
      ctx.lineTo(ax, y + h)
    }
    if (sym.mirrorY && doc.height > 0) {
      const ay = Math.round(y + sym.axisY * zoom * dpr) + 0.5
      ctx.moveTo(x, ay)
      ctx.lineTo(x + w, ay)
    }
    ctx.stroke()
    ctx.restore()
  }

  /** Vrai si un contour animé est affiché (sélection ou collage en cours). */
  get hasAnimatedOutline(): boolean {
    return this.editor.selection !== null || this.editor.floating !== null || this.editor.selectionPreview !== null
  }

  /** Trace un chemin en pointillés animés (« fourmis »), lisible sur tout fond. */
  private strokeAnts(path: Path2D): void {
    const { ctx } = this
    ctx.save()
    ctx.lineWidth = 1
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.stroke(path)
    ctx.setLineDash([4, 4])
    ctx.lineDashOffset = -Math.floor(performance.now() / 90) % 8
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.95)'
    ctx.stroke(path)
    ctx.restore()
  }

  private rectPath(r: Rect): Path2D {
    const { dpr } = this
    const vp = this.viewport
    const x0 = Math.round((vp.panX + r.x * vp.zoom) * dpr) + 0.5
    const y0 = Math.round((vp.panY + r.y * vp.zoom) * dpr) + 0.5
    const x1 = Math.round((vp.panX + (r.x + r.w) * vp.zoom) * dpr) - 0.5
    const y1 = Math.round((vp.panY + (r.y + r.h) * vp.zoom) * dpr) - 0.5
    const p = new Path2D()
    p.rect(x0, y0, Math.max(0, x1 - x0), Math.max(0, y1 - y0))
    return p
  }

  private drawSelection(): void {
    const e = this.editor
    const { dpr } = this
    const vp = this.viewport
    const sel = e.selection
    if (sel) {
      if (this.edgesVersion !== e.selectionVersion) {
        this.edges = selectionEdges(sel)
        this.edgesVersion = e.selectionVersion
      }
      const off = e.selectionOffset ?? { x: 0, y: 0 }
      const path = new Path2D()
      const sx = (x: number): number => Math.round((vp.panX + (x + off.x) * vp.zoom) * dpr) + 0.5
      const sy = (y: number): number => Math.round((vp.panY + (y + off.y) * vp.zoom) * dpr) + 0.5
      const edges = this.edges
      for (let i = 0; i < edges.length; i += 4) {
        path.moveTo(sx(edges[i]), sy(edges[i + 1]))
        path.lineTo(sx(edges[i + 2]), sy(edges[i + 3]))
      }
      this.strokeAnts(path)
    }
    const preview = e.selectionPreview
    if (preview) this.strokeAnts(this.rectPath(preview))
    const floating = e.floatingRect
    if (floating) {
      const path = this.rectPath(floating)
      this.ctx.save()
      this.ctx.fillStyle = 'rgba(89, 211, 194, 0.08)'
      this.ctx.fill(path)
      this.ctx.restore()
      this.strokeAnts(path)
    }
  }

  private drawGrid(doc: PixelDocument, x: number, y: number, w: number, h: number): void {
    const { ctx, dpr } = this
    const step = this.viewport.zoom * dpr
    const x0 = Math.max(0, Math.floor(-x / step))
    const x1 = Math.min(doc.width, Math.ceil((this.canvas.width - x) / step))
    const y0 = Math.max(0, Math.floor(-y / step))
    const y1 = Math.min(doc.height, Math.ceil((this.canvas.height - y) / step))
    ctx.beginPath()
    for (let i = x0 + 1; i < x1; i++) {
      const gx = Math.round(x + i * step) + 0.5
      ctx.moveTo(gx, Math.max(0, y))
      ctx.lineTo(gx, Math.min(this.canvas.height, y + h))
    }
    for (let j = y0 + 1; j < y1; j++) {
      const gy = Math.round(y + j * step) + 0.5
      ctx.moveTo(Math.max(0, x), gy)
      ctx.lineTo(Math.min(this.canvas.width, x + w), gy)
    }
    ctx.strokeStyle = 'rgba(128, 128, 140, 0.28)'
    ctx.lineWidth = 1
    ctx.stroke()
  }

  private drawCursor(doc: PixelDocument): void {
    const p = this.hover
    if (!p || p.x < -32 || p.y < -32 || p.x > doc.width + 32 || p.y > doc.height + 32) return
    const info = toolInfo(this.editor.tool)
    const size = info.usesBrush ? this.editor.brushSize : 1
    const r = brushRect(p.x, p.y, size)
    const { ctx, dpr } = this
    const vp = this.viewport
    const sx = Math.round((vp.panX + r.x * vp.zoom) * dpr)
    const sy = Math.round((vp.panY + r.y * vp.zoom) * dpr)
    const sw = Math.round(r.w * vp.zoom * dpr)
    const sh = Math.round(r.h * vp.zoom * dpr)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)'
    ctx.strokeRect(sx - 1.5, sy - 1.5, sw + 3, sh + 3)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.strokeRect(sx - 0.5, sy - 0.5, sw + 1, sh + 1)
  }
}
