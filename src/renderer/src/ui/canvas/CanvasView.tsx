import { useEffect, useRef, useState } from 'react'
import { centerViewport, fitViewport, screenToDoc, stepZoom, zoomAt } from '../../model/viewport'
import { createToolBehavior, type ToolBehavior, type ToolPointer } from '../../tools/tools'
import type { ToolId } from '../../editor/Editor'
import { isSelected } from '../../model/selection'
import { setCursor } from '../cursorStore'
import { isTypingTarget } from '../commands'
import { useApp } from '../useEditor'
import { CanvasRenderer } from './CanvasRenderer'

/** Outils pour lesquels Alt+clic prend temporairement la pipette. */
const ALT_PICK_TOOLS: ToolId[] = ['pencil', 'fill', 'line', 'rect', 'rectFilled', 'ellipse', 'ellipseFilled']

interface PanState {
  pointerId: number
  startX: number
  startY: number
  panX: number
  panY: number
}

/**
 * Zone de dessin : gère le canevas, le zoom, le déplacement de la vue et
 * transmet les actions du pointeur à l'outil actif.
 */
export function CanvasView(): React.JSX.Element {
  const { editor } = useApp()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rendererRef = useRef<CanvasRenderer | null>(null)
  const [spaceDown, setSpaceDown] = useState(false)
  const [panning, setPanning] = useState(false)
  const [overMovable, setOverMovable] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const renderer = new CanvasRenderer(canvas, editor)
    rendererRef.current = renderer

    const schedule = (): void => renderer.schedule()

    const setViewport = (vp: typeof renderer.viewport): void => {
      renderer.viewport = vp
      editor.setZoom(vp.zoom)
      schedule()
    }

    const fit = (): void => {
      const doc = editor.doc
      if (doc) setViewport(fitViewport(doc.width, doc.height, renderer.width, renderer.height))
    }
    const zoomCenter = (direction: number): void => {
      const vp = renderer.viewport
      setViewport(zoomAt(vp, stepZoom(vp.zoom, direction), renderer.width / 2, renderer.height / 2))
    }
    editor.viewCommands = {
      zoomIn: () => zoomCenter(1),
      zoomOut: () => zoomCenter(-1),
      fit,
      actualSize: () => {
        const doc = editor.doc
        if (doc) setViewport(centerViewport(doc.width, doc.height, renderer.width, renderer.height, 1))
      },
      getViewport: () => ({ ...renderer.viewport })
    }

    // Taille du canevas = taille de son conteneur, en pixels physiques.
    let sized = false
    const observer = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect()
      renderer.resize(rect.width, rect.height, window.devicePixelRatio || 1)
      if (!sized && rect.width > 0) {
        sized = true
        renderer.invalidate(null)
        fit()
      }
      renderer.render()
    })
    observer.observe(container)

    // Changement de document ou de dimensions : recadrage.
    let lastDoc = editor.doc
    let lastSize = editor.doc ? `${editor.doc.width}x${editor.doc.height}` : ''
    const unsubscribe = editor.subscribe(() => {
      const doc = editor.doc
      const size = doc ? `${doc.width}x${doc.height}` : ''
      if (doc !== lastDoc) {
        lastDoc = doc
        lastSize = size
        renderer.invalidate(null)
        // Changement d'onglet : on retrouve la vue laissée sur ce document.
        const hint = editor.takeViewportHint()
        if (hint) setViewport(hint)
        else if (sized) fit()
      } else if (size !== lastSize && doc) {
        lastSize = size
        renderer.invalidate(null)
        setViewport(centerViewport(doc.width, doc.height, renderer.width, renderer.height, renderer.viewport.zoom))
      }
      schedule()
    })
    const unsubscribeRender = editor.subscribeRender((rect) => {
      renderer.invalidate(rect)
      schedule()
    })
    const antsTimer = window.setInterval(() => {
      if (renderer.hasAnimatedOutline) schedule()
    }, 120)

    return () => {
      observer.disconnect()
      window.clearInterval(antsTimer)
      unsubscribe()
      unsubscribeRender()
      renderer.dispose()
      editor.viewCommands = null
      rendererRef.current = null
    }
  }, [editor])

  // Pointeur, molette et touche Espace
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let behavior: ToolBehavior | null = null
    let activePointer: number | null = null
    let pan: PanState | null = null
    let space = false
    let wheelAccum = 0

    const renderer = (): CanvasRenderer | null => rendererRef.current
    const localPoint = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const toolPointer = (e: PointerEvent, button: number): ToolPointer | null => {
      const rd = renderer()
      if (!rd) return null
      const lp = localPoint(e)
      const p = screenToDoc(rd.viewport, lp.x, lp.y)
      return { x: p.x, y: p.y, button, shift: e.shiftKey, alt: e.altKey }
    }
    let dragButton = 0

    const updateHover = (e: PointerEvent): void => {
      const rd = renderer()
      if (!rd || !editor.doc) return
      const lp = localPoint(e)
      const p = screenToDoc(rd.viewport, lp.x, lp.y)
      rd.hover = p
      const inside = p.x >= 0 && p.y >= 0 && p.x < editor.doc.width && p.y < editor.doc.height
      setCursor(inside ? p : null)
      const fr = editor.floatingRect
      const movable =
        editor.tool === 'select' &&
        !e.shiftKey &&
        !e.altKey &&
        ((fr !== null && p.x >= fr.x && p.y >= fr.y && p.x < fr.x + fr.w && p.y < fr.y + fr.h) || isSelected(editor.selection, p.x, p.y))
      setOverMovable(movable)
      rd.schedule()
    }

    const onPointerDown = (e: PointerEvent): void => {
      const rd = renderer()
      if (!rd || !editor.doc || activePointer !== null) return
      canvas.focus({ preventScroll: true })
      if (e.button === 1 || (e.button === 0 && space)) {
        e.preventDefault()
        pan = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, panX: rd.viewport.panX, panY: rd.viewport.panY }
        activePointer = e.pointerId
        canvas.setPointerCapture(e.pointerId)
        setPanning(true)
        return
      }
      if (e.button !== 0 && e.button !== 2) return
      e.preventDefault()
      const toolId: ToolId = e.altKey && ALT_PICK_TOOLS.includes(editor.tool) ? 'picker' : editor.tool
      behavior = createToolBehavior(editor, toolId)
      dragButton = e.button
      activePointer = e.pointerId
      canvas.setPointerCapture(e.pointerId)
      const p = toolPointer(e, dragButton)
      if (p) behavior.down(p)
    }

    const onPointerMove = (e: PointerEvent): void => {
      if (pan && e.pointerId === pan.pointerId) {
        const rd = renderer()
        if (!rd) return
        rd.viewport = { ...rd.viewport, panX: pan.panX + e.clientX - pan.startX, panY: pan.panY + e.clientY - pan.startY }
        rd.schedule()
        return
      }
      if (behavior && e.pointerId === activePointer) {
        // Les événements regroupés gardent la précision des tracés rapides.
        const events = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : []
        for (const ev of events.length > 0 ? events : [e]) {
          const p = toolPointer(ev, dragButton)
          if (p) behavior.move({ ...p, shift: e.shiftKey })
        }
      }
      updateHover(e)
    }

    const finish = (e: PointerEvent, cancelled: boolean): void => {
      if (e.pointerId !== activePointer) return
      if (pan) {
        pan = null
        setPanning(false)
      } else if (behavior) {
        const p = toolPointer(e, dragButton)
        if (cancelled || !p) behavior.cancel()
        else behavior.up(p)
        behavior = null
      }
      activePointer = null
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    }
    const onPointerUp = (e: PointerEvent): void => finish(e, false)
    const onPointerCancel = (e: PointerEvent): void => finish(e, true)

    const onPointerLeave = (): void => {
      const rd = renderer()
      if (rd && activePointer === null) {
        rd.hover = null
        rd.schedule()
      }
      setCursor(null)
    }

    const onWheel = (e: WheelEvent): void => {
      const rd = renderer()
      if (!rd || !editor.doc) return
      e.preventDefault()
      if (e.shiftKey && !e.ctrlKey) {
        rd.viewport = { ...rd.viewport, panX: rd.viewport.panX - (e.deltaY || e.deltaX) }
        rd.schedule()
        return
      }
      // Molette : zoom centré sur le pointeur (un cran de molette = un niveau).
      wheelAccum += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY
      if (Math.abs(wheelAccum) < 50) return
      const direction = wheelAccum < 0 ? 1 : -1
      wheelAccum = 0
      const lp = localPoint(e)
      const vp = zoomAt(rd.viewport, stepZoom(rd.viewport.zoom, direction), lp.x, lp.y)
      rd.viewport = vp
      editor.setZoom(vp.zoom)
      rd.schedule()
    }

    const onContextMenu = (e: MouseEvent): void => e.preventDefault()

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.code === 'Space' && !isTypingTarget(e.target)) {
        if (!space) {
          space = true
          setSpaceDown(true)
        }
        e.preventDefault()
      }
      if (e.key === 'Escape' && behavior) {
        behavior.cancel()
        behavior = null
        e.preventDefault()
        return
      }
      if (isTypingTarget(e.target) || document.querySelector('.modal, .menu')) return
      if (editor.floating) {
        const step = e.shiftKey ? 10 : 1
        const f = editor.floating
        const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
        if (e.key in moves && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const [dx, dy] = moves[e.key]
          editor.moveFloatingTo(f.x + dx, f.y + dy)
          e.preventDefault()
        } else if (e.key === 'Enter') {
          editor.commitFloating()
          e.preventDefault()
        } else if (e.key === 'Escape') {
          editor.cancelFloating()
          e.preventDefault()
        }
      } else if (e.key === 'Escape' && editor.selection) {
        editor.deselect()
        e.preventDefault()
      }
    }
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.code === 'Space') {
        space = false
        setSpaceDown(false)
        // Évite qu'Espace « clique » le bouton qui a le focus.
        if (!isTypingTarget(e.target)) e.preventDefault()
      }
    }
    const onBlur = (): void => {
      space = false
      setSpaceDown(false)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      behavior?.cancel()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [editor])

  const cursor = panning ? 'grabbing' : spaceDown ? 'grab' : overMovable ? 'move' : 'crosshair'
  return (
    <div className="canvas-view" ref={containerRef}>
      <canvas ref={canvasRef} className="canvas-view__canvas" style={{ cursor }} tabIndex={-1} aria-label="Zone de dessin" />
    </div>
  )
}
