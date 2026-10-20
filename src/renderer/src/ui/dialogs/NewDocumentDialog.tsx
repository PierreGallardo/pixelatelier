import { useState } from 'react'
import type { BackgroundChoice } from '../../app/actions'
import { MAX_DIMENSION } from '../../model/document'
import { useApp } from '../useEditor'
import { Modal } from './Modal'

export const SIZE_PRESETS: { label: string; w: number; h: number }[] = [
  { label: '16 × 16', w: 16, h: 16 },
  { label: '32 × 32', w: 32, h: 32 },
  { label: '48 × 48', w: 48, h: 48 },
  { label: '64 × 64', w: 64, h: 64 },
  { label: '128 × 128', w: 128, h: 128 },
  { label: '256 × 256', w: 256, h: 256 },
  { label: '320 × 180 (16:9)', w: 320, h: 180 },
  { label: '640 × 360 (16:9)', w: 640, h: 360 }
]

function parseDim(v: string): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= MAX_DIMENSION ? n : null
}

/** Création d'un document : formats prédéfinis ou dimensions libres. */
export function NewDocumentDialog({ onClose }: { onClose(): void }): React.JSX.Element {
  const { actions } = useApp()
  const [width, setWidth] = useState('32')
  const [height, setHeight] = useState('32')
  const [background, setBackground] = useState<BackgroundChoice>('transparent')
  const w = parseDim(width)
  const h = parseDim(height)
  const valid = w !== null && h !== null

  const create = async (): Promise<void> => {
    if (!valid) return
    onClose()
    if (await actions.ensureCanDiscard()) actions.createDocument({ width: w, height: h, background })
  }

  return (
    <Modal
      title="Nouvelle image"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn--primary" disabled={!valid} onClick={() => void create()}>
            Créer
          </button>
        </>
      }
    >
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <div className="form__label">Formats prédéfinis</div>
        <div className="chips">
          {SIZE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`chip${w === p.w && h === p.h ? ' is-active' : ''}`}
              onClick={() => {
                setWidth(String(p.w))
                setHeight(String(p.h))
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="form__row">
          <label className="field">
            <span>Largeur (px)</span>
            <input type="number" min={1} max={MAX_DIMENSION} value={width} onChange={(e) => setWidth(e.target.value)} aria-invalid={w === null} />
          </label>
          <label className="field">
            <span>Hauteur (px)</span>
            <input type="number" min={1} max={MAX_DIMENSION} value={height} onChange={(e) => setHeight(e.target.value)} aria-invalid={h === null} />
          </label>
        </div>
        {!valid && <p className="form__error">Les dimensions doivent être des entiers entre 1 et {MAX_DIMENSION}.</p>}
        <div className="form__label">Fond</div>
        <div className="radios">
          {(
            [
              ['transparent', 'Transparent'],
              ['white', 'Blanc'],
              ['black', 'Noir']
            ] as [BackgroundChoice, string][]
          ).map(([value, label]) => (
            <label key={value} className="radio">
              <input type="radio" name="bg" value={value} checked={background === value} onChange={() => setBackground(value)} />
              <span className={`radio__swatch radio__swatch--${value}`} />
              {label}
            </label>
          ))}
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
