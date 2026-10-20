import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Ghost,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Trash2
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { composeFrame } from '../../model/compose'
import { MAX_FPS, MIN_FPS, type PixelDocument } from '../../model/document'
import type { Editor } from '../../editor/Editor'
import { formatKeys, type CommandId } from '../commands'
import { useApp, useEditor } from '../useEditor'
import { IconButton } from './IconButton'

const THUMB = 52

/** Miniature d'une image d'animation, redessinée seulement quand elle change. */
function FrameThumb({ doc, index, revision }: { doc: PixelDocument; index: number; revision: string }): React.JSX.Element {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = doc.width
    canvas.height = doc.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.putImageData(new ImageData(composeFrame(doc, index), doc.width, doc.height), 0, 0)
  }, [doc, index, revision])
  const scale = Math.min(THUMB / doc.width, THUMB / doc.height)
  return (
    <canvas
      ref={ref}
      className="frame__thumb checker"
      style={{ width: Math.max(1, Math.round(doc.width * scale)), height: Math.max(1, Math.round(doc.height * scale)) }}
    />
  )
}

/** Lecture de l'animation : avance d'une image selon les images par seconde. */
function usePlayback(editor: Editor): void {
  const playing = editor.playing
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const tick = (now: number): void => {
      const doc = editor.doc
      if (!doc || !editor.playing) return
      acc += now - last
      last = now
      const frameMs = 1000 / doc.fps
      if (acc >= frameMs) {
        acc %= frameMs
        editor.nextFrame()
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [editor, playing])
}

/** Timeline : contrôle de lecture, images d'animation et pelures d'oignon. */
export function Timeline(): React.JSX.Element {
  const editor = useEditor()
  const { commands } = useApp()
  usePlayback(editor)
  const stripRef = useRef<HTMLDivElement>(null)
  const doc = editor.doc

  // Garde l'image active visible dans la bande.
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('.frame.is-active')
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [editor.activeFrame, doc?.frames.length])

  if (!doc) return <footer className="timeline" />
  const tip = (id: CommandId, label?: string): string => {
    const k = commands[id].keys?.[0]
    return `${label ?? commands[id].label}${k ? ` (${formatKeys(k)})` : ''}`
  }
  const frameCount = doc.frames.length
  const onion = editor.onion

  return (
    <footer className="timeline">
      <div className="timeline__controls">
        <div className="timeline__group">
          <IconButton title={tip('anim.firstFrame')} onClick={() => editor.setActiveFrame(0)}>
            <SkipBack size={15} />
          </IconButton>
          <IconButton title={tip('anim.prevFrame')} onClick={() => editor.prevFrame()}>
            <ChevronLeft size={16} />
          </IconButton>
          <IconButton
            title={tip('anim.play', editor.playing ? 'Pause' : 'Lecture')}
            onClick={() => editor.togglePlay()}
            active={editor.playing}
            disabled={frameCount < 2}
            className="timeline__play"
          >
            {editor.playing ? <Pause size={16} /> : <Play size={16} />}
          </IconButton>
          <IconButton title={tip('anim.nextFrame')} onClick={() => editor.nextFrame()}>
            <ChevronRight size={16} />
          </IconButton>
          <IconButton title={tip('anim.lastFrame')} onClick={() => editor.setActiveFrame(frameCount - 1)}>
            <SkipForward size={15} />
          </IconButton>
          <span className="timeline__counter" title="Image active / nombre d'images">
            {editor.activeFrame + 1} / {frameCount}
          </span>
        </div>

        <div className="timeline__group">
          <label className="field field--inline" title="Vitesse de lecture et de l'export GIF">
            <span>Images/s</span>
            <input
              type="number"
              min={MIN_FPS}
              max={MAX_FPS}
              value={doc.fps}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v) && v >= MIN_FPS) editor.setFps(v)
              }}
            />
          </label>
          <span className="muted small">{Math.round(1000 / doc.fps)} ms/image</span>
        </div>

        <div className="timeline__group">
          <IconButton
            title={tip('anim.onion', 'Pelures d’oignon : afficher les images voisines')}
            onClick={() => editor.setOnion({ enabled: !onion.enabled })}
            active={onion.enabled}
          >
            <Ghost size={16} />
          </IconButton>
          <label className="field field--inline" title="Images précédentes affichées (teinte rouge)">
            <span>Avant</span>
            <select value={onion.before} onChange={(e) => editor.setOnion({ before: Number(e.target.value) })} disabled={!onion.enabled}>
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--inline" title="Images suivantes affichées (teinte bleue)">
            <span>Après</span>
            <select value={onion.after} onChange={(e) => editor.setOnion({ after: Number(e.target.value) })} disabled={!onion.enabled}>
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="field field--inline" title="Opacité des pelures d'oignon">
            <span>Opacité</span>
            <input
              type="range"
              min={10}
              max={90}
              value={Math.round(onion.opacity * 100)}
              onChange={(e) => editor.setOnion({ opacity: Number(e.target.value) / 100 })}
              disabled={!onion.enabled}
            />
          </label>
        </div>

        <div className="timeline__group timeline__group--end">
          <IconButton title={tip('anim.newFrame')} onClick={() => editor.addFrame()}>
            <Plus size={15} />
          </IconButton>
          <IconButton title={tip('anim.duplicateFrame')} onClick={() => editor.duplicateFrame()}>
            <Copy size={15} />
          </IconButton>
          <IconButton title={tip('anim.moveFrameLeft')} onClick={() => editor.moveFrame(editor.activeFrame, -1)} disabled={editor.activeFrame === 0}>
            <ChevronsLeft size={15} />
          </IconButton>
          <IconButton
            title={tip('anim.moveFrameRight')}
            onClick={() => editor.moveFrame(editor.activeFrame, 1)}
            disabled={editor.activeFrame >= frameCount - 1}
          >
            <ChevronsRight size={15} />
          </IconButton>
          <IconButton title={tip('anim.deleteFrame')} onClick={() => editor.deleteFrame()} disabled={frameCount <= 1}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </div>

      <div className="timeline__strip" ref={stripRef} role="listbox" aria-label="Images de l'animation">
        {doc.frames.map((frame, i) => (
          <button
            key={frame.id}
            type="button"
            role="option"
            aria-selected={i === editor.activeFrame}
            className={`frame${i === editor.activeFrame ? ' is-active' : ''}`}
            title={`Image ${i + 1}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.pause()
              editor.setActiveFrame(i)
            }}
          >
            <span className="frame__box">
              <FrameThumb doc={doc} index={i} revision={`${editor.structureRevision}:${editor.frameRevision(frame.id)}`} />
            </span>
            <span className="frame__label">{i + 1}</span>
          </button>
        ))}
        <button type="button" className="frame frame--add" title={tip('anim.newFrame')} onMouseDown={(e) => e.preventDefault()} onClick={() => editor.addFrame()}>
          <Plus size={18} />
        </button>
      </div>
    </footer>
  )
}
