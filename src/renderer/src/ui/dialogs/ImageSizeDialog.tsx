import { useState } from 'react'
import type { Anchor } from '../../editor/Editor'
import { MAX_DIMENSION } from '../../model/document'
import { useEditor } from '../useEditor'
import { Modal } from './Modal'

const ANCHORS: Anchor[] = ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br']
const ANCHOR_LABELS: Record<Anchor, string> = {
  tl: 'En haut à gauche',
  t: 'En haut',
  tr: 'En haut à droite',
  l: 'À gauche',
  c: 'Au centre',
  r: 'À droite',
  bl: 'En bas à gauche',
  b: 'En bas',
  br: 'En bas à droite'
}

function parseDim(v: string): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= MAX_DIMENSION ? n : null
}

/**
 * Deux modes : « canvas » change la taille du canevas sans déformer les pixels
 * (ajout ou rognage selon l'ancrage) ; « scale » redimensionne l'image au plus proche voisin.
 */
export function ImageSizeDialog({ mode, onClose }: { mode: 'canvas' | 'scale'; onClose(): void }): React.JSX.Element {
  const editor = useEditor()
  const doc = editor.doc
  const [width, setWidth] = useState(String(doc?.width ?? 32))
  const [height, setHeight] = useState(String(doc?.height ?? 32))
  const [anchor, setAnchor] = useState<Anchor>('c')
  const [keepRatio, setKeepRatio] = useState(true)
  if (!doc) return <></>
  const w = parseDim(width)
  const h = parseDim(height)
  const valid = w !== null && h !== null && (w !== doc.width || h !== doc.height)

  const apply = (): void => {
    if (!valid) return
    if (mode === 'canvas') editor.resizeCanvas(w, h, anchor)
    else editor.scaleImage(w, h)
    onClose()
  }

  const onWidth = (v: string): void => {
    setWidth(v)
    const n = Number(v)
    if (mode === 'scale' && keepRatio && Number.isFinite(n) && n > 0) setHeight(String(Math.max(1, Math.round((n * doc.height) / doc.width))))
  }
  const onHeight = (v: string): void => {
    setHeight(v)
    const n = Number(v)
    if (mode === 'scale' && keepRatio && Number.isFinite(n) && n > 0) setWidth(String(Math.max(1, Math.round((n * doc.width) / doc.height))))
  }

  return (
    <Modal
      title={mode === 'canvas' ? 'Taille du canevas' : 'Redimensionner l’image'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" disabled={!valid} onClick={apply}>
            Appliquer
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
      >
        <p className="muted">
          Taille actuelle : {doc.width} × {doc.height} px.{' '}
          {mode === 'canvas' ? 'Les pixels ne sont pas déformés : le canevas est agrandi ou rogné.' : 'Agrandissement au plus proche voisin, sans lissage.'}
        </p>
        {mode === 'scale' && (
          <div className="chips">
            {[50, 200, 300, 400].map((pct) => (
              <button
                key={pct}
                type="button"
                className="chip"
                onClick={() => {
                  setWidth(String(Math.max(1, Math.round((doc.width * pct) / 100))))
                  setHeight(String(Math.max(1, Math.round((doc.height * pct) / 100))))
                }}
              >
                {pct} %
              </button>
            ))}
          </div>
        )}
        <div className="form__row">
          <label className="field">
            <span>Largeur (px)</span>
            <input type="number" min={1} max={MAX_DIMENSION} value={width} onChange={(e) => onWidth(e.target.value)} aria-invalid={w === null} />
          </label>
          <label className="field">
            <span>Hauteur (px)</span>
            <input type="number" min={1} max={MAX_DIMENSION} value={height} onChange={(e) => onHeight(e.target.value)} aria-invalid={h === null} />
          </label>
        </div>
        {mode === 'scale' && (
          <label className="field field--inline">
            <input type="checkbox" checked={keepRatio} onChange={(e) => setKeepRatio(e.target.checked)} />
            <span>Conserver les proportions</span>
          </label>
        )}
        {mode === 'canvas' && (
          <>
            <div className="form__label">Ancrage de l’image</div>
            <div className="anchor-grid" role="radiogroup" aria-label="Ancrage">
              {ANCHORS.map((a) => (
                <button
                  key={a}
                  type="button"
                  role="radio"
                  aria-checked={anchor === a}
                  title={ANCHOR_LABELS[a]}
                  className={`anchor-grid__cell${anchor === a ? ' is-active' : ''}`}
                  onClick={() => setAnchor(a)}
                />
              ))}
            </div>
          </>
        )}
        {w === null || h === null ? <p className="form__error">Dimensions entre 1 et {MAX_DIMENSION} pixels.</p> : null}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
