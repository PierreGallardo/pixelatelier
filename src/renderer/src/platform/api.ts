import {
  IMAGE_EXTENSIONS,
  PROJECT_EXTENSION,
  type ClipboardImage,
  type DiscardChoice,
  type ExportRequest,
  type OpenedFile,
  type PixelatelierApi,
  type SaveProjectRequest,
  type SavedFile,
  type UpdateCheckResult,
  type UpdatePreferences,
  type WindowState
} from '../../../shared/api'

declare global {
  interface Window {
    pixelatelier?: PixelatelierApi
  }
}

/**
 * Accès aux fonctions du système (fichiers, boîtes de dialogue).
 *
 * Dans Electron, tout passe par le pont sécurisé `window.pixelatelier` exposé par
 * le preload. Hors d'Electron (`npm run dev:web`), une implémentation de
 * repli utilise les API standard du navigateur : sélecteur de fichier pour
 * ouvrir, téléchargement pour enregistrer et exporter.
 */

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null)
      input.remove()
    })
    input.addEventListener('cancel', () => {
      resolve(null)
      input.remove()
    })
    document.body.appendChild(input)
    input.click()
  })
}

function download(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const webApi: PixelatelierApi = {
  platform: 'web',
  async openFile(): Promise<OpenedFile | null> {
    const accept = [PROJECT_EXTENSION, ...IMAGE_EXTENSIONS].map((e) => `.${e}`).join(',')
    const file = await pickFile(accept)
    if (!file) return null
    const isProject = file.name.toLowerCase().endsWith(`.${PROJECT_EXTENSION}`)
    if (isProject) return { path: file.name, name: file.name, kind: 'project', text: await file.text() }
    return { path: file.name, name: file.name, kind: 'image', bytes: new Uint8Array(await file.arrayBuffer()) }
  },
  async openRecent(): Promise<OpenedFile> {
    throw new Error('Les fichiers récents ne sont disponibles que dans l’application de bureau.')
  },
  async listRecent(): Promise<string[]> {
    return []
  },
  async saveProject(req: SaveProjectRequest): Promise<SavedFile | null> {
    const base = req.path ? req.path.replace(/\.pixatelier$/i, '') : req.suggestedName
    const name = `${base}.${PROJECT_EXTENSION}`
    download(name, req.content, 'application/json')
    return { path: name, name }
  },
  async exportFile(req: ExportRequest): Promise<SavedFile | null> {
    const name = `${req.suggestedName}.${req.kind}`
    download(name, new Uint8Array(req.data), req.kind === 'png' ? 'image/png' : 'image/gif')
    if (req.sidecarJson !== undefined) download(`${req.suggestedName}.json`, req.sidecarJson, 'application/json')
    return { path: name, name }
  },
  async confirmDiscard(name: string): Promise<DiscardChoice> {
    return window.confirm(`Abandonner les modifications non enregistrées de « ${name} » ?`) ? 'discard' : 'cancel'
  },
  setWindowState(state: WindowState): void {
    document.title = state.title
  },
  onSaveBeforeClose(): () => void {
    return () => undefined
  },
  closeNow(): void {},
  async writeClipboardImage(png: Uint8Array): Promise<void> {
    lastWebClipboardSize = png.byteLength
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([new Uint8Array(png)], { type: 'image/png' }) })])
  },
  async readClipboardImage(): Promise<ClipboardImage> {
    try {
      for (const item of await navigator.clipboard.read()) {
        if (!item.types.includes('image/png')) continue
        const png = new Uint8Array(await (await item.getType('image/png')).arrayBuffer())
        // Le navigateur ne permet pas d'identifier l'origine : on compare la taille du dernier PNG écrit.
        return png.byteLength === lastWebClipboardSize ? { source: 'internal' } : { source: 'external', png }
      }
    } catch {
      // Accès refusé par le navigateur : seul le presse-papiers interne est utilisé.
    }
    return { source: 'none' }
  },
  onMenuEdit(): () => void {
    return () => undefined
  },
  nativeEdit(): void {},
  // Version navigateur : pas de recherche de mise à jour (application de développement).
  async checkForUpdates(): Promise<UpdateCheckResult> {
    return { status: 'unsupported', current: __APP_VERSION__ }
  },
  async skipUpdate(): Promise<void> {},
  async openReleasePage(url: string): Promise<void> {
    window.open(url, '_blank', 'noopener')
  },
  async getUpdatePreferences(): Promise<UpdatePreferences> {
    return { autoCheck: false }
  },
  async setAutoUpdateCheck(): Promise<void> {}
}

let lastWebClipboardSize = -1

export const api: PixelatelierApi = window.pixelatelier ?? webApi
export const isDesktop = window.pixelatelier !== undefined
export const isMac = api.platform === 'darwin' || (api.platform === 'web' && /Mac/i.test(navigator.userAgent))

/** Message lisible à partir d'une erreur (retire le préfixe ajouté par l'IPC d'Electron). */
export function errorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '')
}
