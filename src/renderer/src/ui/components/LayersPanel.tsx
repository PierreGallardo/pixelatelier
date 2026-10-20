import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Merge, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatKeys } from '../commands'
import { useApp, useEditor } from '../useEditor'
import { IconButton } from './IconButton'

function LayerName({ name, onRename }: { name: string; onRename(name: string): void }): React.JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  if (!editing) {
    return (
      <span
        className="layer__name"
        title="Double-cliquer pour renommer"
        onDoubleClick={() => {
          setDraft(name)
          setEditing(true)
        }}
      >
        {name}
      </span>
    )
  }
  const commit = (): void => {
    setEditing(false)
    onRename(draft)
  }
  return (
    <input
      ref={inputRef}
      className="layer__rename"
      value={draft}
      maxLength={100}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setEditing(false)
        e.stopPropagation()
      }}
    />
  )
}

/** Liste des calques (du haut vers le bas), propriétés et opérations. */
export function LayersPanel(): React.JSX.Element {
  const editor = useEditor()
  const { commands } = useApp()
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [dropAt, setDropAt] = useState<number | null>(null)
  const doc = editor.doc
  if (!doc) return <section className="panel" />
  const active = editor.activeLayerObj
  const order = doc.layers.map((_, i) => doc.layers.length - 1 - i) // affichage : haut en premier
  const tip = (id: keyof typeof commands, label?: string): string => {
    const k = commands[id].keys?.[0]
    return `${label ?? commands[id].label}${k ? ` (${formatKeys(k)})` : ''}`
  }

  return (
    <section className="panel panel--grow">
      <header className="panel__header">
        <h2>
          Calques <span className="panel__count">{doc.layers.length}</span>
        </h2>
        <div className="panel__actions">
          <IconButton title={tip('layer.new')} onClick={() => editor.addLayer()}>
            <Plus size={15} />
          </IconButton>
          <IconButton title={tip('layer.duplicate')} onClick={() => editor.duplicateLayer()}>
            <Copy size={15} />
          </IconButton>
          <IconButton title={tip('layer.up')} onClick={() => editor.moveLayer(editor.activeLayer, 1)} disabled={editor.activeLayer >= doc.layers.length - 1}>
            <ArrowUp size={15} />
          </IconButton>
          <IconButton title={tip('layer.down')} onClick={() => editor.moveLayer(editor.activeLayer, -1)} disabled={editor.activeLayer <= 0}>
            <ArrowDown size={15} />
          </IconButton>
          <IconButton title={tip('layer.mergeDown')} onClick={() => editor.mergeLayerDown()} disabled={editor.activeLayer <= 0}>
            <Merge size={15} />
          </IconButton>
          <IconButton title={tip('layer.delete')} onClick={() => editor.deleteLayer()} disabled={doc.layers.length <= 1}>
            <Trash2 size={15} />
          </IconButton>
        </div>
      </header>

      <ul className="layers" role="listbox" aria-label="Calques">
        {order.map((index) => {
          const layer = doc.layers[index]
          const isActive = index === editor.activeLayer
          return (
            <li
              key={layer.id}
              role="option"
              aria-selected={isActive}
              className={`layer${isActive ? ' is-active' : ''}${!layer.visible ? ' is-hidden' : ''}${dropAt === index && dragFrom !== null && dragFrom !== index ? ' is-drop' : ''}`}
              onClick={() => editor.setActiveLayer(index)}
              draggable
              onDragStart={(e) => {
                setDragFrom(index)
                e.dataTransfer.effectAllowed = 'move'
                e.dataTransfer.setData('text/plain', String(index))
              }}
              onDragOver={(e) => {
                if (dragFrom === null) return
                e.preventDefault()
                setDropAt(index)
              }}
              onDragLeave={() => setDropAt((v) => (v === index ? null : v))}
              onDrop={(e) => {
                e.preventDefault()
                if (dragFrom !== null) editor.reorderLayer(dragFrom, index)
                setDragFrom(null)
                setDropAt(null)
              }}
              onDragEnd={() => {
                setDragFrom(null)
                setDropAt(null)
              }}
            >
              <button
                type="button"
                className="layer__eye"
                title={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
                aria-label={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation()
                  editor.setLayerVisible(index, !layer.visible)
                }}
              >
                {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
              <LayerName name={layer.name} onRename={(name) => editor.renameLayer(index, name)} />
              <span className="layer__opacity" title="Opacité">
                {Math.round(layer.opacity * 100)} %
              </span>
            </li>
          )
        })}
      </ul>

      {active && (
        <label className="layers__opacity" title="Opacité du calque actif">
          <span>Opacité</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(active.opacity * 100)}
            onChange={(e) => editor.setLayerOpacity(editor.activeLayer, Number(e.target.value) / 100)}
          />
          <output>{Math.round(active.opacity * 100)} %</output>
        </label>
      )}
    </section>
  )
}
