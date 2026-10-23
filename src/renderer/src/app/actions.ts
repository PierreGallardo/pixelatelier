import type { Editor } from '../editor/Editor'
import {
  exportAnimationGif,
  exportFramePng,
  exportSpritesheetPng,
  spritesheetMetadata,
  type SpritesheetOptions
} from '../export/exporters'
import { encodePng } from '../export/png'
import { parseProject, serializeProject } from '../io/projectFormat'
import type { RGBA } from '../model/color'
import { createDocument } from '../model/document'
import type { PixelClip } from '../model/selection'
import { api, errorMessage, isDesktop } from '../platform/api'
import { decodeImageBytes } from '../platform/imageDecode'
import type { OpenedFile } from '../../../shared/api'

export type BackgroundChoice = 'transparent' | 'white' | 'black'

export interface NewDocumentParams {
  width: number
  height: number
  background: BackgroundChoice
}

const BACKGROUNDS: Record<BackgroundChoice, RGBA | null> = {
  transparent: null,
  white: { r: 255, g: 255, b: 255, a: 255 },
  black: { r: 0, g: 0, b: 0, a: 255 }
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '') || name
}

/**
 * Commandes liées aux fichiers (nouveau, ouvrir, enregistrer, exporter).
 * Elles combinent l'éditeur, le format de projet, les exports et la plateforme.
 */
export class AppActions {
  private busy = false

  constructor(private readonly editor: Editor) {}

  /** Exécute une tâche asynchrone sans chevauchement, en affichant les erreurs. */
  private async guard<T>(task: () => Promise<T>, fallback: T): Promise<T> {
    if (this.busy) return fallback
    this.busy = true
    try {
      return await task()
    } catch (err) {
      this.editor.notify(errorMessage(err), 'error')
      return fallback
    } finally {
      this.busy = false
    }
  }

  /**
   * Vérifie qu'on peut abandonner le document actif : propose d'enregistrer
   * s'il contient des modifications. Retourne faux si l'utilisateur annule.
   */
  async ensureCanDiscard(): Promise<boolean> {
    if (!this.editor.dirty) return true
    const choice = await api.confirmDiscard(this.editor.fileName)
    if (choice === 'cancel') return false
    if (choice === 'discard') return true
    return this.saveInternal(false)
  }

  createDocument(params: NewDocumentParams): void {
    try {
      const doc = createDocument({ width: params.width, height: params.height, background: BACKGROUNDS[params.background] })
      this.editor.setDocument(doc, null)
    } catch (err) {
      this.editor.notify(errorMessage(err), 'error')
    }
  }

  /**
   * Vérifie, document par document, qu'on peut tout abandonner (avant de quitter
   * pour installer une mise à jour). Chaque document modifié est affiché puis
   * l'utilisateur choisit d'enregistrer, d'abandonner ou d'annuler.
   */
  async ensureAllCanDiscard(): Promise<boolean> {
    const editor = this.editor
    for (const tab of editor.tabList) {
      if (!tab.dirty) continue
      const index = editor.tabList.findIndex((t) => t.id === tab.id)
      if (index < 0) continue
      editor.switchTab(index)
      if (!(await this.ensureCanDiscard())) return false
    }
    return true
  }

  /** Les documents ouvrent dans un nouvel onglet : rien à confirmer. */
  open(): Promise<void> {
    return this.guard(async () => {
      const file = await api.openFile()
      if (file) await this.loadOpened(file)
    }, undefined)
  }

  openRecent(path: string): Promise<void> {
    return this.guard(async () => {
      if (this.showIfOpen(path)) return
      await this.loadOpened(await api.openRecent(path))
    }, undefined)
  }

  /** Ouvre, dans un nouvel onglet, le fichier transmis par le système (double-clic, « Ouvrir avec »…). */
  openPendingFile(): Promise<void> {
    return this.guard(async () => {
      const file = await api.takePendingFile()
      if (file) await this.loadOpened(file)
    }, undefined)
  }

  /** Si ce fichier est déjà ouvert, affiche son onglet et retourne vrai. */
  private showIfOpen(path: string): boolean {
    const index = this.editor.findTabByPath(path)
    if (index < 0) return false
    this.editor.switchTab(index)
    this.editor.notify(`« ${this.editor.fileName} » est déjà ouvert.`)
    return true
  }

  private async loadOpened(file: OpenedFile): Promise<void> {
    if (file.kind === 'project') {
      if (isDesktop && this.showIfOpen(file.path)) return
      if (file.text === undefined) throw new Error('Fichier vide.')
      const doc = await parseProject(file.text)
      this.editor.setDocument(doc, isDesktop ? file.path : null, { name: file.name })
      return
    }
    if (!file.bytes) throw new Error('Fichier vide.')
    const img = await decodeImageBytes(file.bytes)
    const doc = createDocument({ width: img.width, height: img.height })
    doc.layers[0].cels[0].data.set(img.data)
    doc.layers[0].name = 'Image importée'
    // Une image importée n'est pas encore un projet : l'enregistrement demandera un nom.
    this.editor.setDocument(doc, null, { name: stripExtension(file.name), dirty: true })
    this.editor.notify(`Image importée : ${file.name} (${img.width}×${img.height})`)
  }

  save(saveAs = false): Promise<boolean> {
    return this.guard(() => this.saveInternal(saveAs), false)
  }

  private async saveInternal(saveAs: boolean): Promise<boolean> {
    const editor = this.editor
    const doc = editor.doc
    if (!doc) return false
    editor.finishSession()
    const stateId = editor.history.stateId
    const content = await serializeProject(doc)
    const result = await api.saveProject({
      path: editor.filePath,
      suggestedName: stripExtension(editor.fileName),
      content,
      saveAs
    })
    if (!result) return false
    editor.markSaved(result.path, stateId)
    editor.notify(`Projet enregistré : ${result.name}`)
    return true
  }

