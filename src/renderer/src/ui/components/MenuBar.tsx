import { Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isDesktop, isMac } from '../../platform/api'
import { formatKeys, runCommand, type CommandId } from '../commands'
import { useApp, useEditor } from '../useEditor'

type MenuItem = CommandId | '-'

interface MenuDef {
  label: string
  items: MenuItem[]
}

const MENUS: MenuDef[] = [
  {
    label: 'Fichier',
    items: [
      'file.new',
      'file.open',
      '-',
      'file.save',
      'file.saveAs',
      '-',
      'file.exportPng',
      'file.exportGif',
      'file.exportSheet',
      '-',
      'file.close',
      ...(isDesktop && !isMac ? (['-', 'file.quit'] as MenuItem[]) : [])
    ]
  },
  {
    label: 'Édition',
    items: [
      'edit.undo',
      'edit.redo',
      '-',
      'edit.cut',
      'edit.copy',
      'edit.copyMerged',
      'edit.paste',
      'edit.delete',
      '-',
      'edit.selectAll',
      'edit.deselect',
      'edit.invertSelection',
      '-',
      'edit.swapColors',
      'edit.addColorToPalette'
    ]
  },
  {
    label: 'Image',
    items: [
      'image.canvasSize',
      'image.scale',
      '-',
      'image.flipH',
      'image.flipV',
      'image.rotateCw',
      'image.rotateCcw',
      '-',
      'view.zoomIn',
      'view.zoomOut',
      'view.fit',
      'view.actualSize',
      'view.grid'
    ]
  },
  {
    label: 'Calques',
    items: ['layer.new', 'layer.duplicate', 'layer.delete', '-', 'layer.up', 'layer.down', 'layer.mergeDown', '-', 'layer.toggleVisible']
  },
  {
    label: 'Animation',
    items: [
      'anim.play',
      '-',
      'anim.newFrame',
      'anim.duplicateFrame',
      'anim.deleteFrame',
      '-',
      'anim.moveFrameLeft',
      'anim.moveFrameRight',
      '-',
      'anim.firstFrame',
      'anim.prevFrame',
      'anim.nextFrame',
      'anim.lastFrame',
      '-',
      'anim.onion'
    ]
  },
  { label: 'Aide', items: ['help.shortcuts', 'help.about'] }
]

/** Barre de menus de l'application (identique sur toutes les plateformes). */
export function MenuBar(): React.JSX.Element {
  useEditor() // états activé/coché à jour
  const { commands } = useApp()
  const [open, setOpen] = useState<number | null>(null)
  const [focusIndex, setFocusIndex] = useState(-1)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open === null) return
    const onDown = (e: MouseEvent): void => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent): void => {
      const items = MENUS[open].items
      const enabledIdx = items
        .map((id, i) => (id !== '-' && (commands[id].enabled?.() ?? true) ? i : -1))
        .filter((i) => i >= 0)
      if (e.key === 'Escape') {
        setOpen(null)
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const pos = enabledIdx.indexOf(focusIndex)
        const next = e.key === 'ArrowDown' ? enabledIdx[(pos + 1) % enabledIdx.length] : enabledIdx[(pos - 1 + enabledIdx.length) % enabledIdx.length]
        setFocusIndex(next ?? -1)
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        setOpen((open + (e.key === 'ArrowRight' ? 1 : MENUS.length - 1)) % MENUS.length)
        setFocusIndex(-1)
      } else if (e.key === 'Enter' && focusIndex >= 0) {
        const id = items[focusIndex]
        if (id !== '-') {
          setOpen(null)
          runCommand(commands[id])
        }
      } else {
        return
      }
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open, focusIndex, commands])

  return (
    <div className="menubar" ref={barRef} role="menubar">
      <span className="menubar__brand" aria-hidden>
        <span className="brand-mark" />
      </span>
      {MENUS.map((menu, mi) => (
        <div key={menu.label} className="menubar__menu">
          <button
            type="button"
            role="menuitem"
            aria-haspopup="true"
            aria-expanded={open === mi}
            className={`menubar__title${open === mi ? ' is-open' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault()
              setOpen(open === mi ? null : mi)
              setFocusIndex(-1)
            }}
            onMouseEnter={() => {
              if (open !== null && open !== mi) {
                setOpen(mi)
                setFocusIndex(-1)
              }
            }}
          >
            {menu.label}
          </button>
          {open === mi && (
            <div className="menu" role="menu">
              {menu.items.map((id, i) => {
                if (id === '-') return <div key={`sep-${i}`} className="menu__sep" role="separator" />
                const cmd = commands[id]
                const enabled = cmd.enabled?.() ?? true
                const checked = cmd.checked?.()
                return (
                  <button
                    key={id}
                    type="button"
                    role={checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
                    aria-checked={checked}
                    className={`menu__item${focusIndex === i ? ' is-focus' : ''}`}
                    disabled={!enabled}
                    onMouseEnter={() => setFocusIndex(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOpen(null)
                      runCommand(cmd)
                    }}
                  >
                    <span className="menu__check">{checked ? <Check size={14} /> : null}</span>
                    <span className="menu__label">{cmd.label}</span>
                    <span className="menu__keys">{formatKeys(cmd.keys?.[0])}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
