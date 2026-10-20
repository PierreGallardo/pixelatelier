import { useState } from 'react'
import { MAX_EXPORT_SCALE, sheetGrid, type SheetLayout } from '../../export/exporters'
import { useApp, useEditor } from '../useEditor'
import { Modal } from './Modal'

export type ExportTab = 'png' | 'gif' | 'sheet'

const SCALES = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32].filter((s) => s <= MAX_EXPORT_SCALE)

/** Export PNG (image courante), GIF (animation) et planche de sprites. */
export function ExportDialog({ initialTab, onClose }: { initialTab: ExportTab; onClose(): void }): React.JSX.Element {
  const editor = useEditor()
  const { actions } = useApp()
  const [tab, setTab] = useState<ExportTab>(initialTab)
  const [scale, setScale] = useState(1)
  const [layout, setLayout] = useState<SheetLayout>('horizontal')
  const [columns, setColumns] = useState(4)
  const [padding, setPadding] = useState(0)
  const [withJson, setWithJson] = useState(true)
  const [busy, setBusy] = useState(false)
  const doc = editor.doc
  if (!doc) return <></>

  const frames = doc.frames.length
  const fw = doc.width * scale
  const fh = doc.height * scale
  let outW = fw
  let outH = fh
  if (tab === 'sheet') {
    const g = sheetGrid(frames, { layout, columns })
    outW = g.columns * fw + (g.columns - 1) * padding
    outH = g.rows * fh + (g.rows - 1) * padding
  }
  const tooBig = outW > 16384 || outH > 16384 || outW * outH > 100_000_000

  const run = async (): Promise<void> => {
    setBusy(true)
    let ok = false
    if (tab === 'png') ok = await actions.exportPng(scale)
    else if (tab === 'gif') ok = await actions.exportGif(scale)
    else ok = await actions.exportSpritesheet({ layout, columns, padding, scale }, withJson)
    setBusy(false)
    if (ok) onClose()
  }

  const tabs: [ExportTab, string][] = [
    ['png', 'Image PNG'],
    ['gif', 'Animation GIF'],
    ['sheet', 'Planche de sprites']
  ]

  return (
    <Modal
      title="Exporter"
      onClose={onClose}
      width={480}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" disabled={busy || tooBig} onClick={() => void run()}>
            {busy ? 'Export…' : 'Exporter…'}
          </button>
        </>
      }
    >
      <div className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`tab${tab === id ? ' is-active' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      <div className="form">
        {tab === 'png' && (
          <p className="muted">
            Exporte l’image d’animation n° {editor.activeFrame + 1} avec tous les calques visibles, en conservant la transparence.
          </p>
        )}
        {tab === 'gif' && (
          <p className="muted">
            Exporte les {frames} image{frames > 1 ? 's' : ''} à {doc.fps} images/s, en boucle. Le GIF ne gère qu’une transparence tout ou rien :
            les pixels à moins de 50 % d’opacité deviennent transparents, les autres opaques.
          </p>
        )}
        {tab === 'sheet' && (
          <>
            <p className="muted">Assemble les {frames} images dans un seul PNG, avec un fichier JSON optionnel décrivant la position de chaque image.</p>
            <div className="form__row">
              <label className="field">
                <span>Disposition</span>
                <select value={layout} onChange={(e) => setLayout(e.target.value as SheetLayout)}>
                  <option value="horizontal">Horizontale (une ligne)</option>
                  <option value="vertical">Verticale (une colonne)</option>
                  <option value="grid">Grille</option>
                </select>
              </label>
              {layout === 'grid' && (
                <label className="field">
                  <span>Colonnes</span>
                  <input type="number" min={1} max={frames} value={columns} onChange={(e) => setColumns(Math.max(1, Math.floor(Number(e.target.value) || 1)))} />
                </label>
              )}
              <label className="field">
                <span>Espacement (px)</span>
                <input type="number" min={0} max={64} value={padding} onChange={(e) => setPadding(Math.min(64, Math.max(0, Math.floor(Number(e.target.value) || 0))))} />
              </label>
            </div>
            <label className="field field--inline">
              <input type="checkbox" checked={withJson} onChange={(e) => setWithJson(e.target.checked)} />
              <span>Écrire aussi les métadonnées JSON (même nom, extension .json)</span>
            </label>
          </>
        )}

        <label className="field">
          <span>Agrandissement (sans lissage)</span>
          <select value={scale} onChange={(e) => setScale(Number(e.target.value))}>
            {SCALES.map((s) => (
              <option key={s} value={s}>
                × {s}
              </option>
            ))}
          </select>
        </label>
        <p className={tooBig ? 'form__error' : 'muted small'}>
          Taille du fichier : {outW} × {outH} px{tooBig ? ' — trop grand, réduisez l’agrandissement.' : ''}
        </p>
      </div>
    </Modal>
  )
}