  /**
   * Fermeture de la fenêtre avec « Enregistrer » : enregistre chaque document
   * modifié (en l'affichant), puis ferme. Une annulation interrompt la fermeture.
   */
  async saveAndClose(): Promise<void> {
    const ok = await this.guard(async () => {
      const editor = this.editor
      for (const tab of editor.tabList) {
        if (!tab.dirty) continue
        const index = editor.tabList.findIndex((t) => t.id === tab.id)
        if (index < 0) continue
        editor.switchTab(index)
        if (!(await this.saveInternal(false))) return false
      }
      return true
    }, false)
    if (ok) api.closeNow()
  }

  /** Ferme l'onglet actif, après avoir proposé d'enregistrer. */
  async closeDocument(): Promise<void> {
    await this.closeTab(this.editor.activeTabIndex)
  }

  /**
   * Ferme un onglet. S'il contient des modifications, il est d'abord affiché
   * et l'utilisateur peut enregistrer ou annuler.
   */
  async closeTab(index: number): Promise<void> {
    await this.guard(async () => {
      const editor = this.editor
      const tab = editor.tabList[index]
      if (!tab) return
      if (tab.dirty) {
        editor.switchTab(index)
        if (!(await this.ensureCanDiscard())) return
      }
      const current = editor.tabList.findIndex((t) => t.id === tab.id)
      if (current >= 0) editor.closeTab(current)
    }, undefined)
  }

  private exportBaseName(): string {
    return stripExtension(this.editor.fileName)
  }

  /* ----------------------------- Presse-papiers ----------------------------- */

  /**
   * Copie la sélection : presse-papiers interne (exact, transparence comprise) et,
   * en PNG, presse-papiers du système pour les autres logiciels.
   */
  async copy(merged = false): Promise<void> {
    const clip = this.editor.copySelection(merged)
    if (clip) await this.publishClip(clip, merged ? 'Copie (tous les calques)' : 'Copie')
  }

  async cut(): Promise<void> {
    const clip = this.editor.cutSelection()
    if (clip) await this.publishClip(clip, 'Coupé')
  }

  private async publishClip(clip: PixelClip, label: string): Promise<void> {
    const { width, height } = clip.image
    try {
      await api.writeClipboardImage(await encodePng(width, height, clip.image.data))
      this.editor.notify(`${label} : ${width} × ${height} px`)
    } catch {
      // Le presse-papiers interne reste utilisable même si celui du système est inaccessible.
      this.editor.notify(`${label} : ${width} × ${height} px (presse-papiers interne uniquement)`)
    }
  }

  /**
   * Colle l'image du presse-papiers : celle d'un autre logiciel si elle est plus
   * récente, sinon la copie interne. Sans document ouvert, crée un document à sa taille.
   */
  paste(): Promise<void> {
    return this.guard(async () => {
      const editor = this.editor
      let clip: PixelClip | null = null
      const fromSystem = await api.readClipboardImage().catch(() => ({ source: 'none' as const, png: undefined }))
      if (fromSystem.source === 'external' && fromSystem.png) {
        const img = await decodeImageBytes(fromSystem.png)
        clip = { image: { width: img.width, height: img.height, data: img.data }, x: 0, y: 0 }
      } else if (editor.clipboard) {
        clip = editor.clipboard
      }
      if (!clip) {
        editor.notify('Le presse-papiers ne contient pas d’image.', 'error')
        return
      }
      if (!editor.doc) {
        const doc = createDocument({ width: clip.image.width, height: clip.image.height })
        doc.layers[0].cels[0].data.set(clip.image.data)
        editor.setDocument(doc, null, { name: 'Collage', dirty: true })
        return
      }
      if (editor.paste(clip)) {
        editor.notify('Image collée : déplacez-la puis Entrée pour valider (Échap pour annuler).')
      }
    }, undefined)
  }

  exportPng(scale: number, frameIndex = this.editor.activeFrame): Promise<boolean> {
    return this.guard(async () => {
      const doc = this.editor.doc
      if (!doc) return false
      const data = await exportFramePng(doc, frameIndex, scale)
      const suffix = doc.frames.length > 1 ? `-${frameIndex + 1}` : ''
      const res = await api.exportFile({ kind: 'png', suggestedName: `${this.exportBaseName()}${suffix}`, data })
      if (res) this.editor.notify(`Image exportée : ${res.name}`)
      return res !== null
    }, false)
  }

  exportGif(scale: number): Promise<boolean> {
    return this.guard(async () => {
      const doc = this.editor.doc
      if (!doc) return false
      const data = exportAnimationGif(doc, { scale })
      const res = await api.exportFile({ kind: 'gif', suggestedName: this.exportBaseName(), data })
      if (res) this.editor.notify(`Animation exportée : ${res.name}`)
      return res !== null
    }, false)
  }

  exportSpritesheet(opts: SpritesheetOptions, withJson: boolean): Promise<boolean> {
    return this.guard(async () => {
      const doc = this.editor.doc
      if (!doc) return false
      const { png, sheet } = await exportSpritesheetPng(doc, opts)
      const name = `${this.exportBaseName()}-planche`
      const res = await api.exportFile({
        kind: 'png',
        suggestedName: name,
        data: png,
        sidecarJson: withJson ? spritesheetMetadata(doc, sheet, `${name}.png`, opts.scale ?? 1) : undefined
      })
      if (res) this.editor.notify(`Planche exportée : ${res.name}${withJson ? ' (+ JSON)' : ''}`)
      return res !== null
    }, false)
  }
}
