import { toolInfo } from '../../tools/tools'
import { formatKeys } from '../commands'
import { useCursor } from '../cursorStore'
import { useApp, useEditor } from '../useEditor'
import { formatZoom } from './ToolOptionsBar'

/** Barre d'état : outil, dimensions, position du pointeur, zoom, état du document. */
export function StatusBar(): React.JSX.Element {
  const editor = useEditor()
  const { commands } = useApp()
  const cursor = useCursor()
  const doc = editor.doc
  const info = toolInfo(editor.tool)
  return (
    <div className="statusbar">
      <span title="Outil actif">
        {info.label} <kbd>{formatKeys(commands[`tool.${info.id}`].keys?.[0])}</kbd>
      </span>
      {doc && (
        <>
          <span title="Dimensions de l'image">
            {doc.width} × {doc.height} px
          </span>
          <span title="Position du pointeur" className="statusbar__pos">
            {cursor ? `x ${cursor.x}, y ${cursor.y}` : '—'}
          </span>
          <span title="Calque actif">Calque : {editor.activeLayerObj?.name}</span>
          <span title="Image d'animation active">
            Image {editor.activeFrame + 1}/{doc.frames.length} · {doc.fps} img/s
          </span>
          <span title="Zoom">Zoom {formatZoom(editor.zoom)}</span>
          {editor.floating ? (
            <span className="statusbar__selection" title="Collage en cours">
              Collage {editor.floating.image.width} × {editor.floating.image.height} — {formatKeys('enter')} valider, {formatKeys('escape')} annuler
            </span>
          ) : editor.selection ? (
            <span className="statusbar__selection" title="Rectangle englobant de la sélection">
              Sélection {editor.selection.bounds.w} × {editor.selection.bounds.h}
            </span>
          ) : null}
        </>
      )}
      <span className="statusbar__spacer" />
      {doc && (
        <span className={editor.dirty ? 'statusbar__dirty' : 'muted'} title={editor.filePath ?? 'Jamais enregistré'}>
          {editor.fileName}
          {editor.dirty ? ' — modifié' : ''}
        </span>
      )}
      <span className="muted" title="Liste des raccourcis">
        {formatKeys('f1')} : raccourcis
      </span>
    </div>
  )
}
