import { Plus, Replace, RotateCcw, Trash2 } from 'lucide-react'
import { toCss, toHex } from '../../model/color'
import { MAX_PALETTE_SIZE } from '../../model/palette'
import { useEditor } from '../useEditor'
import { IconButton } from './IconButton'

/** Palette du document : clic gauche = couleur principale, clic droit = secondaire. */
export function PalettePanel(): React.JSX.Element {
  const editor = useEditor()
  const palette = editor.doc?.palette ?? []
  const selected = editor.selectedSwatch

  return (
    <section className="panel">
      <header className="panel__header">
        <h2>
          Palette <span className="panel__count">{palette.length}</span>
        </h2>
        <div className="panel__actions">
          <IconButton title="Ajouter la couleur principale à la palette" onClick={() => editor.addPaletteColor(editor.primary)} disabled={palette.length >= MAX_PALETTE_SIZE}>
            <Plus size={15} />
          </IconButton>
          <IconButton
            title="Remplacer la couleur sélectionnée par la couleur principale"
            onClick={() => selected !== null && editor.replacePaletteColor(selected, editor.primary)}
            disabled={selected === null}
          >
            <Replace size={15} />
          </IconButton>
          <IconButton title="Retirer la couleur sélectionnée" onClick={() => selected !== null && editor.removePaletteColor(selected)} disabled={selected === null}>
            <Trash2 size={15} />
          </IconButton>
          <IconButton title="Rétablir la palette par défaut" onClick={() => editor.resetPalette()}>
            <RotateCcw size={15} />
          </IconButton>
        </div>
      </header>
      <div className="palette" role="listbox" aria-label="Palette">
        {palette.map((c, i) => (
          <button
            key={i}
            type="button"
            role="option"
            aria-selected={selected === i}
            className={`palette__swatch checker${selected === i ? ' is-selected' : ''}`}
            title={`${toHex(c)} — clic gauche : principale, clic droit : secondaire`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editor.selectSwatch(i)
              editor.setPrimary(c)
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              editor.selectSwatch(i)
              editor.setSecondary(c)
            }}
          >
            <span style={{ background: toCss(c) }} />
          </button>
        ))}
        {palette.length === 0 && <p className="muted small">Palette vide. Utilisez + pour ajouter la couleur principale.</p>}
      </div>
    </section>
  )
}
