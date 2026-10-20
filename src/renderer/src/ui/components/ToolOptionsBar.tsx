import { Grid3x3, Maximize, Minus, Plus } from 'lucide-react'
import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE } from '../../raster/brush'
import { toolInfo } from '../../tools/tools'
import { formatKeys } from '../commands'
import { useApp, useEditor } from '../useEditor'
import { IconButton } from './IconButton'
import { toolIcon } from './Toolbar'

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)} %`
}

/** Options de l'outil actif et contrôles de la vue. */
export function ToolOptionsBar(): React.JSX.Element {
  const editor = useEditor()
  const { commands } = useApp()
  const info = toolInfo(editor.tool)
  const tip = (id: keyof typeof commands): string => `${commands[id].label} (${formatKeys(commands[id].keys?.[0])})`

  return (
    <div className="options">
      <div className="options__tool" title={info.hint}>
        {toolIcon(info.id)}
        <strong>{info.label}</strong>
        <kbd>{formatKeys(commands[`tool.${info.id}`].keys?.[0])}</kbd>
      </div>

      {info.usesBrush && (
        <label className="field field--inline" title={`Taille de la brosse (${formatKeys('[')} / ${formatKeys(']')})`}>
          <span>Taille</span>
          <input
            type="range"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            value={editor.brushSize}
            onChange={(e) => editor.setBrushSize(Number(e.target.value))}
          />
          <input
            type="number"
            className="input--narrow"
            min={MIN_BRUSH_SIZE}
            max={MAX_BRUSH_SIZE}
            value={editor.brushSize}
            onChange={(e) => editor.setBrushSize(Number(e.target.value))}
          />
          <span className="muted">px</span>
        </label>
      )}

      {editor.tool === 'fill' && (
        <label className="field field--inline" title="Contigu : remplit seulement la zone connectée. Sinon : toutes les occurrences de la couleur.">
          <input type="checkbox" checked={editor.fillContiguous} onChange={(e) => editor.setFillContiguous(e.target.checked)} />
          <span>Zone contiguë uniquement</span>
        </label>
      )}

      {editor.tool === 'picker' && (
        <label className="field field--inline" title="Où lire la couleur">
          <span>Échantillon</span>
          <select value={editor.pickerSampleAll ? 'all' : 'layer'} onChange={(e) => editor.setPickerSampleAll(e.target.value === 'all')}>
            <option value="all">Image visible</option>
            <option value="layer">Calque actif</option>
          </select>
        </label>
      )}

      {editor.tool === 'select' && (
        <span className="muted small">
          Maj : ajouter · Alt : retirer · glisser dans la sélection : déplacer · {formatKeys('mod+c')} / {formatKeys('mod+x')} / {formatKeys('mod+v')} ·{' '}
          {formatKeys('delete')} : supprimer
        </span>
      )}

      {editor.tool === 'wand' && (
        <>
          <div className="segmented" role="radiogroup" aria-label="Action de la baguette">
            <button
              type="button"
              role="radio"
              aria-checked={editor.wand.action === 'select'}
              className={editor.wand.action === 'select' ? 'is-active' : undefined}
              title="Le clic sélectionne les pixels de cette couleur"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.setWand({ action: 'select' })}
            >
              Sélectionner
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={editor.wand.action === 'delete'}
              className={editor.wand.action === 'delete' ? 'is-active is-danger' : undefined}
              title="Le clic supprime directement les pixels de cette couleur (limité à la sélection active s'il y en a une)"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.setWand({ action: 'delete' })}
            >
              Supprimer la couleur
            </button>
          </div>
          <label className="field field--inline" title="Zone contiguë : pixels reliés au point cliqué. Toute l'image : toutes les occurrences de la couleur.">
            <span>Portée</span>
            <select value={editor.wand.contiguous ? 'zone' : 'global'} onChange={(e) => editor.setWand({ contiguous: e.target.value === 'zone' })}>
              <option value="zone">Zone contiguë</option>
              <option value="global">Toute l’image</option>
            </select>
          </label>
          <label className="field field--inline" title="Écart de couleur accepté par composante (0 = couleur exacte)">
            <span>Tolérance</span>
            <input type="range" min={0} max={255} value={editor.wand.tolerance} onChange={(e) => editor.setWand({ tolerance: Number(e.target.value) })} />
            <input
              type="number"
              className="input--narrow"
              min={0}
              max={255}
              value={editor.wand.tolerance}
              onChange={(e) => editor.setWand({ tolerance: Number(e.target.value) || 0 })}
            />
          </label>
          {editor.selection && editor.wand.action === 'delete' && <span className="muted small">Limité à la sélection</span>}
        </>
      )}

      {(editor.tool === 'line' || editor.tool.startsWith('rect') || editor.tool.startsWith('ellipse')) && (
        <span className="muted small">Maj : {editor.tool === 'line' ? 'angles de 45°' : 'proportions égales'}</span>
      )}

      <div className="options__spacer" />

      <div className="options__view">
        <IconButton title={tip('view.zoomOut')} onClick={() => editor.viewCommands?.zoomOut()}>
          <Minus size={15} />
        </IconButton>
        <button
          type="button"
          className="options__zoom"
          title={`${commands['view.actualSize'].label} (${formatKeys(commands['view.actualSize'].keys?.[0])})`}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.viewCommands?.actualSize()}
        >
          {formatZoom(editor.zoom)}
        </button>
        <IconButton title={tip('view.zoomIn')} onClick={() => editor.viewCommands?.zoomIn()}>
          <Plus size={15} />
        </IconButton>
        <IconButton title={tip('view.fit')} onClick={() => editor.viewCommands?.fit()}>
          <Maximize size={15} />
        </IconButton>
        <IconButton title={tip('view.grid')} onClick={() => editor.toggleGrid()} active={editor.showGrid}>
          <Grid3x3 size={15} />
        </IconButton>
      </div>
    </div>
  )
}
