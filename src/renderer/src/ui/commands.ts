import type { AppActions } from '../app/actions'
import type { Editor, ToolId } from '../editor/Editor'
import { isDesktop, isMac } from '../platform/api'
import type { DialogId } from './useEditor'
import { updates } from './updateStore'

/**
 * Commandes de l'application : une seule définition sert aux menus, aux
 * raccourcis clavier, aux infobulles et à la liste des raccourcis.
 *
 * Les raccourcis s'écrivent en minuscules : `mod` = Ctrl (Windows/Linux) ou
 * Cmd (macOS), puis `alt`, `shift` et la touche (`z`, `arrowleft`, `[`…).
 */
export interface Command {
  label: string
  /** Raccourcis ; le premier est affiché dans les menus. */
  keys?: string[]
  run(): void
  enabled?(): boolean
  checked?(): boolean
}

export type CommandId =
  | 'file.new'
  | 'file.open'
  | 'file.save'
  | 'file.saveAs'
  | 'file.exportPng'
  | 'file.exportGif'
  | 'file.exportSheet'
  | 'file.close'
  | 'file.quit'
  | 'edit.undo'
  | 'edit.redo'
  | 'edit.cut'
  | 'edit.copy'
  | 'edit.copyMerged'
  | 'edit.paste'
  | 'edit.delete'
  | 'edit.selectAll'
  | 'edit.deselect'
  | 'edit.invertSelection'
  | 'edit.swapColors'
  | 'edit.addColorToPalette'
  | 'image.canvasSize'
  | 'image.scale'
  | 'image.flipH'
  | 'image.flipV'
  | 'image.rotateCw'
  | 'image.rotateCcw'
  | 'view.zoomIn'
  | 'view.zoomOut'
  | 'view.fit'
  | 'view.actualSize'
  | 'view.grid'
  | 'layer.new'
  | 'layer.duplicate'
  | 'layer.delete'
  | 'layer.up'
  | 'layer.down'
  | 'layer.mergeDown'
  | 'layer.toggleVisible'
  | 'layer.selectAbove'
  | 'layer.selectBelow'
  | 'anim.newFrame'
  | 'anim.duplicateFrame'
  | 'anim.deleteFrame'
  | 'anim.moveFrameLeft'
  | 'anim.moveFrameRight'
  | 'anim.prevFrame'
  | 'anim.nextFrame'
  | 'anim.firstFrame'
  | 'anim.lastFrame'
  | 'anim.play'
  | 'anim.onion'
  | 'tool.brushSmaller'
  | 'tool.brushBigger'
  | `tool.${ToolId}`
  | 'help.shortcuts'
  | 'help.checkUpdates'
  | 'help.autoUpdateCheck'
  | 'help.about'

export type CommandMap = Record<CommandId, Command>

export function buildCommands(editor: Editor, actions: AppActions, openDialog: (id: DialogId) => void): CommandMap {
  const hasDoc = (): boolean => editor.doc !== null
  const frames = (): number => editor.doc?.frames.length ?? 0
  const layers = (): number => editor.doc?.layers.length ?? 0
  const tool = (id: ToolId, label: string, keys: string[]): Command => ({
    label,
    keys,
    run: () => editor.setTool(id),
    enabled: hasDoc,
    checked: () => editor.tool === id
  })

  return {
    'file.new': { label: 'Nouveau…', keys: ['mod+n'], run: () => openDialog('new') },
    'file.open': { label: 'Ouvrir…', keys: ['mod+o'], run: () => void actions.open() },
    'file.save': { label: 'Enregistrer', keys: ['mod+s'], run: () => void actions.save(false), enabled: hasDoc },
    'file.saveAs': { label: 'Enregistrer sous…', keys: ['mod+shift+s'], run: () => void actions.save(true), enabled: hasDoc },
    'file.exportPng': { label: 'Exporter l’image en PNG…', keys: ['mod+e'], run: () => openDialog('export-png'), enabled: hasDoc },
    'file.exportGif': { label: 'Exporter l’animation en GIF…', keys: ['mod+shift+e'], run: () => openDialog('export-gif'), enabled: hasDoc },
    'file.exportSheet': { label: 'Exporter une planche de sprites…', keys: ['mod+alt+e'], run: () => openDialog('export-sheet'), enabled: hasDoc },
    'file.close': { label: 'Fermer le document', keys: ['mod+w'], run: () => void actions.closeDocument(), enabled: hasDoc },
    'file.quit': { label: 'Quitter', keys: isMac ? ['mod+q'] : [], run: () => window.close(), enabled: () => isDesktop },

    'edit.undo': {
      label: 'Annuler',
      keys: ['mod+z'],
      run: () => editor.undo(),
      enabled: () => editor.history.canUndo
    },
    'edit.redo': {
      label: 'Rétablir',
      keys: isMac ? ['mod+shift+z', 'mod+y'] : ['mod+y', 'mod+shift+z'],
      run: () => editor.redo(),
      enabled: () => editor.history.canRedo
    },
    'edit.cut': { label: 'Couper', keys: ['mod+x'], run: () => void actions.cut(), enabled: () => editor.selection !== null || editor.floating !== null },
    'edit.copy': { label: 'Copier', keys: ['mod+c'], run: () => void actions.copy(false), enabled: () => editor.selection !== null || editor.floating !== null },
    'edit.copyMerged': {
      label: 'Copier tous les calques visibles',
      keys: ['mod+shift+c'],
      run: () => void actions.copy(true),
      enabled: () => editor.selection !== null || editor.floating !== null
    },
    'edit.paste': { label: 'Coller', keys: ['mod+v'], run: () => void actions.paste() },
    'edit.delete': {
      label: 'Supprimer (sélection ou image du calque)',
      keys: ['delete', 'backspace'],
      run: () => editor.deleteCommand(),
      enabled: hasDoc
    },
    'edit.selectAll': { label: 'Tout sélectionner', keys: ['mod+a'], run: () => editor.selectAllPixels(), enabled: hasDoc },
    'edit.deselect': {
      label: 'Désélectionner',
      keys: ['mod+d'],
      run: () => editor.deselect(),
      enabled: () => editor.selection !== null || editor.floating !== null
    },
    'edit.invertSelection': { label: 'Inverser la sélection', keys: ['mod+shift+i'], run: () => editor.invertSelectionPixels(), enabled: hasDoc },
    'edit.swapColors': { label: 'Échanger les couleurs', keys: ['x'], run: () => editor.swapColors() },
    'edit.addColorToPalette': {
      label: 'Ajouter la couleur principale à la palette',
      run: () => editor.addPaletteColor(editor.primary),
      enabled: hasDoc
    },

    'image.canvasSize': { label: 'Taille du canevas…', keys: ['mod+alt+c'], run: () => openDialog('canvas-size'), enabled: hasDoc },
    'image.scale': { label: 'Redimensionner l’image…', keys: ['mod+alt+i'], run: () => openDialog('scale-image'), enabled: hasDoc },
    'image.flipH': { label: 'Retourner horizontalement', keys: ['shift+h'], run: () => editor.flipHorizontal(), enabled: hasDoc },
    'image.flipV': { label: 'Retourner verticalement', keys: ['shift+v'], run: () => editor.flipVertical(), enabled: hasDoc },
    'image.rotateCw': { label: 'Rotation 90° horaire', run: () => editor.rotate(true), enabled: hasDoc },
    'image.rotateCcw': { label: 'Rotation 90° antihoraire', run: () => editor.rotate(false), enabled: hasDoc },

    'view.zoomIn': { label: 'Zoom avant', keys: ['+', 'mod+=', 'mod++', '='], run: () => editor.viewCommands?.zoomIn(), enabled: hasDoc },
    'view.zoomOut': { label: 'Zoom arrière', keys: ['-', 'mod+-'], run: () => editor.viewCommands?.zoomOut(), enabled: hasDoc },
    'view.fit': { label: 'Ajuster à l’écran', keys: ['mod+0'], run: () => editor.viewCommands?.fit(), enabled: hasDoc },
    'view.actualSize': { label: 'Taille réelle (100 %)', keys: ['mod+1'], run: () => editor.viewCommands?.actualSize(), enabled: hasDoc },
    'view.grid': {
      label: 'Grille de pixels',
      keys: ['mod+g'],
      run: () => editor.toggleGrid(),
      enabled: hasDoc,
      checked: () => editor.showGrid
    },

    'layer.new': { label: 'Nouveau calque', keys: ['shift+n'], run: () => editor.addLayer(), enabled: hasDoc },
    'layer.duplicate': { label: 'Dupliquer le calque', keys: ['mod+shift+d'], run: () => editor.duplicateLayer(), enabled: hasDoc },
    'layer.delete': {
      label: 'Supprimer le calque',
      keys: ['shift+delete'],
      run: () => editor.deleteLayer(),
      enabled: () => layers() > 1
    },
    'layer.up': {
      label: 'Monter le calque',
      keys: ['alt+arrowup'],
      run: () => editor.moveLayer(editor.activeLayer, 1),
      enabled: () => hasDoc() && editor.activeLayer < layers() - 1
    },
    'layer.down': {
      label: 'Descendre le calque',
      keys: ['alt+arrowdown'],
      run: () => editor.moveLayer(editor.activeLayer, -1),
      enabled: () => hasDoc() && editor.activeLayer > 0
    },
    'layer.mergeDown': {
      label: 'Fusionner avec le calque inférieur',
      keys: ['mod+shift+m'],
      run: () => editor.mergeLayerDown(),
      enabled: () => hasDoc() && editor.activeLayer > 0
    },
    'layer.toggleVisible': {
      label: 'Afficher/masquer le calque',
      keys: ['shift+x'],
      run: () => {
        const l = editor.activeLayerObj
        if (l) editor.setLayerVisible(editor.activeLayer, !l.visible)
      },
      enabled: hasDoc
    },
    'layer.selectAbove': {
      label: 'Calque au-dessus',
      keys: ['arrowup'],
      run: () => editor.setActiveLayer(Math.min(layers() - 1, editor.activeLayer + 1)),
      enabled: hasDoc
    },
    'layer.selectBelow': {
      label: 'Calque en dessous',
      keys: ['arrowdown'],
      run: () => editor.setActiveLayer(Math.max(0, editor.activeLayer - 1)),
      enabled: hasDoc
    },

    'anim.newFrame': { label: 'Nouvelle image', keys: ['alt+n'], run: () => editor.addFrame(), enabled: hasDoc },
    'anim.duplicateFrame': { label: 'Dupliquer l’image', keys: ['alt+d'], run: () => editor.duplicateFrame(), enabled: hasDoc },
    'anim.deleteFrame': {
      label: 'Supprimer l’image',
      keys: ['alt+delete', 'alt+backspace'],
      run: () => editor.deleteFrame(),
      enabled: () => frames() > 1
    },
    'anim.moveFrameLeft': {
      label: 'Déplacer l’image vers la gauche',
      keys: ['alt+arrowleft'],
      run: () => editor.moveFrame(editor.activeFrame, -1),
      enabled: () => hasDoc() && editor.activeFrame > 0
    },
    'anim.moveFrameRight': {
      label: 'Déplacer l’image vers la droite',
      keys: ['alt+arrowright'],
      run: () => editor.moveFrame(editor.activeFrame, 1),
      enabled: () => hasDoc() && editor.activeFrame < frames() - 1
    },
    'anim.prevFrame': { label: 'Image précédente', keys: ['arrowleft', ','], run: () => editor.prevFrame(), enabled: hasDoc },
    'anim.nextFrame': { label: 'Image suivante', keys: ['arrowright', '.'], run: () => editor.nextFrame(), enabled: hasDoc },
    'anim.firstFrame': { label: 'Première image', keys: ['home'], run: () => editor.setActiveFrame(0), enabled: hasDoc },
    'anim.lastFrame': { label: 'Dernière image', keys: ['end'], run: () => editor.setActiveFrame(frames() - 1), enabled: hasDoc },
    'anim.play': {
      label: 'Lecture / pause',
      keys: ['enter'],
      run: () => editor.togglePlay(),
      enabled: () => frames() > 1,
      checked: () => editor.playing
    },
    'anim.onion': {
      label: 'Pelures d’oignon',
      keys: ['k'],
      run: () => editor.setOnion({ enabled: !editor.onion.enabled }),
      enabled: hasDoc,
      checked: () => editor.onion.enabled
    },

    'tool.brushSmaller': { label: 'Réduire la brosse', keys: ['['], run: () => editor.setBrushSize(editor.brushSize - 1) },
    'tool.brushBigger': { label: 'Agrandir la brosse', keys: [']'], run: () => editor.setBrushSize(editor.brushSize + 1) },
    'tool.select': tool('select', 'Sélection rectangulaire', ['m']),
    'tool.wand': tool('wand', 'Baguette magique', ['w']),
    'tool.pencil': tool('pencil', 'Crayon', ['b']),
    'tool.eraser': tool('eraser', 'Gomme', ['e']),
    'tool.picker': tool('picker', 'Pipette', ['i']),
    'tool.fill': tool('fill', 'Pot de peinture', ['g']),
    'tool.line': tool('line', 'Ligne', ['l']),
    'tool.rect': tool('rect', 'Rectangle', ['r']),
    'tool.rectFilled': tool('rectFilled', 'Rectangle plein', ['shift+r']),
    'tool.ellipse': tool('ellipse', 'Ellipse', ['o']),
    'tool.ellipseFilled': tool('ellipseFilled', 'Ellipse pleine', ['shift+o']),

    'help.shortcuts': { label: 'Raccourcis clavier', keys: ['f1'], run: () => openDialog('shortcuts') },
    'help.checkUpdates': {
      label: 'Rechercher des mises à jour…',
      run: () => void updates.check(true, (text, kind) => editor.notify(text, kind)),
      enabled: () => !updates.snapshot.checking
    },
    'help.autoUpdateCheck': {
      label: 'Rechercher les mises à jour au démarrage',
      run: () => void updates.setAutoCheck(!updates.snapshot.autoCheck, (text, kind) => editor.notify(text, kind)),
      enabled: () => isDesktop,
      checked: () => updates.snapshot.autoCheck
    },
    'help.about': { label: 'À propos de Pixelatelier', run: () => openDialog('about') }
  }
}

/* -------------------------------------------------------------------------- */
/*                                  Clavier                                   */
/* -------------------------------------------------------------------------- */

const KEY_NAMES: Record<string, string> = {
  arrowleft: '←',
  arrowright: '→',
  arrowup: '↑',
  arrowdown: '↓',
  delete: 'Suppr',
  backspace: 'Retour arr.',
  enter: 'Entrée',
  space: 'Espace',
  home: 'Début',
  end: 'Fin',
  escape: 'Échap'
}

/** Texte lisible d'un raccourci, adapté à la plateforme (« Ctrl+Maj+S » ou « ⌘⇧S »). */
export function formatKeys(combo: string | undefined): string {
  if (!combo) return ''
  const parts = combo.split(/\+(?=.)/)
  const key = parts.pop() ?? ''
  const label = KEY_NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key.toUpperCase())
  const mods = parts.map((m) => {
    if (m === 'mod') return isMac ? '⌘' : 'Ctrl'
    if (m === 'alt') return isMac ? '⌥' : 'Alt'
    if (m === 'shift') return isMac ? '⇧' : 'Maj'
    return m
  })
  return isMac ? [...mods, label].join('') : [...mods, label].join('+')
}

/** Combinaison normalisée d'un événement clavier (voir `Command.keys`). */
export function comboFromEvent(e: KeyboardEvent): string {
  const altGraph = e.getModifierState?.('AltGraph') ?? false
  const mod = isMac ? e.metaKey : e.ctrlKey && !altGraph
  const alt = e.altKey && !altGraph
  let key = e.key
  // Chiffres : on s'appuie sur la position physique (AZERTY : Ctrl+0 donne « à »).
  if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5)
  else if (/^Numpad[0-9]$/.test(e.code)) key = e.code.slice(6)
  else if (alt && /^Key[A-Z]$/.test(e.code) && !/^[a-z]$/i.test(key)) key = e.code.slice(3) // Option+lettre sur macOS
  key = key === ' ' ? 'space' : key.toLowerCase()
  const isSymbol = key.length === 1 && !/[a-z0-9]/.test(key)
  const parts: string[] = []
  if (mod) parts.push('mod')
  if (alt) parts.push('alt')
  if (e.shiftKey && !isSymbol) parts.push('shift')
  parts.push(key)
  return parts.join('+')
}

/** Table combinaison → commande, construite à partir des définitions. */
export function buildKeymap(commands: CommandMap): Map<string, CommandId> {
  const map = new Map<string, CommandId>()
  for (const [id, cmd] of Object.entries(commands) as [CommandId, Command][]) {
    for (const k of cmd.keys ?? []) if (!map.has(k)) map.set(k, id)
  }
  return map
}

/** Vrai si le focus est dans un champ où le clavier sert à la saisie. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  if (target instanceof HTMLInputElement) {
    return !['range', 'checkbox', 'radio', 'button', 'color', 'submit', 'reset'].includes(target.type)
  }
  return false
}

export function runCommand(cmd: Command): boolean {
  if (cmd.enabled && !cmd.enabled()) return false
  cmd.run()
  return true
}
